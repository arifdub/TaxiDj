import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { isSoundCloudConfigured, SoundCloudError, searchSoundCloud } from "@/lib/soundcloud/service";

// GET /api/soundcloud/search?q=… (or a pasted soundcloud.com link)
export async function GET(req: Request) {
  if (!isSoundCloudConfigured()) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1 || q.length > 300) return NextResponse.json({ error: "INVALID_QUERY" }, { status: 400 });
  if (!rateLimit(`scsearch:${clientKey(req)}`, 30)) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  try {
    return NextResponse.json(
      { results: await searchSoundCloud(q) },
      { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } },
    );
  } catch (err) {
    const code = err instanceof SoundCloudError ? err.code : "UPSTREAM";
    console.error("SoundCloud search failed", err);
    return NextResponse.json({ error: code }, { status: code === "NOT_FOUND" ? 404 : 502 });
  }
}
