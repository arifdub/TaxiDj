import { NextResponse } from "next/server";
import { isPushConfigured } from "@/lib/push/server";
import { isSoundCloudConfigured } from "@/lib/soundcloud/service";
import { isSpotifyConfigured } from "@/lib/spotify/service";
import { isYouTubeSearchConfigured } from "@/lib/youtube/service";

// Tells the client which optional integrations are configured (no secrets).
export function GET() {
  const youtubeSearch = isYouTubeSearchConfigured();
  return NextResponse.json({
    youtubeSearch,
    // Spotify songs play through their YouTube match, so YouTube search is
    // required. Pasted Spotify links need no Spotify keys; search does.
    spotifyLinks: youtubeSearch,
    spotifySearch: youtubeSearch && isSpotifyConfigured(),
    // Push notifications for drivers (VAPID keys + server key set).
    push: isPushConfigured(),
    // SoundCloud search + background playback (app credentials set).
    soundcloud: isSoundCloudConfigured(),
  });
}
