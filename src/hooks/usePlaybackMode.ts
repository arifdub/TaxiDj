"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { getSavedPlaybackMode, savePlaybackMode } from "@/lib/api";
import type { PlaybackMode } from "@/lib/playback";
import { getSupabase } from "@/lib/supabase/client";

// Driver preference: play inside Taxi DJ or in the YouTube app.
// Saved to the driver's account (drivers.playback_mode) and cached locally so
// the right player shows instantly; the account value wins when it loads.
const KEY = "taxidj-playback-mode";
const EVENT = "taxidj-playback-mode";
let syncedFor: string | null = null;

function read(): PlaybackMode {
  try {
    return localStorage.getItem(KEY) === "external" ? "external" : "embedded";
  } catch {
    return "embedded";
  }
}

function writeLocal(mode: PlaybackMode) {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // Storage unavailable (private mode): the account copy still persists.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

/** Load the account's saved mode once per signed-in user. */
async function syncFromAccount() {
  const client = getSupabase();
  if (!client) return;
  const { data } = await client.auth.getSession();
  const uid = data.session?.user.id ?? null;
  if (!uid || syncedFor === uid) return;
  syncedFor = uid;
  const saved = await getSavedPlaybackMode().catch(() => null);
  if (saved && saved !== read()) writeLocal(saved);
}

export function usePlaybackMode() {
  const mode = useSyncExternalStore(subscribe, read, () => "embedded" as PlaybackMode);

  useEffect(() => {
    syncFromAccount();
  }, []);

  const setMode = useCallback((next: PlaybackMode) => {
    writeLocal(next);
    savePlaybackMode(next).catch(() => {
      // Offline or no driver profile: the local choice still applies.
    });
  }, []);

  return [mode, setMode] as const;
}
