import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { isValidVideoId } from "@/lib/youtube/parse";
import { lookupVideo, YouTubeError } from "@/lib/youtube/service";

// GET /api/youtube/video?id=fHI8X4OXluQ
// Returns title/channel/thumbnail/duration for a pasted link's video ID.
// Works without YOUTUBE_API_KEY (falls back to YouTube oEmbed).
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!isValidVideoId(id)) {
    return NextResponse.json({ error: "INVALID_VIDEO" }, { status: 400 });
  }
  if (!rateLimit(`video:${clientKey(req)}`, 60)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  try {
    const video = await lookupVideo(id);
    return NextResponse.json(
      { video },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (err) {
    const code = err instanceof YouTubeError ? err.code : "UPSTREAM";
    if (code !== "NOT_FOUND") console.error("YouTube lookup failed", err);
    return NextResponse.json({ error: code }, { status: code === "NOT_FOUND" ? 404 : 502 });
  }
}
