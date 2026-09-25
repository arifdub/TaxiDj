import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { lookupSpotifyLink } from "@/lib/spotify/oembed";
import { isValidSpotifyTrackId } from "@/lib/spotify/parse";

// GET /api/spotify/link?id=… — title + cover for a pasted Spotify song link.
// Works without Spotify API keys (uses Spotify's public oEmbed).
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!isValidSpotifyTrackId(id)) return NextResponse.json({ error: "INVALID_TRACK" }, { status: 400 });
  if (!rateLimit(`spotify-link:${clientKey(req)}`, 30)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }
  try {
    const track = await lookupSpotifyLink(id);
    if (!track) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    return NextResponse.json(
      { track },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (err) {
    console.error("Spotify link lookup failed", err);
    return NextResponse.json({ error: "UPSTREAM" }, { status: 502 });
  }
}
