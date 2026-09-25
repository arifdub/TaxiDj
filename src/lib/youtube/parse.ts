// YouTube URL parsing/validation. Pure functions — safe on client and server.

import type { RequestSource } from "@/lib/types";

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
  "www.youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

export type ParseError = "EMPTY" | "NOT_YOUTUBE" | "PLAYLIST_ONLY" | "NO_VIDEO";

export type ParseResult =
  | { ok: true; videoId: string; source: RequestSource }
  | { ok: false; error: ParseError };

export function isValidVideoId(id: unknown): id is string {
  return typeof id === "string" && VIDEO_ID.test(id);
}

/**
 * Extracts a video ID from a YouTube or YouTube Music link.
 * Supports watch, youtu.be, shorts, embed, live and music.youtube.com links.
 * Only allow-listed YouTube hosts are accepted.
 */
export function parseYouTubeUrl(input: string): ParseResult {
  const raw = input.trim();
  if (!raw) return { ok: false, error: "EMPTY" };

  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false, error: "NOT_YOUTUBE" };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return { ok: false, error: "NOT_YOUTUBE" };
  }
  const host = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host) || url.username || url.password || url.port) {
    return { ok: false, error: "NOT_YOUTUBE" };
  }

  const source: RequestSource =
    host === "music.youtube.com" ? "youtube_music" : "youtube";
  const segments = url.pathname.split("/").filter(Boolean);

  let candidate: string | null = null;
  if (host.endsWith("youtu.be")) {
    candidate = segments[0] ?? null;
  } else if (segments[0] === "watch") {
    candidate = url.searchParams.get("v");
  } else if (["shorts", "embed", "live", "v", "e"].includes(segments[0] ?? "")) {
    candidate = segments[1] ?? null;
  }

  if (isValidVideoId(candidate)) {
    return { ok: true, videoId: candidate, source };
  }
  if (url.searchParams.has("list")) {
    return { ok: false, error: "PLAYLIST_ONLY" };
  }
  return { ok: false, error: "NO_VIDEO" };
}

export function youTubeWatchUrl(videoId: string, source: RequestSource = "youtube") {
  return source === "youtube_music"
    ? `https://music.youtube.com/watch?v=${videoId}`
    : `https://www.youtube.com/watch?v=${videoId}`;
}

/** YouTube's limit for an ad-hoc playlist link. */
export const MAX_QUEUE_LINK_VIDEOS = 50;

/**
 * A YouTube link that plays several videos back-to-back as a temporary
 * playlist. Opened in the YouTube app (or youtube.com while signed in),
 * YouTube handles autoplay and, for Premium members, background play.
 */
export function youTubeQueueUrl(videoIds: string[]): string | null {
  const ids = videoIds.filter(isValidVideoId).slice(0, MAX_QUEUE_LINK_VIDEOS);
  if (ids.length === 0) return null;
  // Only youtube.com supports this; music.youtube.com ignores it.
  return `https://www.youtube.com/watch_videos?video_ids=${ids.join(",")}`;
}

export function youTubeThumbnailUrl(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

/** Parses an ISO-8601 duration such as "PT3M20S" into seconds. */
export function parseIsoDuration(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(iso);
  if (!m) return null;
  const [, d, h, min, s] = m.map((v) => (v ? Number(v) : 0));
  return d * 86400 + h * 3600 + min * 60 + s;
}
