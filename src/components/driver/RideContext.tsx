"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { endRide as apiEndRide, sendToYouTube as apiSendToYouTube, skip as apiSkip, updateRequest } from "@/lib/api";
import { errorCode, friendlyError } from "@/lib/errors";
import { useRide } from "@/hooks/useRide";
import type { DriverRequestAction, Passenger, QueueItem, Ride } from "@/lib/types";

interface RideContextValue {
  ride: Ride;
  queue: QueueItem[];
  passengers: Passenger[];
  live: boolean;
  /** Request ID (or "skip") currently being updated. */
  busy: string | null;
  error: string | null;
  clearError: () => void;
  act: (requestId: string, action: DriverRequestAction) => Promise<void>;
  skip: (direction: "next" | "previous") => Promise<void>;
  endRide: () => Promise<void>;
  /** Hand songs to the YouTube app as one batch (see driver_send_to_youtube). */
  sendToYouTube: (requestIds: string[]) => Promise<void>;
  confirmEnd: () => void;
  /** Reload the ride's queue now. */
  refresh: () => Promise<void>;
}

const RideContext = createContext<RideContextValue | null>(null);

export function useDriverRide() {
  const ctx = useContext(RideContext);
  if (!ctx) throw new Error("useDriverRide must be used inside <DriverRideProvider>");
  return ctx;
}

export function DriverRideProvider({
  data,
  confirmEnd,
  children,
}: {
  data: ReturnType<typeof useRide> & { ride: Ride };
  confirmEnd: () => void;
  children: ReactNode;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Songs being removed disappear immediately (restored if removal fails).
  const [removing, setRemoving] = useState<Set<string>>(() => new Set());
  const { ride, passengers, live, refresh } = data;
  const queue = useMemo(
    () => (removing.size ? data.queue.filter((q) => !removing.has(q.id)) : data.queue),
    [data.queue, removing],
  );

  const run = useCallback(
    async (key: string, fn: () => Promise<unknown>, onError?: (err: unknown) => string | void) => {
      setBusy(key);
      setError(null);
      try {
        await fn();
      } catch (err) {
        setError(onError?.(err) || friendlyError(err));
      } finally {
        setBusy(null);
        refresh();
      }
    },
    [refresh],
  );

  const remove = useCallback(
    (requestId: string) => {
      setRemoving((prev) => new Set(prev).add(requestId));
      return run(
        requestId,
        () => updateRequest(requestId, "remove"),
        (err) => {
          setRemoving((prev) => {
            const next = new Set(prev);
            next.delete(requestId);
            return next;
          });
          // Removing played songs needs the 20260928 database update.
          if (errorCode(err) === "INVALID_TRANSITION") {
            return "This song couldn't be removed. If it has already played, install the latest Taxi DJ database update (see README), then try again.";
          }
        },
      );
    },
    [run],
  );

  const value = useMemo<RideContextValue>(
    () => ({
      ride,
      queue,
      passengers,
      live,
      busy,
      error,
      clearError: () => setError(null),
      act: (requestId, action) =>
        action === "remove" ? remove(requestId) : run(requestId, () => updateRequest(requestId, action)),
      skip: (direction) => run("skip", () => apiSkip(ride.id, direction)),
      endRide: () => run("end", () => apiEndRide(ride.id)),
      sendToYouTube: (ids) => run("send", () => apiSendToYouTube(ride.id, ids)),
      confirmEnd,
      refresh,
    }),
    [ride, queue, passengers, live, busy, error, run, remove, confirmEnd, refresh],
  );

  return <RideContext.Provider value={value}>{children}</RideContext.Provider>;
}
