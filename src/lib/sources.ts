import type { SongRequest } from "@/lib/types";

// Where a queue song plays from. YouTube songs use YouTube's player; every
// other song (SoundCloud, audio file links) plays in a plain audio player,
// like the radio, so it keeps going in the background.

type Source = Pick<SongRequest, "provider" | "youtube_url" | "soundcloud_url" | "soundcloud_track_id" | "audio_url">;

/** True for songs that play in the plain audio player. */
export const playsAsAudio = (s: Pick<SongRequest, "provider">) => s.provider !== "youtube";

/** What the audio player loads for this song (null for YouTube songs). */
export function audioSrcFor(s: Pick<SongRequest, "provider" | "soundcloud_track_id" | "audio_url">): string | null {
  if (s.provider === "soundcloud" && s.soundcloud_track_id) {
    return `/api/soundcloud/stream?id=${encodeURIComponent(s.soundcloud_track_id)}`;
  }
  if (s.provider === "audio" && s.audio_url) return s.audio_url;
  return null;
}

/** The song's own page or file, to open outside Taxi DJ. */
export const sourceUrl = (s: Source) => s.youtube_url ?? s.soundcloud_url ?? s.audio_url ?? "#";

/** Short name of where the song comes from. */
export const sourceName = (s: Pick<SongRequest, "provider">) =>
  s.provider === "soundcloud" ? "SoundCloud" : s.provider === "audio" ? "Audio file" : "YouTube";
