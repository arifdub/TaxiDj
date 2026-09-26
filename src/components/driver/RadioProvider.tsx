"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePlayer } from "@/components/driver/PlayerProvider";
import { useDriverRide } from "@/components/driver/RideContext";
import type { RadioStation } from "@/lib/radio/stations";
import { nowPlaying } from "@/lib/queue";

// Local radio for when the song queue is empty.
//
// Plays a station's own public stream in a normal <audio> element (no
// download, no re-hosting). It takes turns with the song queue:
// * a queue song starts → the radio pauses;
// * the queue runs out → the radio comes back on (if it was on before);
// * the driver starts the radio → the song player pauses.
// Lives in the ride layout so it keeps playing across the ride tabs.

export type RadioStatus = "idle" | "loading" | "playing" | "paused" | "error";

interface RadioContextValue {
  station: RadioStation | null;
  status: RadioStatus;
  /** Paused because a queue song is playing; resumes when the queue ends. */
  waitingForQueue: boolean;
  play: (station: RadioStation) => void;
  toggle: () => void;
  stop: () => void;
}

const RadioContext = createContext<RadioContextValue | null>(null);

export function useRadio() {
  return useContext(RadioContext);
}

const LAST_KEY = "taxidj-radio-last";

export function lastStation(): RadioStation | null {
  try {
    const raw = localStorage.getItem(LAST_KEY);
    return raw ? (JSON.parse(raw) as RadioStation) : null;
  } catch {
    return null;
  }
}

export function RadioProvider({ children }: { children: ReactNode }) {
  const player = usePlayer();
  const { queue } = useDriverRide();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [station, setStation] = useState<RadioStation | null>(null);
  const [status, setStatus] = useState<RadioStatus>("idle");
  const [waitingForQueue, setWaitingForQueue] = useState(false);

  const audio = useCallback(() => {
    if (!audioRef.current) {
      const a = new Audio();
      a.preload = "none";
      a.addEventListener("playing", () => setStatus("playing"));
      a.addEventListener("waiting", () => setStatus("loading"));
      a.addEventListener("pause", () => setStatus((s) => (s === "error" ? s : "paused")));
      a.addEventListener("error", () => {
        if (a.getAttribute("src")) setStatus("error");
      });
      audioRef.current = a;
    }
    return audioRef.current;
  }, []);

  // Stop the stream when leaving the ride.
  useEffect(
    () => () => {
      const a = audioRef.current;
      if (a) {
        a.pause();
        a.removeAttribute("src");
        a.load();
      }
    },
    [],
  );

  const start = useCallback(
    (s: RadioStation) => {
      const a = audio();
      if (a.getAttribute("src") !== s.streamUrl) {
        a.src = s.streamUrl;
      }
      setStatus("loading");
      a.play().catch(() => setStatus((cur) => (cur === "loading" ? "paused" : cur)));
      // Lock screen / car display info.
      if ("mediaSession" in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: s.name,
          artist: [s.state, s.country].filter(Boolean).join(", ") || "Live radio",
          album: "Taxi DJ radio",
          artwork: s.favicon ? [{ src: s.favicon, sizes: "256x256" }] : [],
        });
      }
    },
    [audio],
  );

  const play = useCallback(
    (s: RadioStation) => {
      player?.pause(); // one thing at a time
      setWaitingForQueue(false);
      setStation(s);
      start(s);
      try {
        localStorage.setItem(LAST_KEY, JSON.stringify(s));
      } catch {
        // Not remembered: fine.
      }
      fetch("/api/radio/click", { method: "POST", body: JSON.stringify({ id: s.id }) }).catch(() => {});
    },
    [player, start],
  );

  const toggle = useCallback(() => {
    if (!station) return;
    const a = audio();
    if (status === "playing" || status === "loading") {
      a.pause();
      setWaitingForQueue(false);
    } else {
      player?.pause();
      setWaitingForQueue(false);
      // Live radio: reload so it plays "now", not from where it paused.
      a.src = station.streamUrl;
      start(station);
    }
  }, [audio, player, start, station, status]);

  const stop = useCallback(() => {
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.removeAttribute("src");
      a.load();
    }
    setWaitingForQueue(false);
    setStation(null);
    setStatus("idle");
  }, []);

  // Take turns with the song queue.
  const songAudible = player?.status === "playing" || player?.status === "buffering";
  const songLoaded = Boolean(nowPlaying(queue));
  const radioOn = status === "playing" || status === "loading";
  useEffect(() => {
    if (songAudible && radioOn) {
      audioRef.current?.pause();
      // Remember to come back on when the queue is done.
      queueMicrotask(() => setWaitingForQueue(true));
    }
  }, [songAudible, radioOn]);
  useEffect(() => {
    if (waitingForQueue && station && !songAudible && !songLoaded) {
      queueMicrotask(() => {
        setWaitingForQueue(false);
        start(station);
      });
    }
  }, [waitingForQueue, station, songAudible, songLoaded, start]);

  const value = useMemo<RadioContextValue>(
    () => ({ station, status, waitingForQueue, play, toggle, stop }),
    [station, status, waitingForQueue, play, toggle, stop],
  );

  return <RadioContext.Provider value={value}>{children}</RadioContext.Provider>;
}
