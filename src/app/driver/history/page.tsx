"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, History, Music2, Users } from "lucide-react";
import { DriverGate } from "@/components/driver/DriverGate";
import { DriverShell } from "@/components/driver/DriverShell";
import { Button, ButtonLink, EmptyState, Notice, Skeleton } from "@/components/ui";
import { rideHistory } from "@/lib/api";
import { friendlyError } from "@/lib/errors";
import { isRideOpen } from "@/lib/ride";
import { formatDate, formatElapsed, formatTime, plural } from "@/lib/format";
import type { RideHistoryEntry } from "@/lib/types";

export default function HistoryPage() {
  return (
    <DriverGate>
      {() => (
        <DriverShell title="Previous Rides" backHref="/">
          <RideHistory />
        </DriverShell>
      )}
    </DriverGate>
  );
}

function RideHistory() {
  const [rides, setRides] = useState<RideHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    rideHistory()
      .then(setRides)
      .catch((err) => setError(friendlyError(err)));
  }, [attempt]);

  const retry = () => {
    setError(null);
    setAttempt((a) => a + 1);
  };

  if (error) {
    return (
      <div className="space-y-4">
        <Notice tone="error">{error}</Notice>
        <Button className="w-full" onClick={retry}>
          Try again
        </Button>
      </div>
    );
  }

  if (!rides) {
    return (
      <div className="space-y-3" role="status" aria-label="Loading rides">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (rides.length === 0) {
    return (
      <EmptyState
        icon={<History className="size-7" />}
        title="No rides yet"
        action={<ButtonLink href="/driver/ride/new">Start a ride</ButtonLink>}
      >
        Your past rides and the songs your passengers played will show up here.
      </EmptyState>
    );
  }

  return (
    <ul className="space-y-3 pb-8">
      {rides.map((ride) => {
        const active = isRideOpen(ride);
        return (
          <li key={ride.id}>
            <Link
              href={`/driver/ride/${ride.id}`}
              className="flex items-center gap-4 rounded-3xl border border-line bg-night-2 p-4 hover:bg-night-3"
            >
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-lg font-black">
                  {formatDate(ride.created_at)}
                  {active && (
                    <span className="rounded-full bg-go/15 px-2 py-0.5 text-xs font-bold uppercase text-go">Active</span>
                  )}
                </p>
                <p className="text-sm text-mist">
                  {formatTime(ride.created_at)} ·{" "}
                  {formatElapsed(ride.created_at, active ? null : (ride.ended_at ?? ride.expires_at))} · Code{" "}
                  <span className="font-mono">{ride.join_code}</span>
                </p>
                <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Users className="size-4 text-taxi" aria-hidden /> {plural(ride.passenger_count, "passenger")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Music2 className="size-4 text-taxi" aria-hidden /> {plural(ride.song_count, "song")} ·{" "}
                    {ride.played_count} played
                  </span>
                </p>
              </div>
              <ChevronRight className="size-5 text-mist" aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
