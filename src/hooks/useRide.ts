"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getPassengers, getQueue, getRide } from "@/lib/api";
import { getSupabase } from "@/lib/supabase/client";
import type { Passenger, QueueItem, Ride } from "@/lib/types";

// Safety-net refresh while the screen is on: frequent when live updates
// aren't connected, occasional when they are.
const POLL_OFFLINE_MS = 8_000;
const POLL_LIVE_MS = 20_000;

/**
 * Live view of a ride: ride row, full queue and passengers.
 *
 * Supabase Realtime pushes row changes (filtered by ride, RLS-checked per
 * subscriber); on any change we refetch, which keeps ordering/joins simple
 * and consistent. We also refetch when the tab becomes visible or the
 * network returns (mobile browsers drop sockets in the background), plus a
 * slow safety poll.
 */
export function useRide(
  rideId: string | null,
  opts: {
    withPassengers?: boolean;
    /** Called with newly arrived requests, plus the ride and passengers they came with. */
    onNewRequests?: (items: QueueItem[], ctx: { ride: Ride; passengers: Passenger[] }) => void;
  } = {},
) {
  const [ride, setRide] = useState<Ride | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [passengers, setPassengers] = useState<Passenger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [notFound, setNotFound] = useState(false);
  const [live, setLive] = useState(false);

  const knownIds = useRef<Set<string> | null>(null);
  const onNewRef = useRef(opts.onNewRequests);
  useEffect(() => {
    onNewRef.current = opts.onNewRequests;
  });
  const withPassengers = Boolean(opts.withPassengers);

  const refresh = useCallback(async () => {
    if (!rideId) return;
    try {
      const [r, q, p] = await Promise.all([
        getRide(rideId),
        getQueue(rideId),
        withPassengers ? getPassengers(rideId) : Promise.resolve([] as Passenger[]),
      ]);
      if (!r) {
        setNotFound(true);
        return;
      }
      setRide(r);
      setQueue(q);
      setPassengers(p);
      setError(null);

      const known = knownIds.current;
      if (known) {
        const fresh = q.filter(
          (item) => !known.has(item.id) && (item.status === "pending" || item.status === "queued"),
        );
        if (fresh.length) onNewRef.current?.(fresh, { ride: r, passengers: p });
      }
      knownIds.current = new Set(q.map((item) => item.id));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [rideId, withPassengers]);

  useEffect(() => {
    if (!rideId) return;
    const client = getSupabase();
    if (!client) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      clearTimeout(timer);
      timer = setTimeout(refresh, 120);
    };

    timer = setTimeout(refresh, 0);

    const channel = client
      .channel(`ride:${rideId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "song_requests", filter: `ride_id=eq.${rideId}` },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "rides", filter: `id=eq.${rideId}` },
        scheduleRefresh,
      );
    if (withPassengers) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "passengers", filter: `ride_id=eq.${rideId}` },
        scheduleRefresh,
      );
    }
    let isLive = false;
    channel.subscribe((status) => {
      isLive = status === "SUBSCRIBED";
      setLive(isLive);
      if (isLive) scheduleRefresh();
    });

    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", scheduleRefresh);
    // A push notification arrived (service worker): refresh straight away.
    const onSwMessage = (e: MessageEvent) => {
      if (e.data?.type === "taxidj-push") scheduleRefresh();
    };
    navigator.serviceWorker?.addEventListener("message", onSwMessage);
    let lastPoll = Date.now();
    const poll = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastPoll < (isLive ? POLL_LIVE_MS : POLL_OFFLINE_MS)) return;
      lastPoll = Date.now();
      scheduleRefresh();
    }, 2_000);

    return () => {
      clearTimeout(timer);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", scheduleRefresh);
      navigator.serviceWorker?.removeEventListener("message", onSwMessage);
      client.removeChannel(channel);
    };
  }, [rideId, refresh, withPassengers]);

  return { ride, queue, passengers, loading, error, notFound, live, refresh };
}
