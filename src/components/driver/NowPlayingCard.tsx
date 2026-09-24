"use client";

import Link from "next/link";
import { Music2, Play, SkipForward } from "lucide-react";
import { PlayLink } from "@/components/driver/PlayLink";
import { usePlayer } from "@/components/driver/PlayerProvider";
import { useDriverRide } from "@/components/driver/RideContext";
import { Thumbnail, YouTubeIcon } from "@/components/ui";
import { nextToPlay, nowPlaying } from "@/lib/queue";
import { providerFor } from "@/lib/playback";

/** Compact NOW PLAYING section for the ride dashboard. */
export function NowPlayingCard() {
  const { ride, queue, skip, busy } = useDriverRide();
  const current = nowPlaying(queue);
  const next = nextToPlay(queue);
  const player = usePlayer();
  const playback = providerFor(player?.mode ?? "external");

  // In-app mode: the docked YouTube player above already shows the song.
  if (player?.embedded && current) return null;

  return (
    <section aria-labelledby="now-playing" className="rounded-3xl border border-line bg-gradient-to-b from-night-2 to-night p-4">
      <h2 id="now-playing" className="mb-3 text-xs font-black uppercase tracking-widest text-taxi">
        Now playing
      </h2>

      {current ? (
        <div className="flex items-center gap-4">
          <Link href={`/driver/ride/${ride.id}/player`} className="shrink-0" aria-label="Open player">
            <Thumbnail src={current.thumbnail_url} className="size-24 sm:size-28" rounded="rounded-2xl" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 text-xl font-black leading-tight">{current.title}</p>
            <p className="mt-1 flex items-center gap-1.5 truncate text-mist">
              <YouTubeIcon className="h-3.5 w-auto shrink-0" /> {current.artist ?? "YouTube"}
            </p>
            <p className="mt-1 truncate text-xs font-semibold text-taxi">
              Requested by {current.passenger?.nickname ?? "a passenger"}
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-4">
          <div className="grid size-24 shrink-0 place-items-center rounded-2xl bg-night-3 text-mist">
            <Music2 className="size-10" aria-hidden />
          </div>
          <p className="text-mist">
            {next ? "Ready when you are. Tap play to start the queue." : "Nothing playing yet."}
          </p>
        </div>
      )}

      <div className="mt-4 grid grid-cols-[1fr_auto] gap-3">
        {current ? (
          <PlayLink
            item={current}
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-taxi px-4 text-lg font-black text-ink hover:bg-taxi-light"
          >
            <Play className="size-5 fill-current" aria-hidden /> {playback.actionLabel}
          </PlayLink>
        ) : next ? (
          <PlayLink
            item={next}
            onPlay={() => skip("next")}
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-taxi px-4 text-lg font-black text-ink hover:bg-taxi-light"
          >
            <Play className="size-5 fill-current" aria-hidden /> Play first song
          </PlayLink>
        ) : (
          <div className="flex min-h-14 items-center justify-center rounded-2xl bg-night-3 px-4 font-bold text-mist">
            Queue is empty
          </div>
        )}
        {next && current ? (
          <PlayLink
            item={next}
            onPlay={() => skip("next")}
            aria-label={`Next song: ${next.title}`}
            className="grid size-14 place-items-center rounded-2xl bg-night-3 text-white hover:bg-[#2c2c38]"
          >
            <SkipForward className="size-6 fill-current" aria-hidden />
          </PlayLink>
        ) : (
          <button
            type="button"
            disabled
            aria-label="Next song"
            className="grid size-14 place-items-center rounded-2xl bg-night-3 text-white opacity-40"
          >
            <SkipForward className="size-6 fill-current" aria-hidden />
          </button>
        )}
      </div>
      {busy === "skip" && <p className="sr-only" role="status">Updating queue…</p>}
    </section>
  );
}
