"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowDown, ArrowUp, Download, EllipsisVertical, Plus, Share, SquarePlus, X } from "lucide-react";

// "Add Taxi DJ to your Home Screen" pop-up, shown each time the site is
// opened in a browser (not in the installed app). Closing it hides it until
// the next visit.
//
// * iPhone/iPad Safari: iOS has no install API, so it points an arrow at
//   Safari's Share button and explains "Add to Home Screen".
// * Chrome on iPhone: the Share button is in the address bar (top right).
// * Android / desktop Chrome & Edge: a real "Install" button using the
//   browser's install prompt (beforeinstallprompt). If the browser doesn't
//   offer one (e.g. Firefox), it explains the ⋮ menu instead.
//
// Passenger pages (/join/…) are skipped: riders never need to install.

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "ios-safari" | "ipad-safari" | "ios-chrome" | "ios-other" | "android" | "other" | "installed";

// ---------------------------------------------------------------- stores ----

let installEvent: BeforeInstallPromptEvent | null = null;
let installed = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  // Registered as soon as this module loads so an early event isn't missed.
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // show our pop-up instead of the browser's mini-bar
    installEvent = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    installed = true;
    installEvent = null;
    emit();
  });
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const DISMISS_KEY = "taxidj-install-dismissed";

function readDismissed() {
  try {
    return sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function detectPlatform(): Platform {
  const nav = navigator as Navigator & { standalone?: boolean };
  if (installed || nav.standalone || window.matchMedia("(display-mode: standalone)").matches) return "installed";
  const ua = navigator.userAgent;
  const iPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const iOS = iPad || /iPhone|iPod/.test(ua);
  if (iOS) {
    if (/CriOS/.test(ua)) return "ios-chrome";
    // Other iOS browsers and in-app browsers (Instagram, Facebook, Google app…).
    if (/FxiOS|EdgiOS|OPiOS|GSA|FBAN|FBAV|Instagram|Line\//.test(ua) || !/Safari/.test(ua)) return "ios-other";
    return iPad ? "ipad-safari" : "ios-safari";
  }
  if (/Android/.test(ua)) return "android";
  return "other";
}

const getPlatform = detectPlatform;

// ------------------------------------------------------------- component ----

export function InstallPrompt() {
  const pathname = usePathname();
  const platform = useSyncExternalStore(subscribe, getPlatform, () => null);
  const event = useSyncExternalStore(subscribe, () => installEvent, () => null);
  const dismissed = useSyncExternalStore(subscribe, readDismissed, () => true);
  // Short delay so the pop-up doesn't flash over the page as it loads, and
  // so Android has time to offer its install prompt.
  const [ready, setReady] = useState(false);
  // Android: wait longer before falling back to menu instructions.
  const [late, setLate] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 1500);
    const t2 = setTimeout(() => setLate(true), 5000);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, []);

  const passengerPage = pathname.startsWith("/join") || pathname.startsWith("/reset-password");
  if (!ready || dismissed || passengerPage || !platform || platform === "installed") return null;
  // Desktop / others: only when the browser can actually install.
  if (platform === "other" && !event) return null;
  if (platform === "android" && !event && !late) return null;

  const close = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // Storage blocked: it just closes for now.
    }
    emit();
  };

  const install = async () => {
    if (!event) return;
    await event.prompt();
    const { outcome } = await event.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    installEvent = null;
    if (outcome === "accepted") installed = true;
    close();
  };

  // Where the browser's own button is, for the pointing arrow.
  const arrowAt: "bottom" | "top-right" | null =
    platform === "ios-safari" ? "bottom" : platform === "ipad-safari" || platform === "ios-chrome" ? "top-right" : null;
  const atTop = arrowAt === "top-right" || (platform === "android" && !event);

  return (
    <div
      role="dialog"
      aria-label="Add Taxi DJ to your Home Screen"
      className={`fixed inset-x-3 z-50 mx-auto max-w-sm animate-fade-in print:hidden ${atTop ? "top-3" : "bottom-3"}`}
      style={atTop ? { top: "max(0.75rem, env(safe-area-inset-top))" } : { bottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      {arrowAt === "top-right" && (
        <ArrowUp aria-hidden className="mb-1 ml-auto mr-2 size-8 animate-bounce text-taxi drop-shadow" strokeWidth={3} />
      )}
      {platform === "android" && !event && (
        <ArrowUp aria-hidden className="mb-1 ml-auto -mr-1 size-8 animate-bounce text-taxi drop-shadow" strokeWidth={3} />
      )}
      <div className="relative rounded-3xl border border-taxi/50 bg-night-2 p-4 text-white shadow-[0_10px_40px_-5px_rgba(0,0,0,0.85)]">
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-2 top-2 grid size-9 place-items-center rounded-full text-mist hover:bg-white/10 hover:text-white"
        >
          <X className="size-5" aria-hidden />
        </button>
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/192" alt="" className="size-11 shrink-0 rounded-xl" />
          <div className="min-w-0 pr-7 text-sm">
            <p className="font-black">Add Taxi DJ to your Home Screen</p>
            <Steps platform={platform} canInstall={Boolean(event)} />
          </div>
        </div>
        {event && (
          <button
            type="button"
            onClick={install}
            className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-taxi font-black text-ink hover:bg-taxi-light"
          >
            <Download className="size-5" aria-hidden /> Install app
          </button>
        )}
      </div>
      {arrowAt === "bottom" && (
        <ArrowDown aria-hidden className="mx-auto mt-1 size-8 animate-bounce text-taxi drop-shadow" strokeWidth={3} />
      )}
    </div>
  );
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-0.5 inline-grid size-6 place-items-center rounded-md bg-night-3 align-middle text-taxi">{children}</span>
  );
}

