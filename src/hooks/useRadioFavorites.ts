"use client";

import { useCallback, useSyncExternalStore } from "react";
import type { RadioStation } from "@/lib/radio/stations";

// Favourite radio stations, saved on this device (newest first).

const KEY = "taxidj-radio-favorites";
const EVENT = "taxidj-radio-favorites";
const MAX = 30;
const EMPTY: RadioStation[] = [];

let cachedRaw: string | null = null;
let cached: RadioStation[] = EMPTY;

function read(): RadioStation[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cachedRaw) return cached;
  cachedRaw = raw;
  try {
    const list = raw ? (JSON.parse(raw) as RadioStation[]) : [];
    cached = Array.isArray(list) ? list.filter((s) => s && typeof s.id === "string" && typeof s.streamUrl === "string") : EMPTY;
  } catch {
    cached = EMPTY;
  }
  return cached;
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

function write(list: RadioStation[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
  } catch {
    // Storage full or blocked: favourites just aren't saved.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useRadioFavorites() {
  const favorites = useSyncExternalStore(subscribe, read, () => EMPTY);
  const isFavorite = useCallback((id: string) => favorites.some((s) => s.id === id), [favorites]);
  const toggleFavorite = useCallback((station: RadioStation) => {
    const list = read();
    write(list.some((s) => s.id === station.id) ? list.filter((s) => s.id !== station.id) : [station, ...list]);
  }, []);
  return { favorites, isFavorite, toggleFavorite };
}
