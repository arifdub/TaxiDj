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
import { ArrowLeftRight, ExternalLink, Hand, Maximize2, Minimize2, Music2, Pause, Play, SkipForward, TriangleAlert, X } from "lucide-react";
import { useDriverRide } from "@/components/driver/RideContext";
import { useDockLayout, type DockLayout } from "@/hooks/useDockLayout";
import { usePlaybackMode } from "@/hooks/usePlaybackMode";
import type { PlaybackMode } from "@/lib/playback";
import { loadYouTubeIframeApi, YT_STATE, type YTPlayer } from "@/lib/playback/youtube-iframe";
import { nextToPlay, nowPlaying } from "@/lib/queue";
import type { SongRequest } from "@/lib/types";

// In-app playback using YouTube's official IFrame Player API.
//
// The Supabase queue stays the source of truth: whatever request is
// "playing" in the database is what the embedded player loads. When a song
// ends, the player starts the next queued song straight away (without
// waiting for the database round trip) and marks it "playing" in the queue.
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
  const { queue, skip, act } = useDriverRide();
  const [mode, setMode] = usePlaybackMode();
  const embedded = mode === "embedded";
  const onPlayerRoute = usePathname().endsWith("/player");

  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  /** The request currently loaded in the player. */
  const loadedRef = useRef<{ requestId: string; videoId: string } | null>(null);
  const endedForRef = useRef<string | null>(null);
  /** Song auto-advance started, until the queue shows it playing. */
  const advancingRef = useRef<string | null>(null);
  const firstSyncRef = useRef(true);
  const handedOffRef = useRef(false);
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const [ready, setReady] = useState(false);
  // Docked player position (bar / left corner / right corner) and "closed".
  const [dockLayout, setDockLayout] = useDockLayout();
  const [closed, setClosed] = useState(false);
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
  const queueRef = useRef(queue);
  const skipRef = useRef(skip);
  const actRef = useRef(act);
  useEffect(() => {
    currentRef.current = current;
    queueRef.current = queue;
    skipRef.current = skip;
    actRef.current = act;
  });

  /** iOS only starts the first video after a tap on the player itself. */
  const armTapHint = useCallback(() => {
    clearTimeout(tapTimerRef.current);
    tapTimerRef.current = setTimeout(() => {
      const state = playerRef.current?.getPlayerState();
      if (state !== YT_STATE.PLAYING && state !== YT_STATE.BUFFERING) setNeedsTap(true);
    }, TAP_HINT_MS);
  }, []);

  /**
   * The loaded song finished: start the next queued song right away, then
   * record it in the queue. Runs once per finished play of a song.
   */
  const advance = useCallback(() => {
    const p = playerRef.current;
    const loaded = loadedRef.current;
    if (!p || !loaded || handedOffRef.current || endedForRef.current === loaded.requestId) return;
    endedForRef.current = loaded.requestId;
    const next = nextToPlay(queueRef.current.filter((q) => q.id !== loaded.requestId));
    if (next) {
      loadedRef.current = { requestId: next.id, videoId: next.youtube_video_id };
      advancingRef.current = next.id;
      setError(null);
      p.loadVideoById(next.youtube_video_id);
      armTapHint();
      // Marks the finished song played and this one playing.
      actRef.current(next.id, "play");
    } else if (currentRef.current?.id === loaded.requestId) {
      // Nothing left: mark the finished song played.
      skipRef.current("next");
    }
  }, [armTapHint]);
  const advanceRef = useRef(advance);
  useEffect(() => {
    advanceRef.current = advance;
  });

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
                // A new play of this song (also a replay) can auto-advance again.
                endedForRef.current = null;
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
                advanceRef.current();
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
      // Mid auto-advance the queue can briefly show nothing playing.
      if (loadedRef.current && loadedRef.current.requestId !== advancingRef.current) {
        loadedRef.current = null;
        p.stopVideo();
      }
      return;
    }
    if (currentId === advancingRef.current) advancingRef.current = null;
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
      // Backup for a missed "ended" event (seen on some mobile browsers).
      if (p.getPlayerState() === YT_STATE.ENDED) advanceRef.current();
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
      advancingRef.current = null;
      setClosed(false);
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
        setClosed(false);
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
  const audible = status === "playing" || status === "buffering";
  const showSurface = embedded && (onPlayerRoute || Boolean(current) || active);
  // Outside the Player tab the player docks above the tabs: a full-width bar
  // or a small corner player. YouTube requires a playing video to stay
  // visible (at least 200×200), so "close" stops playback before hiding.
  const docked = showSurface && !onPlayerRoute;
  const isClosed = docked && closed && !audible;
  const corner = dockLayout !== "bar";
  const dock: DockControls = {
    layout: dockLayout,
    setLayout: setDockLayout,
    close: () => {
      playerRef.current?.stopVideo();
      setClosed(true);
    },
  };
  const bottom = { bottom: "calc(max(1rem, env(safe-area-inset-bottom)) + 4.75rem)" };

  return (
    <PlayerContext.Provider value={value}>
      {embedded && (
        <section
          aria-label="Music player"
          className={
            !showSurface || isClosed
              ? "hidden"
              : onPlayerRoute
                ? "mb-5 flex justify-center"
                : corner
                  ? `fixed z-30 flex w-[216px] flex-col gap-2 rounded-3xl border border-line bg-night-2/95 p-2 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.8)] backdrop-blur ${
                      dockLayout === "left" ? "left-2" : "right-2"
                    }`
                  : "fixed inset-x-2 z-30 mx-auto flex max-w-lg items-stretch gap-3 rounded-3xl border border-line bg-night-2/95 p-2 shadow-[0_-10px_40px_-10px_rgba(0,0,0,0.8)] backdrop-blur md:max-w-3xl"
          }
          style={docked ? bottom : undefined}
        >
          {/*
            Music-player layout: the official YouTube player is kept small,
            like album art. YouTube's API policies require it to stay visible
            and at least 200×200px, so it is never hidden or shrunk further.
          */}
          <div
            className={`relative shrink-0 overflow-hidden rounded-3xl border border-line bg-black ${
              onPlayerRoute ? "size-64 shadow-[0_20px_60px_-20px_rgba(255,200,0,0.45)]" : "size-[200px]"
            }`}
          >
            <div ref={hostRef} className="absolute inset-0 [&>iframe]:size-full" />
            <PlayerOverlay current={current} />
          </div>
          {!onPlayerRoute && (corner ? <CornerControls current={current} dock={dock} /> : <DockBar current={current} dock={dock} />)}
        </section>
      )}
      {isClosed && (
        <button
          type="button"
          onClick={() => setClosed(false)}
          style={bottom}
          className="fixed right-3 z-30 flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-night-2/95 px-3 text-xs font-bold text-white shadow-lg backdrop-blur"
        >
          <Music2 className="size-4 text-taxi" aria-hidden /> Show player
        </button>
      )}
      {children}
      {/* Room so the last items can scroll above the docked player. */}
      {docked && <div aria-hidden className={isClosed ? "h-16" : corner ? "h-[17rem]" : "h-56"} />}
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
        <TriangleAlert className="size-6 shrink-0 text-taxi" aria-hidden />
        <p className="font-bold leading-snug">{message}</p>
        <div className="flex w-full flex-col gap-1.5">
          <a
            href={current.youtube_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-white px-3 text-sm font-bold text-ink"
          >
            <ExternalLink className="size-4" aria-hidden /> Open in YouTube
          </a>
          <button
            type="button"
            onClick={() => {
              if (next) player.load(next);
              skip("next");
            }}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-taxi px-3 text-sm font-bold text-ink"
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
      <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center px-2">
        <p className="flex items-center gap-1.5 rounded-full bg-taxi px-3 py-1.5 text-xs font-black text-ink shadow-lg">
          <Hand className="size-4" aria-hidden /> Tap the video to start
        </p>
      </div>
    );
  }

  return null;
}

