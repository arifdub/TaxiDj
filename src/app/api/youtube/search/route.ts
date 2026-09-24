import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { isYouTubeSearchConfigured, searchVideos, YouTubeError } from "@/lib/youtube/service";

// GET /api/youtube/search?q=blinding+lights
// Proxies the official YouTube Data API so the API key stays on the server.
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";

  if (!isYouTubeSearchConfigured()) {
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  }
  if (q.length < 1 || q.length > 100) {
    return NextResponse.json({ error: "INVALID_QUERY" }, { status: 400 });
  }
  if (!rateLimit(`search:${clientKey(req)}`, 30)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  try {
    const results = await searchVideos(q);
    return NextResponse.json(
      { results },
      // Identical searches are served from Vercel's CDN to save API quota.
      { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
    );
  } catch (err) {
    const code = err instanceof YouTubeError ? err.code : "UPSTREAM";
    console.error("YouTube search failed", err);
    return NextResponse.json({ error: code }, { status: code === "QUOTA" ? 503 : 502 });
  }
}
