"use client";

import { useState } from "react";
import { Music2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { SpotifyIcon } from "@/components/music/AddSongPanels";
import { PassengerHeader } from "@/components/passenger/PassengerFrame";
import { usePassenger } from "@/components/passenger/PassengerContext";
import { RequireJoined } from "@/components/passenger/RequireJoined";
import { ButtonLink, EmptyState, Notice, SongSkeleton, StatusBadge, Thumbnail, YouTubeIcon } from "@/components/ui";
import { addSongRequest, removeMyRequest } from "@/lib/api";
import { friendlyError } from "@/lib/errors";
import { nowPlaying, upNext } from "@/lib/queue";
import type { QueueItem } from "@/lib/types";



export default function RequestsPage() {
  return (
    <RequireJoined>
      <PassengerHeader />
      <MyRequests />
    </RequireJoined>
  );
}

function MyRequests() {
  const { code, ride, queue, myRequests, used, limit, queueLoading, refresh } = usePassenger();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const waiting = upNext(queue);
  const rank = new Map(waiting.map((q, i) => [q.id, i + 1]));
  const current = nowPlaying(queue);
  const active = new Set(
    queue
      .filter((q) => q.status === "pending" || q.status === "queued" || q.status === "playing")
      .map((q) => q.youtube_video_id),
  );
  // Songs the passenger removed themselves disappear from their list.
  const sorted = myRequests
    .filter((q) => !(q.status === "removed" && q.removed_by === "passenger"))
    // Newest request on top.
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const full = used >= limit;

  async function run(id: string, fn: () => Promise<unknown>, success: string) {
    setBusy(id);
    setMessage(null);
    setConfirming(null);
    try {
      await fn();
      setMessage({ tone: "success", text: success });
    } catch (err) {
      setMessage({ tone: "error", text: friendlyError(err) });
    } finally {
      setBusy(null);
      refresh();
    }
  }

  const remove = (item: QueueItem) =>
    run(item.id, () => removeMyRequest(item.id), `Removed “${item.title}”. You can add another song.`);

  const replay = (item: QueueItem) =>
    run(
      item.id,
      () =>
        addSongRequest({
          rideId: ride!.id,
          videoId: item.youtube_video_id,
          title: item.title,
          artist: item.artist,
          durationSeconds: item.duration_seconds,
          source: item.source,
        }),
      `“${item.title}” was added to the queue again.`,
    );

  return (
    <main className="flex-1 pb-8">
      <h1 className="mt-2 text-3xl font-black tracking-tight">My requests</h1>
      <p className="text-sm text-zinc-500">
        You can add up to {limit} songs. {Math.max(0, limit - used)} left. Remove a song to swap it
        for another.
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

      {message && (
        <Notice tone={message.tone} className="mt-4">
          {message.text}
        </Notice>
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
            Search music and add your first song.
          </EmptyState>
        ) : (
          <ol className="space-y-3">
            {sorted.map((item) => {
              const canRemove = item.status === "pending" || item.status === "queued";
              const canReplay = item.status === "played";
              const inQueue = active.has(item.youtube_video_id);
              return (
                <li
                  key={item.id}
                  className={`rounded-3xl border p-3 ${
                    item.status === "playing" ? "border-go/50 bg-green-50" : "border-zinc-200"
                  } ${item.status === "rejected" || item.status === "removed" ? "opacity-60" : ""}`}
                >
                  <div className="flex items-center gap-3">
                    <Thumbnail src={item.thumbnail_url} className="h-16 w-20" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 font-bold leading-snug">{item.title}</p>
                      <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-zinc-500">
                        {item.spotify_track_id ? (
                          <SpotifyIcon className="size-3 shrink-0" />
                        ) : (
                          <YouTubeIcon className="h-3 w-auto shrink-0" />
                        )}{" "}
                        {item.artist ?? "YouTube"}
                      </p>
                    </div>
                    <StatusBadge status={item.status} rank={rank.get(item.id)} />
                  </div>

                  {canRemove &&
                    (confirming === item.id ? (
                      <div className="mt-3 flex items-center gap-2">
                        <p className="flex-1 text-sm font-semibold">Remove this song?</p>
                        <button
                          type="button"
                          onClick={() => setConfirming(null)}
                          className="min-h-11 rounded-xl bg-zinc-100 px-4 text-sm font-bold"
                        >
                          Keep
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(item)}
                          disabled={busy === item.id}
                          className="min-h-11 rounded-xl bg-stop px-4 text-sm font-bold text-white disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirming(item.id)}
                        aria-label={`Remove ${item.title}`}
                        className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-zinc-200 text-sm font-bold text-zinc-700 hover:bg-zinc-50"
                      >
                        <Trash2 className="size-4" aria-hidden /> Remove
                      </button>
                    ))}

                  {canReplay && (
                    <button
                      type="button"
                      onClick={() => replay(item)}
                      disabled={full || inQueue || busy === item.id}
                      aria-label={`Play ${item.title} again`}
                      className="mt-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-taxi text-sm font-bold text-ink hover:bg-taxi-light disabled:bg-zinc-100 disabled:text-zinc-500"
                    >
                      <RotateCcw className="size-4" aria-hidden />
                      {inQueue ? "Already in the queue" : full ? "Song limit reached" : "Play again"}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>

      {sorted.length > 0 && !full && (
        <ButtonLink href={`/join/${code}/music`} size="xl" className="mt-6 w-full">
          <Plus className="size-5" aria-hidden /> Add another song
        </ButtonLink>
      )}
    </main>
  );
}
