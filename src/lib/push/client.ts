"use client";

// Browser side of driver push notifications.

import { supabase } from "@/lib/supabase/client";

export type PushState =
  | "unsupported" // browser can't do push
  | "needs-install" // iPhone/iPad: only works from the Home Screen app
  | "denied" // the user blocked notifications
  | "off"
  | "on";

const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

async function registration() {
  return navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" });
}

export async function getPushState(): Promise<PushState> {
  if (typeof window === "undefined") return "unsupported";
  if (isIOS() && !isStandalone()) return "needs-install";
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  return sub && Notification.permission === "granted" ? "on" : "off";
}

function base64ToBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Asks for permission (must be called from a tap) and saves the subscription. */
export async function turnOnPush(): Promise<PushState> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key || !pushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const reg = await registration();
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64ToBytes(key) }));
  const json = sub.toJSON();
  const { error } = await supabase().rpc("save_push_subscription", {
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh,
    p_auth: json.keys?.auth,
  });
  if (error) throw new Error(error.message);
  return "on";
}

export async function turnOffPush(): Promise<PushState> {
  const reg = await navigator.serviceWorker.getRegistration("/");
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await supabase().rpc("delete_push_subscription", { p_endpoint: sub.endpoint });
    await sub.unsubscribe();
  }
  return "off";
}

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase().auth.getSession();
  return data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {};
}

export async function sendTestPush(): Promise<number> {
  const res = await fetch("/api/push/test", { method: "POST", headers: await authHeader() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? "FAILED");
  return data.sent ?? 0;
}

/** Passenger side: tell the server a song was added, so the driver gets a notification. */
export async function notifyDriverOfRequest(requestId: string) {
  try {
    await fetch("/api/push/new-request", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeader()) },
      body: JSON.stringify({ requestId }),
      keepalive: true,
    });
  } catch {
    // Notifications are best-effort; the song is already in the queue.
  }
}
