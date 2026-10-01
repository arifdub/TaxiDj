import { NextResponse } from "next/server";
import { isPushConfigured, notifyDriver } from "@/lib/push/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { supabaseAdmin, userFromRequest } from "@/lib/supabase/admin";

// POST /api/push/new-request { requestId }
// Called by the passenger's browser right after adding a song. Notifies the
// ride's driver once per song. Only the passenger who added the song, within
// a few minutes, can trigger it.
export async function POST(req: Request) {
  if (!isPushConfigured()) return NextResponse.json({ sent: 0, configured: false });
  if (!rateLimit(`push:${clientKey(req)}`, 20)) return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });

  const { requestId } = (await req.json().catch(() => ({}))) as { requestId?: string };
  if (typeof requestId !== "string" || !/^[0-9a-f-]{36}$/i.test(requestId)) {
    return NextResponse.json({ error: "INVALID_REQUEST" }, { status: 400 });
  }
  const uid = await userFromRequest(req);
  if (!uid) return NextResponse.json({ error: "NOT_AUTHENTICATED" }, { status: 401 });

  const db = supabaseAdmin();
  const { data: song } = await db
    .from("song_requests")
    .select("id, title, artist, status, youtube_video_id, created_at, push_sent_at, ride_id, passenger:passengers(nickname, session_identifier), ride:rides(driver_id, status)")
    .eq("id", requestId)
    .maybeSingle();

  const passenger = song?.passenger as unknown as { nickname: string; session_identifier: string } | null;
  const ride = song?.ride as unknown as { driver_id: string; status: string } | null;
  const fresh = song && Date.now() - new Date(song.created_at).getTime() < 5 * 60_000;
  const skip =
    !song || !passenger || !ride
      ? "song not found"
      : passenger.session_identifier !== uid
        ? "not the passenger who added it"
        : ride.driver_id === uid
          ? "added from the driver's own sign-in (same phone/app as the driver)"
          : !fresh
            ? "song is older than 5 minutes"
            : null;
  if (skip) {
    // Visible in Vercel → Logs, to explain a missing notification.
    console.warn(`Push not sent for ${requestId}: ${skip}`);
    return NextResponse.json({ error: "NOT_FOUND", reason: skip }, { status: 404 });
  }
  if (!song || !passenger || !ride) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  // Claim the notification (only the first call sends it).
  const { data: claimed } = await db
    .from("song_requests")
    .update({ push_sent_at: new Date().toISOString() })
    .eq("id", song.id)
    .is("push_sent_at", null)
    .select("id");
  if (!claimed?.length) return NextResponse.json({ sent: 0 });

  const needsApproval = song.status === "pending";
  const sent = await notifyDriver(ride.driver_id, {
    title: needsApproval ? `🎵 ${passenger.nickname} wants to play a song` : `🎵 ${passenger.nickname} added a song`,
    body: `${song.title}${song.artist ? ` · ${song.artist}` : ""}${needsApproval ? "\nTap to approve it." : ""}`,
    url: `/driver/ride/${song.ride_id}/queue`,
    playUrl: needsApproval ? undefined : `https://music.youtube.com/watch?v=${song.youtube_video_id}`,
    tag: `ride-${song.ride_id}`,
  });
  if (sent === 0) console.warn(`Push for ${requestId}: the driver has no devices with notifications on`);
  return NextResponse.json({ sent });
}
