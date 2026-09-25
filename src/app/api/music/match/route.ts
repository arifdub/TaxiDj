import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { isYouTubeSearchConfigured, searchVideos, YouTubeError } from "@/lib/youtube/service";
import { rankMatches } from "@/lib/music/match";

// GET /api/music/match?title=&artist=&duration= — finds the YouTube video(s) for a
// Spotify track so it can play through YouTube (in-app player / YouTube app).
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const title = params.get("title")?.trim().slice(0, 150) ?? "";
  const artist = params.get("artist")?.trim().slice(0, 150) ?? "";
  const duration = Number(params.get("duration")) || null;
  if (!title) return NextResponse.json({ error: "INVALID_QUERY" }, { status: 400 });
  if (!isYouTubeSearchConfigured()) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  if (!rateLimit(`match:${clientKey(req)}`, 20)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }
  try {
    const candidates = await searchVideos(`${artist} ${title}`.trim(), 5);
    const ranked = rankMatches(candidates, { title, artist, durationSeconds: duration });
    if (!ranked.length) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    // ?list=1 returns the ranked choices so the rider can pick the right version.
    return NextResponse.json(
      { video: ranked[0], videos: ranked },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (err) {
    const code = err instanceof YouTubeError ? err.code : "UPSTREAM";
    console.error("Spotify→YouTube match failed", err);
    return NextResponse.json({ error: code }, { status: 502 });
  }
}
