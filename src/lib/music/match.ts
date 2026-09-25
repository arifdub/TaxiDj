import type { VideoResult } from "@/lib/types";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Picks the YouTube video that best matches a Spotify track: prefers the
 * official audio/video (artist channel, "- Topic", VEVO), a close duration,
 * and avoids covers/live/remix versions the track title doesn't mention.
 */
export function pickBestMatch(
  candidates: VideoResult[],
  track: { title: string; artist: string; durationSeconds: number | null },
): VideoResult | null {
  return rankMatches(candidates, track)[0] ?? null;
}

/** All candidates, best match first. */
export function rankMatches(
  candidates: VideoResult[],
  track: { title: string; artist: string; durationSeconds: number | null },
): VideoResult[] {
  const title = norm(track.title);
  const firstArtist = norm(track.artist.split(",")[0] ?? "");
  const unwanted = ["cover", "live", "remix", "karaoke", "instrumental", "sped up", "slowed", "8d"].filter(
    (w) => !title.includes(w),
  );

  const score = (v: VideoResult) => {
    const vt = norm(v.title);
    const ch = norm(v.channel ?? "");
    let s = 0;
    if (vt.includes(title)) s += 3;
    if (firstArtist && (ch.includes(firstArtist) || vt.includes(firstArtist))) s += 3;
    if (/ topic$|vevo|official/.test(ch) || vt.includes("official")) s += 1;
    if (track.durationSeconds && v.durationSeconds) {
      const diff = Math.abs(track.durationSeconds - v.durationSeconds);
      s += diff <= 5 ? 3 : diff <= 15 ? 2 : diff <= 40 ? 0 : -2;
    }
    for (const w of unwanted) if (vt.includes(w)) s -= 3;
    return s;
  };

  return [...candidates].sort((a, b) => score(b) - score(a));
}
