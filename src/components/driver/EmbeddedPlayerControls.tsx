"use client";

import Link from "next/link";
import {
  CircleCheck,
  ExternalLink,
  ListMusic,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import { ErrorBar } from "@/components/driver/ErrorBar";
import { PlayQueueInYouTube } from "@/components/driver/PlayQueueInYouTube";
import { usePlayer } from "@/components/driver/PlayerProvider";
import { useDriverRide } from "@/components/driver/RideContext";
import { YouTubeIcon } from "@/components/ui";
import { formatDuration } from "@/lib/format";
import { lastPlayed, nextToPlay, nowPlaying, upNext } from "@/lib/queue";

/**
 * Full player controls for in-app (embedded YouTube) playback. The video
 * itself is rendered by <PlayerProvider> just above this, so it keeps
 * playing across tabs.
 */
export function EmbeddedPlayerControls() {
  const player = usePlayer()!;
  const { ride, queue, skip, act } = useDriverRide();
  const current = nowPlaying(queue);
  const next = nextToPlay(queue);
  const previous = lastPlayed(queue);
  const waitingCount = upNext(queue).length;
  const playing = player.status === "playing" || player.status === "buffering";
  const duration = player.duration || current?.duration_seconds || 0;

  function togglePlay() {
    if (playing) return player.pause();
    if (current) return player.load(current);
    if (next) {
      player.load(next);
      skip("next");
    }
  }

  function goNext() {
    if (next) player.load(next);
    skip("next");
  }

  function goPrevious() {
    if (!previous) return;
    player.load(previous);
    skip("previous");
  }

  return (
    <div className="flex flex-col items-center pb-6 text-center">
      <div className="w-full">
        <ErrorBar />
      </div>

      <div className="w-full max-w-md">
        <h1 className="line-clamp-2 text-2xl font-black leading-tight">
          {current?.title ?? next?.title ?? "Nothing playing"}
        </h1>
        <p className="mt-1 flex items-center justify-center gap-1.5 text-lg text-mist">
          <YouTubeIcon className="h-4 w-auto" /> {(current ?? next)?.artist ?? "YouTube"}
        </p>
        {current?.passenger && (
          <p className="mt-1 text-sm font-semibold text-taxi">Requested by {current.passenger.nickname}</p>
        )}
      </div>

      {/* Seekable progress */}
      <div className="mt-5 w-full max-w-md">
        <input
          type="range"
          min={0}
          max={Math.max(1, Math.floor(duration))}
          step={1}
          value={Math.min(Math.floor(player.time), Math.floor(duration) || 0)}
          onChange={(e) => player.seek(Number(e.target.value))}
          disabled={!current}
          aria-label="Song position"
          aria-valuetext={`${formatDuration(player.time)} of ${formatDuration(duration)}`}
          className="h-2 w-full cursor-pointer accent-taxi disabled:opacity-40"
        />
        <div className="mt-1 flex justify-between font-mono text-xs text-mist">
          <span>{formatDuration(player.time)}</span>
          <span>{duration ? formatDuration(duration) : "--:--"}</span>
        </div>
      </div>

      {/* Transport */}
      <div className="mt-4 flex w-full max-w-md items-center justify-between">
        <ControlButton label="Previous song" onClick={goPrevious} disabled={!previous}>
          <SkipBack className="size-8 fill-current" aria-hidden />
        </ControlButton>
        <ControlButton label="Stop" onClick={player.stop} disabled={!current}>
          <Square className="size-7 fill-current" aria-hidden />
        </ControlButton>
        <button
          type="button"
          onClick={togglePlay}
          disabled={!current && !next}
          aria-label={playing ? "Pause" : "Play"}
          className="grid size-24 place-items-center rounded-full bg-taxi text-ink shadow-[0_10px_40px_-10px_rgba(255,200,0,0.7)] hover:bg-taxi-light disabled:opacity-30"
        >
          {playing ? (
            <Pause className="size-11 fill-current" aria-hidden />
          ) : (
            <Play className="ml-1 size-11 fill-current" aria-hidden />
          )}
        </button>
        {next || !current ? (
          <ControlButton label="Next song" onClick={goNext} disabled={!next}>
            <SkipForward className="size-8 fill-current" aria-hidden />
          </ControlButton>
        ) : (
          <ControlButton label="Finish song" onClick={() => act(current.id, "finish")}>
            <CircleCheck className="size-8" aria-hidden />
          </ControlButton>
        )}
        <ControlButton label="Queue" href={`/driver/ride/${ride.id}/queue`}>
          <ListMusic className="size-7" aria-hidden />
        </ControlButton>
      </div>

      {next && (
        <p className="mt-3 max-w-md truncate text-sm text-mist">
          Up next: <span className="font-semibold text-white">{next.title}</span>
          {waitingCount > 1 ? ` · +${waitingCount - 1} more` : ""}
        </p>
      )}

      {/* Volume */}
      <div className="mt-5 flex w-full max-w-md items-center gap-3">
        <button
          type="button"
          onClick={player.toggleMute}
          aria-label={player.muted ? "Unmute" : "Mute"}
          className="grid size-11 place-items-center rounded-full text-mist hover:bg-white/5 hover:text-white"
        >
          {player.muted || player.volume === 0 ? (
            <VolumeX className="size-6" aria-hidden />
          ) : (
            <Volume2 className="size-6" aria-hidden />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          value={player.muted ? 0 : player.volume}
          onChange={(e) => player.setVolume(Number(e.target.value))}
          aria-label="Volume"
          className="h-2 flex-1 cursor-pointer accent-taxi"
        />
      </div>
      <p className="mt-1 text-xs text-mist">On iPhone, use the phone or car volume controls.</p>

      <div className="mt-6 grid w-full max-w-md grid-cols-2 gap-3">
        {current ? (
          <a
            href={current.youtube_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={player.pause}
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-night-3 text-sm font-bold"
          >
            <ExternalLink className="size-5" aria-hidden /> Open in YouTube app
          </a>
        ) : (
          <span className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-night-3 text-sm font-bold opacity-40">
            <ExternalLink className="size-5" aria-hidden /> Open in YouTube app
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            player.pause();
            player.setMode("external");
          }}
          className="flex min-h-14 items-center justify-center rounded-2xl border border-line bg-night-3 px-2 text-sm font-bold"
        >
          Use YouTube app mode
        </button>
      </div>

      <div className="mt-6 w-full max-w-md">
        <PlayQueueInYouTube />
      </div>

      <p className="mt-4 max-w-md text-xs text-mist">
        Keep Taxi DJ open while music plays. The screen stays on automatically; on iPhone, locking
        the screen or switching apps pauses in-app playback. For background play, use the YouTube
        playlist button above.
      </p>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  href,
  disabled,
  children,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const className =
    "grid size-14 place-items-center rounded-full text-white hover:bg-white/5 disabled:opacity-30";
  if (href) {
    return (
      <Link href={href} aria-label={label} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-label={label} className={className}>
      {children}
    </button>
  );
}
