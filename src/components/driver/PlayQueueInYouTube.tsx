"use client";

import { ListVideo } from "lucide-react";
import { usePlayer } from "@/components/driver/PlayerProvider";
import { useDriverRide } from "@/components/driver/RideContext";
import { nowPlaying } from "@/lib/queue";
import { MAX_QUEUE_LINK_VIDEOS, youTubeQueueUrl } from "@/lib/youtube/parse";

/**
 * Hands the whole queue to YouTube as one temporary playlist. YouTube then
 * plays the songs back-to-back itself, so playback continues with the screen
 * locked / app in the background (YouTube Premium) and through CarPlay.
 * Taxi DJ can't see YouTube's progress, so the driver re-taps this after new
 * songs are added.
 */
export function PlayQueueInYouTube() {
  const { queue, act } = useDriverRide();
  const player = usePlayer();
  const current = nowPlaying(queue);
  const queued = queue.filter((q) => q.status === "queued").sort((a, b) => a.position - b.position);
  const songs = [...(current ? [current] : []), ...queued].slice(0, MAX_QUEUE_LINK_VIDEOS);
  const url = youTubeQueueUrl(songs.map((s) => s.youtube_video_id));
  const first = songs[0];

  return (
    <section className="w-full rounded-3xl border border-play/40 bg-play/10 p-4 text-left">
      <h2 className="flex items-center gap-2 font-black">
        <ListVideo className="size-5 text-play" aria-hidden /> Background play (YouTube Premium)
      </h2>
      <p className="mt-1 text-sm text-mist">
        Sends {songs.length > 0 ? `all ${songs.length} song${songs.length === 1 ? "" : "s"}` : "the queue"} to
        the YouTube app as one playlist. YouTube plays them back-to-back, even with the screen locked.
        Added more songs? Tap again to update.
      </p>
      {url && first ? (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => {
            player?.handOff();
            if (first.id !== current?.id) act(first.id, "play");
          }}
          className="mt-3 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-play px-4 font-black text-white hover:bg-violet-400"
        >
          <ListVideo className="size-5" aria-hidden /> Play queue in YouTube
        </a>
      ) : (
        <p className="mt-3 flex min-h-14 items-center justify-center rounded-2xl bg-night-3 font-bold text-mist">
          Add songs to the queue first
        </p>
      )}
    </section>
  );
}
