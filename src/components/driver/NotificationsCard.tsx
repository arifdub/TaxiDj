"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Check, X } from "lucide-react";
import { Button } from "@/components/ui";
import { getPushState, sendTestPush, turnOffPush, turnOnPush, type PushState } from "@/lib/push/client";

// Driver push notifications ("a passenger added a song"), shown in Settings
// and, until turned on or dismissed, as a banner on the ride screen.

const BANNER_KEY = "taxidj-push-banner-dismissed";

function usePush() {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/config")
      .then((r) => r.json())
      .then((c) => !cancelled && setConfigured(Boolean(c.push)))
      .catch(() => !cancelled && setConfigured(false));
    getPushState()
      .then((s) => !cancelled && setState(s))
      .catch(() => !cancelled && setState("unsupported"));
    return () => {
      cancelled = true;
    };
  }, []);

  const run = useCallback(async (fn: () => Promise<PushState | void>, done?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      const next = await fn();
      if (next) setState(next);
      if (done) setMessage(done);
    } catch {
      setMessage("That didn't work. Please try again.");
    } finally {
      setBusy(false);
    }
  }, []);

  return { configured, state, busy, message, run };
}

export function NotificationsSetting() {
  const { configured, state, busy, message, run } = usePush();
  if (configured === null || state === null) return null;

  return (
    <section className="rounded-3xl border border-line bg-night-2 p-4">
      <h2 className="flex items-center gap-2 text-lg font-black">
        <Bell className="size-5 text-taxi" aria-hidden /> Notifications
      </h2>
      <p className="mt-1 text-sm text-mist">
        Get a notification when a passenger adds a song, even when Taxi DJ is closed or the phone is locked.
      </p>
      <div className="mt-4">
        {!configured ? (
          <KeyMaker />
        ) : state === "needs-install" ? (
          <p className="text-sm text-white">
            On iPhone, notifications only work from the Home Screen app: add Taxi DJ to your Home Screen (Share → Add
            to Home Screen), open it from there, and turn notifications on here.
          </p>
        ) : state === "unsupported" ? (
          <p className="text-sm text-mist">This browser can&apos;t show notifications.</p>
        ) : state === "denied" ? (
          <p className="text-sm text-white">
            Notifications are blocked for Taxi DJ. Allow them in your phone&apos;s Settings (Notifications → Taxi DJ, or
            your browser&apos;s site settings), then come back here.
          </p>
        ) : state === "on" ? (
          <div className="space-y-3">
            <p className="flex items-center gap-2 font-bold text-go">
              <Check className="size-5" aria-hidden /> Notifications are on for this phone
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="dark" loading={busy} onClick={() => run(async () => { await sendTestPush(); }, "Test sent. It should arrive in a few seconds.")}>
                <BellRing className="size-5" aria-hidden /> Send test
              </Button>
              <Button variant="dark" disabled={busy} onClick={() => run(turnOffPush)}>
                <BellOff className="size-5" aria-hidden /> Turn off
              </Button>
            </div>
          </div>
        ) : (
          <Button className="w-full" loading={busy} onClick={() => run(turnOnPush)}>
            <Bell className="size-5" aria-hidden /> Turn on notifications
          </Button>
        )}
        {message && <p className="mt-3 text-sm text-mist" role="status">{message}</p>}
      </div>
    </section>
  );
}

/** One-time nudge on the ride screen while notifications are off. */
export function NotificationsBanner() {
  const { configured, state, busy, run } = usePush();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return typeof window !== "undefined" && localStorage.getItem(BANNER_KEY) === "1";
    } catch {
      return false;
    }
  });
  if (!configured || state !== "off" || dismissed) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(BANNER_KEY, "1");
    } catch {
      // ignore
    }
    setDismissed(true);
  };
  return (
    <div className="flex items-center gap-3 rounded-3xl border border-taxi/40 bg-taxi/10 p-3">
      <Bell className="size-6 shrink-0 text-taxi" aria-hidden />
      <p className="min-w-0 flex-1 text-sm font-semibold">Get a notification when passengers add songs</p>
      <Button size="md" loading={busy} onClick={() => run(turnOnPush)} className="shrink-0 px-3">
        Turn on
      </Button>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="grid size-11 shrink-0 place-items-center rounded-full text-mist hover:bg-white/5">
        <X className="size-5" aria-hidden />
      </button>
    </div>
  );
}

const b64url = (buf: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

/**
 * Setup helper shown until notifications are configured: creates the
 * notification key pair right here in the browser (nothing is sent
 * anywhere) so the owner can paste it into Vercel.
 */
function KeyMaker() {
  const [keys, setKeys] = useState<{ publicKey: string; privateKey: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function make() {
    const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
    const raw = await crypto.subtle.exportKey("raw", pair.publicKey);
    const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
    setKeys({ publicKey: b64url(raw), privateKey: jwk.d! });
  }

  async function copy(label: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
    } catch {
      setCopied(null);
    }
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-white">Notifications aren&apos;t set up yet. One-time setup for the owner:</p>
      {!keys ? (
        <Button variant="dark" className="w-full" onClick={make}>
          Create notification keys
        </Button>
      ) : (
        <div className="space-y-3">
          {(
            [
              ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", keys.publicKey],
              ["VAPID_PRIVATE_KEY", keys.privateKey],
            ] as const
          ).map(([name, value]) => (
            <div key={name} className="rounded-2xl bg-night-3 p-3">
              <p className="font-mono text-xs font-bold text-taxi">{name}</p>
              <p className="mt-1 break-all font-mono text-xs text-white">{value}</p>
              <Button variant="dark" size="md" className="mt-2 w-full" onClick={() => copy(name, value)}>
                {copied === name ? "Copied!" : "Copy"}
              </Button>
            </div>
          ))}
          <p className="text-mist">
            These keys were made on this phone and haven&apos;t been sent anywhere. Add both in Vercel → your project →
            Settings → Environment Variables (with the names shown), then redeploy. Keep the private key secret.
          </p>
        </div>
      )}
    </div>
  );
}
