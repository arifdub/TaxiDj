import { NextResponse } from "next/server";
import { isPushConfigured, notifyDriver } from "@/lib/push/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { supabaseAdmin } from "@/lib/supabase/admin";

// POST /api/push/car-request { code }
// A passenger scanned the permanent car QR code while no ride is running and
// tapped "Ask the driver to turn on the music". Sends the driver a fixed
// notification (no free text), at most once a minute per car.
export async function POST(req: Request) {
  if (!isPushConfigured()) return NextResponse.json({ sent: 0, reason: "NOT_CONFIGURED" });

  const { code } = (await req.json().catch(() => ({}))) as { code?: string };
  const carCode = typeof code === "string" ? code.trim().toUpperCase() : "";
  if (!/^[A-HJ-NP-Z2-9]{8}$/.test(carCode)) return NextResponse.json({ error: "INVALID_CODE" }, { status: 400 });

  if (!rateLimit(`carreq-ip:${clientKey(req)}`, 3)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }

  const db = supabaseAdmin();
  const { data: driver } = await db.from("drivers").select("id").eq("car_code", carCode).maybeSingle();
  if (!driver) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Ride already running: nothing to ask for.
  const { data: active } = await db
    .from("rides")
    .select("join_code")
    .eq("driver_id", driver.id)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (active) return NextResponse.json({ sent: 0, joinCode: active.join_code });

  // One request a minute per car is plenty (several passengers may tap).
  if (!rateLimit(`carreq:${carCode}`, 1)) return NextResponse.json({ sent: 1, alreadyAsked: true });

  const sent = await notifyDriver(driver.id, {
    title: "🎵 A passenger would like some music",
    body: "Someone in your car scanned your Taxi DJ card. Tap to start a ride and turn the music on.",
    url: "/driver/ride/new?from=request",
    tag: "car-request",
  });
  return NextResponse.json({ sent });
}
