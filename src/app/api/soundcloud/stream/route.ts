import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { isSoundCloudConfigured, SoundCloudError, soundCloudStreamUrl } from "@/lib/soundcloud/service";

// GET /api/soundcloud/stream?id=123
// Redirects the player to SoundCloud's own (short-lived) stream URL for the
// track. Audio goes straight from SoundCloud to the phone; nothing passes
// through or is stored by Taxi DJ.
export async function GET(req: Request) {
  if (!isSoundCloudConfigured()) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!/^\d{1,20}$/.test(id)) return NextResponse.json({ error: "INVALID_ID" }, { status: 400 });
  if (!rateLimit(`scstream:${clientKey(req)}`, 60)) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  try {
    const url = await soundCloudStreamUrl(id);
    return NextResponse.redirect(url, { status: 302, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    const code = err instanceof SoundCloudError ? err.code : "UPSTREAM";
    return NextResponse.json({ error: code }, { status: code === "NOT_FOUND" || code === "NOT_PLAYABLE" ? 404 : 502 });
  }
}
