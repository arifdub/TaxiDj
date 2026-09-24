// Playback abstraction.
//
// Taxi DJ keeps the *queue* (Supabase) separate from the *media source*.
// The UI asks a PlaybackProvider to play a queue item and reads its
// capabilities to decide which controls are real.
//
// MVP provider: "external-youtube" hands the song to the official YouTube /
// YouTube Music app (or youtube.com) via its normal link. iOS then routes audio
// to CarPlay like any other app. Taxi DJ never downloads, proxies or
// re-streams media.
//
// Future providers (e.g. a native iOS app with an officially-permitted player
// integration, surfaced on CarPlay) implement the same interface and can
// report remoteControl/progress/volume capabilities, without UI redesign.

import type { SongRequest } from "@/lib/types";

export interface PlaybackCapabilities {
  /** Provider can pause/resume/seek programmatically. */
  remoteControl: boolean;
  /** Provider reports real playback position. */
  progress: boolean;
  /** Provider can read/set volume. */
  volume: boolean;
}

export interface PlaybackProvider {
  id: string;
  /** Human label for the action, e.g. "Play on YouTube". */
  actionLabel: string;
  capabilities: PlaybackCapabilities;
  /** URL the driver's device should open to play this item (link-based providers). */
  urlFor(item: Pick<SongRequest, "youtube_url">): string;
}

export const externalYouTubeProvider: PlaybackProvider = {
  id: "external-youtube",
  actionLabel: "Play on YouTube",
  capabilities: { remoteControl: false, progress: false, volume: false },
  urlFor: (item) => item.youtube_url,
};

export const playback: PlaybackProvider = externalYouTubeProvider;
