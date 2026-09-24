"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { PlaybackMode } from "@/lib/playback";

// Per-device driver preference: play inside Taxi DJ or in the YouTube app.
const KEY = "taxidj-playback-mode";
const EVENT = "taxidj-playback-mode";

function read(): PlaybackMode {
  try {
    return localStorage.getItem(KEY) === "external" ? "external" : "embedded";
  } catch {
    return "embedded";
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

export function usePlaybackMode() {
  const mode = useSyncExternalStore(subscribe, read, () => "embedded" as PlaybackMode);
  const setMode = useCallback((next: PlaybackMode) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage unavailable (private mode): preference won't persist.
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [mode, setMode] as const;
}