function Overlay({ children }: { children: ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-night/95 p-3 text-center text-sm">
      {children}
    </div>
  );
}

/** Compact controls under the video on the Ride / Queue / QR tabs. */
interface DockControls {
  layout: DockLayout;
  setLayout: (layout: DockLayout) => void;
  /** Stop playback and hide the docked player. */
  close: () => void;
}

function usePlayPause(current: SongRequest | null) {
  const player = usePlayer()!;
  const { queue, skip } = useDriverRide();
  const next = nextToPlay(queue);
  const playing = player.status === "playing" || player.status === "buffering";
  return {
    playing,
    next,
    toggle: () => (playing ? player.pause() : current ? player.load(current) : next && (player.load(next), skip("next"))),
    goNext: () => {
      if (next) player.load(next);
      skip("next");
    },
  };
}

/** Full-width bar: title, controls, minimize and close. */
function DockBar({ current, dock }: { current: SongRequest | null; dock: DockControls }) {
  const { ride } = useDriverRide();
  const { playing, next, toggle, goNext } = usePlayPause(current);
  const btn = "grid size-11 shrink-0 place-items-center rounded-full";
  const small = "grid size-9 shrink-0 place-items-center rounded-full text-mist hover:bg-white/5 hover:text-white";

  return (
    <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5 max-[380px]:items-center">
      <div className="flex items-start justify-between gap-1">
        <p className="pt-2 text-[11px] font-black uppercase tracking-widest text-taxi max-[380px]:hidden">Now playing</p>
        <div className="-mr-1 flex">
          <button type="button" onClick={() => dock.setLayout("right")} aria-label="Minimize player to the corner" className={small}>
            <Minimize2 className="size-4" aria-hidden />
          </button>
          <button type="button" onClick={dock.close} aria-label="Close player (stops the music)" className={small}>
            <X className="size-4" aria-hidden />
          </button>
        </div>
      </div>
      {/* On very narrow phones only the buttons fit beside the 200px player. */}
      <div className="min-w-0 max-[380px]:hidden">
        <p className="line-clamp-2 font-bold leading-snug">{current?.title ?? "Nothing playing"}</p>
        <p className="mt-0.5 truncate text-xs text-mist">{current?.artist ?? "YouTube"}</p>
      </div>
      <div className="flex items-center gap-1.5 max-[380px]:flex-col max-[380px]:gap-2">
        <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className={`${btn} bg-taxi text-ink`}>
          {playing ? <Pause className="size-5 fill-current" aria-hidden /> : <Play className="ml-0.5 size-5 fill-current" aria-hidden />}
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={!next && !current}
          aria-label="Next song"
          className={`${btn} bg-night-3 text-white disabled:opacity-40`}
        >
          <SkipForward className="size-5 fill-current" aria-hidden />
        </button>
        <Link href={`/driver/ride/${ride.id}/player`} aria-label="Open full player" className={`${btn} bg-night-3 text-white max-[380px]:hidden`}>
          <Maximize2 className="size-5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

/** Compact controls under the corner player. */
function CornerControls({ current, dock }: { current: SongRequest | null; dock: DockControls }) {
  const { playing, next, toggle, goNext } = usePlayPause(current);
  const btn = "grid size-9 shrink-0 place-items-center rounded-full";
  return (
    <div className="flex items-center justify-between">
      <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className={`${btn} bg-taxi text-ink`}>
        {playing ? <Pause className="size-4 fill-current" aria-hidden /> : <Play className="ml-0.5 size-4 fill-current" aria-hidden />}
      </button>
      <button type="button" onClick={goNext} disabled={!next && !current} aria-label="Next song" className={`${btn} bg-night-3 text-white disabled:opacity-40`}>
        <SkipForward className="size-4 fill-current" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => dock.setLayout(dock.layout === "left" ? "right" : "left")}
        aria-label={`Move player to the ${dock.layout === "left" ? "right" : "left"}`}
        className={`${btn} bg-night-3 text-white`}
      >
        <ArrowLeftRight className="size-4" aria-hidden />
      </button>
      <button type="button" onClick={() => dock.setLayout("bar")} aria-label="Expand player to full bar" className={`${btn} bg-night-3 text-white`}>
        <Maximize2 className="size-4" aria-hidden />
      </button>
      <button type="button" onClick={dock.close} aria-label="Close player (stops the music)" className={`${btn} bg-night-3 text-white`}>
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
