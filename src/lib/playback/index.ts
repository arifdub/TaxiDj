// Playback abstraction.
//
// Taxi DJ keeps the *queue* (Supabase) separate from the *media source*.
// The UI asks a PlaybackProvider to play a queue item and reads its
// capabilities to decide which controls are real.
//
// Providers:
// * "embedded"  — YouTube's official IFrame Player inside Taxi DJ. Real
//                 play/pause/stop/seek/volume and auto-advance to the next
//                 song. (src/components/driver/PlayerProvider.tsx)
// * "external"  — hands the song to the official YouTube / YouTube Music app
//                 via its normal link. The app keeps playing in the
//                 background / with the screen locked, and through CarPlay.
//
// Taxi DJ never downloads, proxies or re-streams media. A future native
// iOS/CarPlay provider can implement the same interface.

import type { SongRequest } from "@/lib/types";

export type PlaybackMode = "embedded" | "external";

export interface PlaybackCapabilities {
  /** Provider can pause/resume/seek programmatically. */
  remoteControl: boolean;
  /** Provider reports real playback position. */
  progress: boolean;
  /** Provider can read/set volume. */
  volume: boolean;
}

export interface PlaybackProvider {
  id: PlaybackMode;
  /** Human label for the action, e.g. "Play on YouTube". */
  actionLabel: string;
  capabilities: PlaybackCapabilities;
  /** URL that opens this item in the official YouTube experience. */
  urlFor(item: Pick<SongRequest, "youtube_url">): string;
}

export const externalYouTubeProvider: PlaybackProvider = {
  id: "external",
  actionLabel: "Play on YouTube",
  capabilities: { remoteControl: false, progress: false, volume: false },
  urlFor: (item) => item.youtube_url,
};

export const embeddedYouTubeProvider: PlaybackProvider = {
  id: "embedded",
  actionLabel: "Play",
  capabilities: { remoteControl: true, progress: true, volume: true },
  urlFor: (item) => item.youtube_url,
};

export function providerFor(mode: PlaybackMode): PlaybackProvider {
  return mode === "embedded" ? embeddedYouTubeProvider : externalYouTubeProvider;
}

/** Kept for code that only needs link-based playback. */
export const playback: PlaybackProvider = externalYouTubeProvider;
