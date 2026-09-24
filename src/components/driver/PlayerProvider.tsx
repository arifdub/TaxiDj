"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
import { ExternalLink, Hand, Maximize2, Music2, Pause, Play, SkipForward, TriangleAlert } from "lucide-react";
import { useDriverRide } from "@/components/driver/RideContext";
import { usePlaybackMode } from "@/hooks/usePlaybackMode";
import type { PlaybackMode } from "@/lib/playback";
import { loadYouTubeIframeApi, YT_STATE, type YTPlayer } from "@/lib/playback/youtube-iframe";
import { nextToPlay, nowPlaying } from "@/lib/queue";
import type { SongRequest } from "@/lib/types";

// In-app playback using YouTube's official IFrame Player API.
//
// The Supabase queue stays the source of truth: whatever request is
// "playing" in the database is what the embedded player loads. When a song
// ends, the player advances the queue (driver_skip 'next'), and the new
// "playing" row is loaded automatically.
//
// The player lives in the ride layout (not a page), so music keeps playing
// while the driver moves between the Ride / Queue / Player / QR tabs.

export type PlayerStatus = "idle" | "playing" | "paused" | "buffering" | "ended" | "error";
export type PlayerError = "NOT_EMBEDDABLE" | "NOT_FOUND" | "FAILED";

type Playable = Pick<SongRequest, "id" | "youtube_video_id" | "youtube_url">;

interface PlayerContextValue {
  mode: PlaybackMode;
  setMode: (mode: PlaybackMode) => void;
  embedded: boolean;
  ready: boolean;
  apiUnavailable: boolean;
  status: PlayerStatus;
  error: PlayerError | null;
  needsTap: boolean;
  time: number;
  duration: number;
  volume: number;
  muted: boolean;
  /**
   * Pause and stop following the queue because playback moved to the
   * YouTube app. Pressing play in Taxi DJ resumes in-app playback.
   */
  handOff: () => void;
  /** Load a queue item into the player (or resume it if already loaded). */
  load: (item: Playable) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

/** Player controls, or null outside an active ride. */
export function usePlayer() {
  return useContext(PlayerContext);
}

const TAP_HINT_MS = 2500;

export function PlayerProvider({ children }: { children: ReactNode }) {
  const { queue, skip } = useDriverRide();
  const [mode, setMode] = usePlaybackMode();
  const embedded = mode === "embedded";
  const onPlayerRoute = usePathname().endsWith("/player");

  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  /** The request currently loaded in the player. */
  const loadedRef = useRef<{ requestId: string; videoId: string } | null>(null);
  const endedForRef = useRef<string | null>(null);
  const firstSyncRef = useRef(true);
  const handedOffRef = useRef(false);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [ready, setReady] = useState(false);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const [status, setStatus] = useState<PlayerStatus>("idle");
  const [error, setError] = useState<PlayerError | null>(null);
  const [needsTap, setNeedsTap] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(100);
  const [muted, setMuted] = useState(false);

  const current = nowPlaying(queue);
  const currentRef = useRef(current);
  const skipRef = useRef(skip);
  useEffect(() => {
    currentRef.current = current;
    skipRef.current = skip;
  });

  /** iOS only starts the first video after a tap on the player itself. */
  const armTapHint = useCallback(() => {
    clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => {
      const state = playerRef.current?.getPlayerState();
      if (state !== YT_STATE.PLAYING && state !== YT_STATE.BUFFERING) setNeedsTap(true);
    }, TAP_HINT_MS);
  }, []);

