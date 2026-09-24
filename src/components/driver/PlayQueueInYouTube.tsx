"use client";

import { ListVideo, Music2 } from "lucide-react";
import { usePlayer } from "@/components/driver/PlayerProvider";
import { useDriverRide } from "@/components/driver/RideContext";
import { nowPlaying } from "@/lib/queue";
import type { RequestSource } from "@/lib/types";
import { MAX_QUEUE_LINK_VIDEOS, youTubeQueueUrl } from "@/lib/youtube/parse";

/**
 * Hands the whole queue to YouTube Music / YouTube as one temporary playlist.
 * YouTube then plays the songs back-to-back itself, so playback continues
 * with the screen locked / app in the background (YouTube Premium) and
 * through CarPlay. Taxi DJ can't see YouTube's progress, so the driver
 * re-taps this after new songs are added.
 */
export function PlayQueueInYouTube() {
  const { queue, act } = useDriverRide();
  const player = usePlayer();
  const current = nowPlaying(queue);
  const queued = queue.filter((q) => q.status === "queued").sort((a, b) => a.position - b.position);
  const songs = [...(current ? [current] : []), ...queued].slice(0, MAX_QUEUE_LINK_VIDEOS);
  const ids = songs.map((s) => s.youtube_video_id);
  const first = songs[0];

  const handOff = () => {
    player?.handOff();
    if (first && first.id !== current?.id) act(first.id, "play");
  };

  const link = (target: RequestSource) => youTubeQueueUrl(ids, target);

  return (
    <section className="w-full rounded-3xl border border-play/40 bg-play/10 p-4 text-left">
      <h2 className="flex items-center gap-2 font-black">
        <ListVideo className="size-5 text-play" aria-hidden /> Background play (YouTube Premium)
      </h2>
      <p className="mt-1 text-sm text-mist">
        Sends {songs.length > 0 ? `all ${songs.length} song${songs.length === 1 ? "" : "s"}` : "the queue"} to
        YouTube as one playlist. It plays them back-to-back, even with the screen locked and through
        CarPlay. Added more songs? Tap again to update.
      </p>
      {first ? (
        <div className="mt-3 grid gap-2">
          <a
            href={link("youtube_music")!}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handOff}
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-play px-4 font-black text-white hover:bg-violet-400"
          >
            <Music2 className="size-5" aria-hidden /> Play queue in YouTube Music
          </a>
          <a
            href={link("youtube")!}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handOff}
            className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-play/50 px-4 text-sm font-bold text-white hover:bg-play/15"
          >
            <ListVideo className="size-4" aria-hidden /> Play queue in YouTube
          </a>
        </div>
      ) : (
        <p className="mt-3 flex min-h-14 items-center justify-center rounded-2xl bg-night-3 font-bold text-mist">
          Add songs to the queue first
        </p>
      )}
    </section>
  );
}
