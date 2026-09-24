import { NextResponse } from "next/server";
import { isYouTubeSearchConfigured } from "@/lib/youtube/service";

// Tells the client which optional integrations are configured (no secrets).
export function GET() {
  return NextResponse.json({ youtubeSearch: isYouTubeSearchConfigured() });
}