  // Create / destroy the YouTube player.
  useEffect(() => {
    if (!embedded) return;
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    const mount = document.createElement("div");
    host.appendChild(mount);

    loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled) return;
        playerRef.current = new YT.Player(mount, {
          width: "100%",
          height: "100%",
          playerVars: { playsinline: 1, rel: 0, enablejsapi: 1, origin: window.location.origin },
          events: {
            onReady: () => {
              if (!cancelled) setReady(true);
            },
            onStateChange: ({ data }) => {
              if (data === YT_STATE.PLAYING) {
                setStatus("playing");
                setNeedsTap(false);
                setError(null);
                clearTimeout(tapTimerRef.current);
              } else if (data === YT_STATE.PAUSED) {
                setStatus("paused");
              } else if (data === YT_STATE.BUFFERING) {
                setStatus("buffering");
              } else if (data === YT_STATE.ENDED) {
                setStatus("ended");
                // Auto-advance the queue once per finished request.
                const cur = currentRef.current;
                if (cur && loadedRef.current?.requestId === cur.id && endedForRef.current !== cur.id) {
                  endedForRef.current = cur.id;
                  skipRef.current("next");
                }
              } else {
                setStatus("idle");
              }
            },
            onError: ({ data }) => {
              clearTimeout(tapTimerRef.current);
              setNeedsTap(false);
              setStatus("error");
              setError(data === 101 || data === 150 ? "NOT_EMBEDDABLE" : data === 100 ? "NOT_FOUND" : "FAILED");
            },
          },
        });
      })
      .catch(() => {
        if (!cancelled) setApiUnavailable(true);
      });

    return () => {
      cancelled = true;
      clearTimeout(tapTimerRef.current);
      playerRef.current?.destroy();
      playerRef.current = null;
      loadedRef.current = null;
      firstSyncRef.current = true;
      host.replaceChildren();
      setReady(false);
      setStatus("idle");
    };
  }, [embedded]);

  // Keep the player in sync with the song marked "playing" in the queue.
  const currentId = current?.id ?? null;
  const currentVideo = current?.youtube_video_id ?? null;
  useEffect(() => {
    const p = playerRef.current;
    if (!embedded || !ready || !p) return;
    const initial = firstSyncRef.current;
    firstSyncRef.current = false;

    if (!currentId || !currentVideo) {
      if (loadedRef.current) {
        loadedRef.current = null;
        p.stopVideo();
      }
      return;
    }
    if (loadedRef.current?.requestId === currentId) return;
    loadedRef.current = { requestId: currentId, videoId: currentVideo };
    if (initial || handedOffRef.current) {
      // Opening the app mid-ride, or playback was handed to the YouTube app:
      // show the song without starting it here.
      p.cueVideoById(currentVideo);
    } else {
      p.loadVideoById(currentVideo);
      armTapHint();
    }
  }, [embedded, ready, currentId, currentVideo, armTapHint]);

  // Poll position / volume while the player exists.
  useEffect(() => {
    if (!ready) return;
    const t = setInterval(() => {
      const p = playerRef.current;
      if (!p) return;
      setTime(p.getCurrentTime() || 0);
      setDuration(p.getDuration() || 0);
      setVolumeState(p.getVolume());
      setMuted(p.isMuted());
    }, 500);
    return () => clearInterval(t);
  }, [ready]);

  // Keep the screen awake while music plays (iOS pauses embeds on lock).
  useEffect(() => {
    if (!embedded || status !== "playing" || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = () =>
      navigator.wakeLock
        .request("screen")
        .then((l) => {
          if (cancelled) l.release();
          else lock = l;
        })
        .catch(() => {});
    request();
    const onVisible = () => {
      if (document.visibilityState === "visible") request();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      lock?.release().catch(() => {});
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [embedded, status]);

  const load = useCallback(
    (item: Playable) => {
      const p = playerRef.current;
      if (!p) return;
      handedOffRef.current = false;
      if (loadedRef.current?.requestId === item.id) {
        p.playVideo();
        return;
      }
      loadedRef.current = { requestId: item.id, videoId: item.youtube_video_id };
      firstSyncRef.current = false;
      setError(null);
      p.loadVideoById(item.youtube_video_id);
      armTapHint();
    },
    [armTapHint],
  );

  const value = useMemo<PlayerContextValue>(
    () => ({
      mode,
      setMode,
      embedded,
      ready,
      apiUnavailable,
      status,
      error,
      needsTap,
      time,
      duration,
      volume,
      muted,
      load,
      handOff: () => {
        handedOffRef.current = true;
        playerRef.current?.pauseVideo();
      },
      play: () => {
        handedOffRef.current = false;
        playerRef.current?.playVideo();
      },
      pause: () => playerRef.current?.pauseVideo(),
      stop: () => playerRef.current?.stopVideo(),
      seek: (s) => playerRef.current?.seekTo(s, true),
      setVolume: (v) => {
        const p = playerRef.current;
        if (!p) return;
        p.setVolume(v);
        if (v > 0 && p.isMuted()) p.unMute();
        setVolumeState(v);
      },
      toggleMute: () => {
        const p = playerRef.current;
        if (!p) return;
        if (p.isMuted()) p.unMute();
        else p.mute();
        setMuted(!p.isMuted());
      },
    }),
    [mode, setMode, embedded, ready, apiUnavailable, status, error, needsTap, time, duration, volume, muted, load],
  );

  const active = status === "playing" || status === "paused" || status === "buffering";
  const showSurface = embedded && (onPlayerRoute || Boolean(current) || active);

  return (
    <PlayerContext.Provider value={value}>
      {embedded && (
        <section aria-label="YouTube player" className={showSurface ? "mb-5" : "hidden"}>
          <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-line bg-black">
            <div ref={hostRef} className="absolute inset-0 [&>iframe]:size-full" />
            <PlayerOverlay current={current} />
          </div>
          {!onPlayerRoute && <DockBar current={current} />}
        </section>
      )}
      {children}
    </PlayerContext.Provider>
  );
}

/** Messages drawn over the video: loading, errors, "tap to start". */
function PlayerOverlay({ current }: { current: SongRequest | null }) {
  const player = usePlayer()!;
  const { skip, queue } = useDriverRide();

  if (player.apiUnavailable) {
    return (
      <Overlay>
        <TriangleAlert className="size-8 text-taxi" aria-hidden />
        <p className="font-bold">The YouTube player couldn&apos;t load.</p>
        <button type="button" onClick={() => player.setMode("external")} className="text-sm font-bold text-taxi underline">
          Use the YouTube app instead
        </button>
      </Overlay>
    );
  }

  if (player.error && current) {
    const message =
      player.error === "NOT_EMBEDDABLE"
        ? "This song's owner doesn't allow it to play inside other apps."
        : player.error === "NOT_FOUND"
          ? "This video is unavailable or private."
          : "This video couldn't be played.";
    const next = nextToPlay(queue);
    return (
      <Overlay>
        <TriangleAlert className="size-8 text-taxi" aria-hidden />
        <p className="max-w-xs font-bold">{message}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <a
            href={current.youtube_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center gap-1.5 rounded-xl bg-white px-3 text-sm font-bold text-ink"
          >
            <ExternalLink className="size-4" aria-hidden /> Open in YouTube
          </a>
          <button
            type="button"
            onClick={() => {
              if (next) player.load(next);
              skip("next");
            }}
            className="flex min-h-11 items-center gap-1.5 rounded-xl bg-taxi px-3 text-sm font-bold text-ink"
          >
            <SkipForward className="size-4" aria-hidden /> {next ? "Skip song" : "Finish song"}
          </button>
        </div>
      </Overlay>
    );
  }

  if (!current && player.status !== "playing" && player.status !== "paused") {
    return (
      <Overlay>
        <Music2 className="size-10 text-mist" aria-hidden />
        <p className="font-semibold text-mist">
          {nextToPlay(queue) ? "Press play to start the queue" : "Your queue is empty."}
        </p>
      </Overlay>
    );
  }

  if (player.needsTap) {
    return (
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
        <p className="flex items-center gap-2 rounded-full bg-taxi px-4 py-2 text-sm font-black text-ink shadow-lg">
          <Hand className="size-4" aria-hidden /> Tap the video to start
        </p>
      </div>
    );
  }

  return null;
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-night/95 p-4 text-center">
      {children}
    </div>
  );
}

/** Compact controls under the video on the Ride / Queue / QR tabs. */
function DockBar({ current }: { current: SongRequest | null }) {
  const player = usePlayer()!;
  const { ride, queue, skip } = useDriverRide();
  const next = nextToPlay(queue);
  const playing = player.status === "playing" || player.status === "buffering";

  return (
    <div className="mt-2 flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{current?.title ?? "Nothing playing"}</p>
        <p className="truncate text-xs text-mist">{current?.artist ?? "YouTube"}</p>
      </div>
      <button
        type="button"
        onClick={() => (playing ? player.pause() : current ? player.load(current) : next && (player.load(next), skip("next")))}
        aria-label={playing ? "Pause" : "Play"}
        className="grid size-12 place-items-center rounded-full bg-taxi text-ink"
      >
        {playing ? <Pause className="size-6 fill-current" aria-hidden /> : <Play className="ml-0.5 size-6 fill-current" aria-hidden />}
      </button>
      <button
        type="button"
        onClick={() => {
          if (next) player.load(next);
          skip("next");
        }}
        disabled={!next && !current}
        aria-label="Next song"
        className="grid size-12 place-items-center rounded-full bg-night-3 text-white disabled:opacity-40"
      >
        <SkipForward className="size-5 fill-current" aria-hidden />
      </button>
      <Link
        href={`/driver/ride/${ride.id}/player`}
        aria-label="Open full player"
        className="grid size-12 place-items-center rounded-full bg-night-3 text-white"
      >
        <Maximize2 className="size-5" aria-hidden />
      </Link>
    </div>
  );
}
