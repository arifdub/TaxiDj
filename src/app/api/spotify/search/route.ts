import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { isSpotifyConfigured, searchTracks, SpotifyError } from "@/lib/spotify/service";

// GET /api/spotify/search?q=blinding+lights — Spotify track search (server-side keys).
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (!isSpotifyConfigured()) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  if (q.length < 1 || q.length > 100) return NextResponse.json({ error: "INVALID_QUERY" }, { status: 400 });
  if (!rateLimit(`spotify:${clientKey(req)}`, 30)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }
  try {
    const results = await searchTracks(q);
    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch (err) {
    const code = err instanceof SpotifyError ? err.code : "UPSTREAM";
    console.error("Spotify search failed", err);
    return NextResponse.json({ error: code }, { status: code === "RATE_LIMITED" ? 429 : 502 });
  }
}
