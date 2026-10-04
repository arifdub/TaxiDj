"use client";

// Phone "Now Playing" integration (Media Session API): lock screen, Control
// Centre, Bluetooth, and Apple CarPlay / Android Auto's Now Playing screen
// and steering-wheel buttons.
//
// The song player and the radio take turns, so whichever is playing "owns"
// the session; the other one's updates are ignored until it plays again.

type Owner = "song" | "radio";
type Action = "play" | "pause" | "stop" | "nexttrack" | "previoustrack";

let owner: Owner | null = null;
const ACTIONS: Action[] = ["play", "pause", "stop", "nexttrack", "previoustrack"];

const supported = () => typeof navigator !== "undefined" && "mediaSession" in navigator;

export function claimMediaSession(
  who: Owner,
  info: { title: string; artist?: string | null; album?: string | null; artwork?: string | null },
  handlers: Partial<Record<Action, (() => void) | null>>,
) {
  if (!supported()) return;
  owner = who;
  const ms = navigator.mediaSession;
  try {
    ms.metadata = new MediaMetadata({
      title: info.title,
      artist: info.artist ?? "",
      album: info.album ?? "Taxi DJ",
      artwork: info.artwork
        ? [
            { src: info.artwork, sizes: "480x360", type: "image/jpeg" },
            { src: info.artwork, sizes: "512x512" },
          ]
        : [{ src: "/icons/512", sizes: "512x512", type: "image/png" }],
    });
  } catch {
    // Some browsers reject unusual artwork; the title still matters most.
  }
  for (const action of ACTIONS) {
    try {
      ms.setActionHandler(action, handlers[action] ?? null);
    } catch {
      // Action not supported on this browser.
    }
  }
  ms.playbackState = "playing";
}

export function setMediaState(who: Owner, state: "playing" | "paused" | "none") {
  if (!supported() || owner !== who) return;
  navigator.mediaSession.playbackState = state;
}

export function releaseMediaSession(who: Owner) {
  if (!supported() || owner !== who) return;
  owner = null;
  const ms = navigator.mediaSession;
  ms.metadata = null;
  ms.playbackState = "none";
  for (const action of ACTIONS) {
    try {
      ms.setActionHandler(action, null);
    } catch {
      // ignore
    }
  }
}
