"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CircleCheck, ExternalLink, ListMusic, Music2, Play, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { ErrorBar } from "@/components/driver/ErrorBar";
import { PlayLink } from "@/components/driver/PlayLink";
import { useDriverRide } from "@/components/driver/RideContext";
import { Thumbnail, YouTubeIcon } from "@/components/ui";
import { formatDuration } from "@/lib/format";
import { externalYouTubeProvider as playback } from "@/lib/playback";
import { usePlayer } from "@/components/driver/PlayerProvider";
import { EmbeddedPlayerControls } from "@/components/driver/EmbeddedPlayerControls";
import { lastPlayed, nextToPlay, nowPlaying, upNext } from "@/lib/queue";
import type { QueueItem } from "@/lib/types";

/**
 * NOW PLAYING. Taxi DJ is the queue/remote; audio plays in the official
 * YouTube app (and through CarPlay from there). Controls that the current
 * playback provider can't really drive are presented honestly.
 */
export default function PlayerPage() {
  const player = usePlayer();
  if (player?.embedded) return <EmbeddedPlayerControls />;
  return <ExternalPlayer />;
}

function ExternalPlayer() {
  const { ride, queue, skip, act, busy } = useDriverRide();
  const player = usePlayer();
  const current = nowPlaying(queue);
  const next = nextToPlay(queue);
  const previous = lastPlayed(queue);
  const waitingCount = upNext(queue).length;

  return (
    <div className="flex flex-col items-center pb-6 text-center">
      <p className="mt-1 text-sm font-black uppercase tracking-widest text-mist">Now Playing</p>
      <div className="mt-2 w-full"><ErrorBar /></div>

      <div className="mt-2 w-full max-w-sm">
        {current ? (
          <Thumbnail src={current.thumbnail_url} alt="" className="aspect-square w-full" rounded="rounded-[2rem]" />
        ) : (
          <div className="grid aspect-square w-full place-items-center rounded-[2rem] border border-dashed border-line bg-night-2 text-mist">
            <div>
              <Music2 className="mx-auto size-16" aria-hidden />
              <p className="mt-3 font-semibold">{next ? "Tap play to start the queue" : "Your queue is empty."}</p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-5 w-full max-w-sm">
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

      {current && <Progress item={current} />}

      {/* Transport controls */}
      <div className="mt-6 flex w-full max-w-sm items-center justify-between">
        {previous ? (
          <PlayLink
            item={previous}
            onPlay={() => skip("previous")}
            aria-label={`Previous: ${previous.title}`}
            className="grid size-16 place-items-center rounded-full text-white hover:bg-white/5"
          >
            <SkipBack className="size-9 fill-current" aria-hidden />
          </PlayLink>
        ) : (
          <DisabledControl label="Previous" icon={<SkipBack className="size-9 fill-current" />} />
        )}

        {current ? (
          <PlayLink
            item={current}
            aria-label={`${playback.actionLabel}: ${current.title}`}
            className="grid size-24 place-items-center rounded-full bg-taxi text-ink shadow-[0_10px_40px_-10px_rgba(255,200,0,0.7)] hover:bg-taxi-light"
          >
            <Play className="ml-1 size-11 fill-current" aria-hidden />
          </PlayLink>
        ) : next ? (
          <PlayLink
            item={next}
            onPlay={() => skip("next")}
            aria-label={`Play ${next.title}`}
            className="grid size-24 place-items-center rounded-full bg-taxi text-ink hover:bg-taxi-light"
          >
            <Play className="ml-1 size-11 fill-current" aria-hidden />
          </PlayLink>
        ) : (
          <DisabledControl label="Play" big icon={<Play className="ml-1 size-11 fill-current" />} />
        )}

        {next ? (
          <PlayLink
            item={next}
            onPlay={() => skip("next")}
            aria-label={`Next: ${next.title}`}
            className="grid size-16 place-items-center rounded-full text-white hover:bg-white/5"
          >
            <SkipForward className="size-9 fill-current" aria-hidden />
          </PlayLink>
        ) : current ? (
          <button
            type="button"
            onClick={() => act(current.id, "finish")}
            disabled={busy === current.id}
            aria-label="Mark song as finished"
            className="grid size-16 place-items-center rounded-full text-white hover:bg-white/5"
          >
            <CircleCheck className="size-9" aria-hidden />
          </button>
        ) : (
          <DisabledControl label="Next" icon={<SkipForward className="size-9 fill-current" />} />
        )}
      </div>

      <p className="mt-3 max-w-sm text-xs text-mist">
        Playback happens in the YouTube app, so it works with CarPlay and your car&apos;s controls.
        Use Taxi DJ to pick what&apos;s next.
      </p>

      {/* Volume indicator: volume is controlled by the phone/car, not the web app. */}
      <div className="mt-5 flex w-full max-w-sm items-center gap-3 text-mist" aria-label="Volume is controlled on your phone or car">
        <Volume2 className="size-5 shrink-0" aria-hidden />
        <div className="h-1.5 flex-1 rounded-full bg-night-3">
          <div className="h-full w-2/3 rounded-full bg-mist/60" />
        </div>
        <span className="text-xs">Car / phone</span>
      </div>

      <div className="mt-6 grid w-full max-w-sm grid-cols-2 gap-3">
        <Link
          href={`/driver/ride/${ride.id}/queue`}
          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-night-3 font-bold"
        >
          <ListMusic className="size-5" aria-hidden /> Queue ({waitingCount})
        </Link>
        {current ? (
          <PlayLink
            item={current}
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-night-3 font-bold"
          >
            <ExternalLink className="size-5" aria-hidden /> Open YouTube
          </PlayLink>
        ) : (
          <span className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-line bg-night-3 font-bold opacity-40">
            <ExternalLink className="size-5" aria-hidden /> Open YouTube
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => player?.setMode("embedded")}
        className="mt-5 min-h-11 text-sm font-bold text-taxi underline"
      >
        Play inside Taxi DJ instead
      </button>
    </div>
  );
}

function DisabledControl({ label, icon, big = false }: { label: string; icon: React.ReactNode; big?: boolean }) {
  return (
    <button
      type="button"
      disabled
      aria-label={label}
      className={`grid place-items-center rounded-full opacity-30 ${big ? "size-24 bg-taxi text-ink" : "size-16 text-white"}`}
    >
      {icon}
    </button>
  );
}

/**
 * Estimated progress from when the song was started and its duration.
 * The YouTube app doesn't report position back to a web page, so this is
 * labelled as an estimate. A future provider with `capabilities.progress`
 * can feed real values here.
 */
function Progress({ item }: { item: QueueItem }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const total = item.duration_seconds;
  const started = item.started_at ? new Date(item.started_at).getTime() : null;
  if (!total || !started) return null;
  const elapsed = Math.min(total, Math.max(0, (now - started) / 1000));
  const pct = (elapsed / total) * 100;

  return (
    <div className="mt-5 w-full max-w-sm" aria-label="Estimated song progress">
      <div className="h-2 rounded-full bg-night-3" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={Math.round(elapsed)}>
        <div className="h-full rounded-full bg-taxi transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-xs text-mist">
        <span>~{formatDuration(elapsed)}</span>
        <span>{formatDuration(total)}</span>
      </div>
    </div>
  );
}
