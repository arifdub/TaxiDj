"use client";

import type { SpotifyTrack, VideoResult } from "@/lib/types";

/**
 * Finds the YouTube video for a Spotify track (server does the search), and
 * returns it with the Spotify title/artist for nicer display.
 */
export async function matchSpotifyTrack(track: SpotifyTrack): Promise<VideoResult> {
  const params = new URLSearchParams({
    title: track.title,
    artist: track.artist,
    duration: String(track.durationSeconds),
  });
  const res = await fetch(`/api/music/match?${params}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.video) {
    throw new Error(res.status === 404 ? "NO_YOUTUBE_MATCH" : "MATCH_FAILED");
  }
  return {
    videoId: data.video.videoId,
    title: track.title,
    channel: track.artist,
    thumbnailUrl: data.video.thumbnailUrl,
    durationSeconds: track.durationSeconds,
  };
}
