"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getMyPassenger, getRideByCode } from "@/lib/api";
import { useRide } from "@/hooks/useRide";
import { isRideOpen } from "@/lib/ride";
import { COUNTED_STATUSES, type Passenger, type PublicRide, type QueueItem, type Ride } from "@/lib/types";

export const JOIN_CODE = /^[A-HJ-NP-Z2-9]{5}$/;

type Phase = "loading" | "invalid" | "ended" | "expired" | "error" | "ready";

interface PassengerContextValue {
  code: string;
  phase: Phase;
  publicRide: PublicRide | null;
  passenger: Passenger | null;
  setPassenger: (p: Passenger) => void;
  ride: Ride | null;
  queue: QueueItem[];
  myRequests: QueueItem[];
  used: number;
  limit: number;
  queueLoading: boolean;
  refresh: () => Promise<void>;
  retry: () => void;
}

const Ctx = createContext<PassengerContextValue | null>(null);

export function usePassenger() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("usePassenger must be used inside <PassengerProvider>");
  return ctx;
}

export function PassengerProvider({ code: rawCode, children }: { code: string; children: ReactNode }) {
  const code = rawCode.toUpperCase();
  const validFormat = JOIN_CODE.test(code);
  const [publicRide, setPublicRide] = useState<PublicRide | null>(null);
  const [passenger, setPassenger] = useState<Passenger | null>(null);
  const [lookup, setLookup] = useState<"loading" | "done" | "missing" | "error">("loading");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!validFormat) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await getRideByCode(code);
        if (cancelled) return;
        if (!r) return setLookup("missing");
        setPublicRide(r);
        if (r.state === "active") {
          const p = await getMyPassenger(r.id).catch(() => null);
          // A removed passenger is treated as not joined (joining again is refused).
          if (!cancelled) setPassenger(p && !p.removed_at ? p : null);
        }
        if (!cancelled) setLookup("done");
      } catch {
        if (!cancelled) setLookup("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, validFormat, attempt]);

  // Live ride + queue once joined (RLS only allows members to read it).
  const live = useRide(passenger ? passenger.ride_id : null);

  const retry = useCallback(() => {
    setLookup("loading");
    setAttempt((a) => a + 1);
  }, []);

  const value = useMemo<PassengerContextValue>(() => {
    let phase: Phase;
    if (!validFormat || lookup === "missing") phase = "invalid";
    else if (lookup === "loading") phase = "loading";
    else if (lookup === "error") phase = "error";
    else if (publicRide?.state === "ended" || live.ride?.status === "ended") phase = "ended";
    else if (publicRide?.state === "expired" || (live.ride && !isRideOpen(live.ride))) phase = "expired";
    else phase = "ready";

    const myRequests = passenger ? live.queue.filter((q) => q.passenger_id === passenger.id) : [];
    return {
      code,
      phase,
      publicRide,
      passenger,
      setPassenger,
      ride: live.ride,
      queue: live.queue,
      myRequests,
      used: myRequests.filter((q) => COUNTED_STATUSES.includes(q.status)).length,
      limit: live.ride?.max_requests_per_passenger ?? 10,
      queueLoading: Boolean(passenger) && live.loading,
      refresh: live.refresh,
      retry,
    };
  }, [code, validFormat, lookup, publicRide, passenger, live.ride, live.queue, live.loading, live.refresh, retry]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
