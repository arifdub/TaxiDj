"use client";

import { Music2, Plus } from "lucide-react";
import { PassengerHeader } from "@/components/passenger/PassengerFrame";
import { usePassenger } from "@/components/passenger/PassengerContext";
import { RequireJoined } from "@/components/passenger/RequireJoined";
import { ButtonLink, EmptyState, SongSkeleton, StatusBadge, Thumbnail, YouTubeIcon } from "@/components/ui";
import { nowPlaying, upNext } from "@/lib/queue";
import type { RequestStatus } from "@/lib/types";

// Most relevant first: playing, then waiting (in queue order), then finished.
const ORDER: Record<RequestStatus, number> = {
  playing: 0,
  queued: 1,
  pending: 1,
  played: 2,
  rejected: 3,
  removed: 3,
};

export default function RequestsPage() {
  return (
    <RequireJoined>
      <PassengerHeader />
      <MyRequests />
    </RequireJoined>
  );
}

function MyRequests() {
  const { code, queue, myRequests, used, limit, queueLoading } = usePassenger();
  const waiting = upNext(queue);
  const rank = new Map(waiting.map((q, i) => [q.id, i + 1]));
  const current = nowPlaying(queue);
  const sorted = [...myRequests].sort(
    (a, b) => ORDER[a.status] - ORDER[b.status] || a.position - b.position,
  );

  return (
    <main className="flex-1 pb-8">
      <h1 className="mt-2 text-3xl font-black tracking-tight">My requests</h1>
      <p className="text-sm text-zinc-500">
        You can add up to {limit} songs. {Math.max(0, limit - used)} left.
      </p>

      {current && (
        <div className="mt-5 flex items-center gap-3 rounded-3xl bg-ink p-3 text-white">
          <Thumbnail src={current.thumbnail_url} className="size-14" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-widest text-taxi">Now playing in the car</p>
            <p className="truncate font-bold">{current.title}</p>
            <p className="truncate text-sm text-white/60">{current.artist}</p>
          </div>
        </div>
      )}

      <div className="mt-5" aria-live="polite">
        {queueLoading ? (
          <SongSkeleton tone="light" count={3} />
        ) : sorted.length === 0 ? (
          <EmptyState
            tone="light"
            icon={<Music2 className="size-7" />}
            title="No songs added yet."
            action={<ButtonLink href={`/join/${code}/music`}>Add a song</ButtonLink>}
          >
            Search YouTube and add your first song.
          </EmptyState>
        ) : (
          <ol className="space-y-3">
            {sorted.map((item) => (
              <li
                key={item.id}
                className={`flex items-center gap-3 rounded-3xl border p-3 ${
                  item.status === "playing" ? "border-go/50 bg-green-50" : "border-zinc-200"
                } ${item.status === "rejected" || item.status === "removed" ? "opacity-60" : ""}`}
              >
                <Thumbnail src={item.thumbnail_url} className="h-16 w-20" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 font-bold leading-snug">{item.title}</p>
                  <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-zinc-500">
                    <YouTubeIcon className="h-3 w-auto shrink-0" /> {item.artist ?? "YouTube"}
                  </p>
                </div>
                <StatusBadge status={item.status} rank={rank.get(item.id)} />
              </li>
            ))}
          </ol>
        )}
      </div>

      {sorted.length > 0 && used < limit && (
        <ButtonLink href={`/join/${code}/music`} size="xl" className="mt-6 w-full">
          <Plus className="size-5" aria-hidden /> Add another song
        </ButtonLink>
      )}
    </main>
  );
}
