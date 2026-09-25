import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { isValidSpotifyTrackId } from "@/lib/spotify/parse";
import { getTrack, isSpotifyConfigured, SpotifyError } from "@/lib/spotify/service";

// GET /api/spotify/track?id=… — metadata for a pasted Spotify track link.
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!isSpotifyConfigured()) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  if (!isValidSpotifyTrackId(id)) return NextResponse.json({ error: "INVALID_TRACK" }, { status: 400 });
  if (!rateLimit(`spotify:${clientKey(req)}`, 30)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }
  try {
    const track = await getTrack(id);
    return NextResponse.json(
      { track },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (err) {
    const code = err instanceof SpotifyError ? err.code : "UPSTREAM";
    return NextResponse.json({ error: code }, { status: code === "NOT_FOUND" ? 404 : 502 });
  }
}
