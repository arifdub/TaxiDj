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
import { claimMediaSession, releaseMediaSession, setMediaState } from "@/lib/media-session";
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
      releaseMediaSession("radio");
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
    },
    [audio],
  );

  // Pause the song player only if a song is actually playing (pausing an
  // empty player would make it show up as "paused").
  const pauseSong = useCallback(() => {
    if (player?.status === "playing" || player?.status === "buffering") player.pause();
  }, [player]);

  const play = useCallback(
    (s: RadioStation) => {
      pauseSong(); // one thing at a time
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
    [pauseSong, start],
  );

  const toggle = useCallback(() => {
    if (!station) return;
    const a = audio();
    if (status === "playing" || status === "loading") {
      a.pause();
      setWaitingForQueue(false);
    } else {
      pauseSong();
      setWaitingForQueue(false);
      // Live radio: reload so it plays "now", not from where it paused.
      a.src = station.streamUrl;
      start(station);
    }
  }, [audio, pauseSong, start, station, status]);

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

  // Phone / car "Now Playing" (lock screen, CarPlay, Android Auto, Bluetooth).
  const toggleRef = useRef(toggle);
  const stopRef = useRef(stop);
  useEffect(() => {
    toggleRef.current = toggle;
    stopRef.current = stop;
  });
  useEffect(() => {
    if (!station) {
      releaseMediaSession("radio");
      return;
    }
    if (status === "playing") {
      claimMediaSession(
        "radio",
        {
          title: station.name,
          artist: [station.state, station.country].filter(Boolean).join(", ") || "Live radio",
          album: "Taxi DJ radio",
          artwork: station.favicon,
        },
        {
          play: () => toggleRef.current(),
          pause: () => toggleRef.current(),
          stop: () => stopRef.current(),
        },
      );
    } else if (status === "paused" || status === "error") {
      setMediaState("radio", "paused");
    }
  }, [station, status]);

  // Take turns with the song queue.
  const songAudible = player?.status === "playing" || player?.status === "buffering";
  const songLoaded = Boolean(nowPlaying(queue));
  const radioOn = status === "playing" || status === "loading";
  // Step aside only when a song *starts* playing. When the driver starts the
  // radio while a song plays, the song is being paused (YouTube confirms a
  // moment later) – the radio mustn't pause itself in that gap.
  const songWasAudible = useRef(songAudible);
  useEffect(() => {
    const songStarted = songAudible && !songWasAudible.current;
    songWasAudible.current = songAudible;
    if (songStarted && radioOn) {
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
