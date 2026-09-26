"use client";

import { CalendarDays, Clock, Music2, UserRound, Users } from "lucide-react";
import { DriverShell } from "@/components/driver/DriverShell";
import { ButtonLink, EmptyState, Thumbnail } from "@/components/ui";
import { formatDate, formatElapsed, formatTime, plural } from "@/lib/format";
import { history } from "@/lib/queue";
import type { Passenger, QueueItem, Ride } from "@/lib/types";

/** Read-only summary of a ride that has ended (or expired). */
export function RideSummary({
  ride,
  queue,
  passengers,
}: {
  ride: Ride;
  queue: QueueItem[];
  passengers: Passenger[];
}) {
  const played = history(queue).reverse();
  const endedAt = ride.ended_at ?? ride.expires_at;

  return (
    <DriverShell title="Ride summary" backHref="/driver/history">
      <div className="space-y-5 pb-8">
        <div className="rounded-3xl border border-line bg-night-2 p-5">
          <p className="text-xs font-black uppercase tracking-widest text-mist">
            {ride.status === "ended" ? "Ride ended" : "Ride expired"} · {ride.join_code}
          </p>
          <p className="mt-2 flex items-center gap-2 text-2xl font-black">
            <CalendarDays className="size-6 text-taxi" aria-hidden /> {formatDate(ride.created_at)}
          </p>
          <p className="mt-1 text-mist">
            {formatTime(ride.created_at)} – {formatTime(endedAt)}
          </p>
          <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
            <Stat icon={<Clock />} label="Duration" value={formatElapsed(ride.created_at, endedAt)} />
            <Stat icon={<Users />} label="Passengers" value={String(passengers.filter((p) => p.session_identifier !== ride.driver_id && !p.removed_at).length)} />
            <Stat icon={<Music2 />} label="Songs" value={String(queue.length)} />
          </dl>
        </div>

        <section>
          <h2 className="mb-3 text-sm font-black uppercase tracking-widest text-taxi">
            Songs played ({played.length})
          </h2>
          {played.length === 0 ? (
            <EmptyState icon={<Music2 className="size-7" />} title="No songs were played">
              {plural(queue.length, "song")} requested during this ride.
            </EmptyState>
          ) : (
            <ol className="space-y-2">
              {played.map((item) => (
                <li key={item.id} className="flex items-center gap-3 rounded-2xl bg-night-2 p-2.5">
                  <Thumbnail src={item.thumbnail_url} className="size-14" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{item.title}</p>
                    <p className="truncate text-sm text-mist">{item.artist ?? "YouTube"}</p>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-semibold text-mist">
                    <UserRound className="size-3.5" aria-hidden />
                    {item.passenger?.nickname ?? "Passenger"}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <ButtonLink href="/driver/ride/new" className="w-full" size="xl">
          START A NEW RIDE
        </ButtonLink>
      </div>
    </DriverShell>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-night-3 p-3">
      <div className="mx-auto mb-1 w-fit text-taxi [&_svg]:size-5" aria-hidden>
        {icon}
      </div>
      <dd className="text-lg font-black">{value}</dd>
      <dt className="text-xs text-mist">{label}</dt>
    </div>
  );
}
