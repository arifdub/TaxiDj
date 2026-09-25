"use client";

import { useCallback, useSyncExternalStore } from "react";

// How the in-app player shows outside the Player tab (per device):
// a full-width bar above the tabs, or a small floating window the driver
// can drag anywhere on screen.
export type DockLayout = "bar" | "float";

/** Floating window position, as a fraction (0–1) of the free space. */
export interface DockPosition {
  x: number;
  y: number;
}

const KEY = "taxidj-dock-layout";
const POS_KEY = "taxidj-dock-position";
const EVENT = "taxidj-dock-layout";
const DEFAULT_POS: DockPosition = { x: 1, y: 0.8 };

function read(): DockLayout {
  try {
    const v = localStorage.getItem(KEY);
    // "left" / "right" were the earlier corner layouts.
    return v === "float" || v === "left" || v === "right" ? "float" : "bar";
  } catch {
    return "bar";
  }
}

const clamp = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : null);

let cachedRaw: string | null | undefined;
let cachedPos: DockPosition = DEFAULT_POS;

function readPos(): DockPosition {
  let raw: string | null = null;
  let legacy: string | null = null;
  try {
    raw = localStorage.getItem(POS_KEY);
    legacy = localStorage.getItem(KEY);
  } catch {
    // Storage unavailable: use the default.
  }
  const key = raw ?? `legacy:${legacy}`;
  if (key === cachedRaw) return cachedPos;
  cachedRaw = key;
  cachedPos = DEFAULT_POS;
  if (raw) {
    try {
      const p = JSON.parse(raw);
      const x = clamp(p?.x);
      const y = clamp(p?.y);
      if (x !== null && y !== null) cachedPos = { x, y };
    } catch {
      // Ignore a damaged value.
    }
  } else if (legacy === "left") {
    cachedPos = { x: 0, y: DEFAULT_POS.y };
  }
  return cachedPos;
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: resets on reload.
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useDockLayout() {
  const layout = useSyncExternalStore(subscribe, read, () => "bar" as DockLayout);
  const position = useSyncExternalStore(subscribe, readPos, () => DEFAULT_POS);
  const setLayout = useCallback((next: DockLayout) => save(KEY, next), []);
  const setPosition = useCallback(
    (next: DockPosition) => save(POS_KEY, JSON.stringify({ x: clamp(next.x) ?? 1, y: clamp(next.y) ?? 1 })),
    [],
  );
  return { layout, setLayout, position, setPosition };
}