function Steps({ platform, canInstall }: { platform: Platform; canInstall: boolean }) {
  const addToHome = (
    <>
      then <strong>Add to Home Screen</strong>{" "}
      <Icon>
        <SquarePlus className="size-4" aria-hidden />
      </Icon>
    </>
  );
  const share = (
    <Icon>
      <Share className="size-4" aria-label="Share" />
    </Icon>
  );

  if (canInstall) {
    return <p className="mt-1 text-mist">Opens full screen like an app, with its own icon. Free, no app store.</p>;
  }
  switch (platform) {
    case "ios-safari":
      return (
        <p className="mt-1 leading-relaxed text-mist">
          Tap the <strong className="text-white">Share</strong> button {share} in Safari&apos;s toolbar below, {addToHome}.
          <span className="mt-1 block text-xs">No Share button? Tap ••• first.</span>
        </p>
      );
    case "ipad-safari":
      return (
        <p className="mt-1 leading-relaxed text-mist">
          Tap the <strong className="text-white">Share</strong> button {share} at the top right, {addToHome}.
        </p>
      );
    case "ios-chrome":
      return (
        <p className="mt-1 leading-relaxed text-mist">
          Tap the <strong className="text-white">Share</strong> button {share} in the address bar, {addToHome}.
        </p>
      );
    case "ios-other":
      return (
        <p className="mt-1 leading-relaxed text-mist">
          Open this page in <strong className="text-white">Safari</strong>, tap Share {share}, {addToHome}.
        </p>
      );
    case "android":
      return (
        <p className="mt-1 leading-relaxed text-mist">
          Tap the browser menu{" "}
          <Icon>
            <EllipsisVertical className="size-4" aria-label="menu" />
          </Icon>{" "}
          at the top right, then <strong className="text-white">Install app</strong> or{" "}
          <strong className="text-white">Add to Home screen</strong>{" "}
          <Icon>
            <Plus className="size-4" aria-hidden />
          </Icon>
          .
        </p>
      );
    default:
      return null;
  }
}
