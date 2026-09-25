"use client";

import { useCallback, useSyncExternalStore } from "react";

// Where the docked in-app player sits outside the Player tab (per device).
export type DockLayout = "bar" | "left" | "right";

const KEY = "taxidj-dock-layout";
const EVENT = "taxidj-dock-layout";

function read(): DockLayout {
  try {
    const v = localStorage.getItem(KEY);
    return v === "left" || v === "right" ? v : "bar";
  } catch {
    return "bar";
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

export function useDockLayout() {
  const layout = useSyncExternalStore(subscribe, read, () => "bar" as DockLayout);
  const setLayout = useCallback((next: DockLayout) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage unavailable: layout resets on reload.
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [layout, setLayout] as const;
}
