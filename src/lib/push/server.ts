import "server-only";

import webpush from "web-push";
import { isAdminConfigured, supabaseAdmin } from "@/lib/supabase/admin";

// Web Push (VAPID) sending for driver notifications.
//
// Needs (Vercel env): NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY,
// SUPABASE_SERVICE_ROLE_KEY; optional VAPID_SUBJECT (mailto: or https: URL).

export interface PushPayload {
  title: string;
  body: string;
  /** Taxi DJ page to open when the notification is tapped. */
  url: string;
  /** Opens the song straight in YouTube Music (Android notification button). */
  playUrl?: string;
  tag?: string;
}

export function isPushConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && isAdminConfigured());
}

let vapidSet = false;
function setup() {
  if (vapidSet) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || `mailto:notifications@${new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://taxidj.app").hostname}`,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  vapidSet = true;
}

/** Sends a notification to every device the driver turned notifications on for. */
export async function notifyDriver(driverId: string, payload: PushPayload): Promise<number> {
  setup();
  const db = supabaseAdmin();
  const { data: subs, error } = await db
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("driver_id", driverId);
  if (error) throw error;

  let sent = 0;
  await Promise.all(
    (subs ?? []).map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 600, urgency: "high", topic: payload.tag?.slice(0, 32) },
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        // The device unsubscribed or the subscription expired: forget it.
        if (status === 404 || status === 410) await db.from("push_subscriptions").delete().eq("id", s.id);
        else console.error("Push failed", status, (err as Error).message);
      }
    }),
  );
  return sent;
}
