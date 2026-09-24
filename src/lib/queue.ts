import type { QueueItem, SongRequest } from "@/lib/types";

/** Songs waiting to play (pending + queued) in queue order. */
export function upNext<T extends SongRequest>(queue: T[]): T[] {
  return queue
    .filter((q) => q.status === "pending" || q.status === "queued")
    .sort((a, b) => a.position - b.position);
}

export function nowPlaying<T extends SongRequest>(queue: T[]): T | null {
  return queue.find((q) => q.status === "playing") ?? null;
}

/** First approved song — what "Next" will play. */
export function nextToPlay<T extends SongRequest>(queue: T[]): T | null {
  return upNext(queue).find((q) => q.status === "queued") ?? null;
}

/** Most recently played song — what "Previous" will replay. */
export function lastPlayed<T extends SongRequest>(queue: T[]): T | null {
  const current = nowPlaying(queue);
  const waiting = new Set(upNext(queue).map((q) => q.youtube_video_id));
  return (
    queue
      .filter(
        (q) =>
          q.status === "played" &&
          q.youtube_video_id !== current?.youtube_video_id &&
          !waiting.has(q.youtube_video_id),
      )
      .sort(
        (a, b) =>
          new Date(b.started_at ?? b.updated_at).getTime() -
          new Date(a.started_at ?? a.updated_at).getTime(),
      )[0] ?? null
  );
}

export function history(queue: QueueItem[]): QueueItem[] {
  return queue
    .filter((q) => q.status === "played")
    .sort(
      (a, b) =>
        new Date(b.started_at ?? b.updated_at).getTime() -
        new Date(a.started_at ?? a.updated_at).getTime(),
    );
}
