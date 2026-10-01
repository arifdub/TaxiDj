"use client";

import { useCallback, useSyncExternalStore } from "react";

// "Auto-play new songs" (per device, on by default): when the in-app player
// is idle and a passenger adds a song, it starts playing by itself.

const KEY = "taxidj-autoplay-new";
const EVENT = "taxidj-autoplay-new";

function read() {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

export function useAutoPlayNew() {
  const on = useSyncExternalStore(subscribe, read, () => true);
  const set = useCallback((next: boolean) => {
    try {
      localStorage.setItem(KEY, next ? "on" : "off");
    } catch {
      // Not saved: resets on reload.
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [on, set] as const;
}
