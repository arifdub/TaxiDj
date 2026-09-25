import { NextResponse } from "next/server";
import { isSpotifyConfigured } from "@/lib/spotify/service";
import { isYouTubeSearchConfigured } from "@/lib/youtube/service";

// Tells the client which optional integrations are configured (no secrets).
export function GET() {
  const youtubeSearch = isYouTubeSearchConfigured();
  // Spotify songs are matched to YouTube for playback, so both are needed.
  return NextResponse.json({ youtubeSearch, spotifySearch: isSpotifyConfigured() && youtubeSearch });
}
