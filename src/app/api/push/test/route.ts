import { NextResponse } from "next/server";
import { isPushConfigured, notifyDriver } from "@/lib/push/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { userFromRequest } from "@/lib/supabase/admin";

// POST /api/push/test — the signed-in driver sends themselves a test notification.
export async function POST(req: Request) {
  if (!isPushConfigured()) return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  if (!rateLimit(`pushtest:${clientKey(req)}`, 5)) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  const uid = await userFromRequest(req);
  if (!uid) return NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });
  const sent = await notifyDriver(uid, {
    title: "🎵 Taxi DJ notifications are on",
    body: "You'll get a notification like this when a passenger adds a song.",
    url: "/",
    tag: "test",
  });
  return NextResponse.json({ sent });
}
