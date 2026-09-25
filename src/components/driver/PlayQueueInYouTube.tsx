"use client";

import { ListVideo } from "lucide-react";
import { usePlayer } from "@/components/driver/PlayerProvider";
import { useDriverRide } from "@/components/driver/RideContext";
import { plural } from "@/lib/format";
import { MAX_QUEUE_LINK_VIDEOS, youTubeQueueUrl } from "@/lib/youtube/parse";

/**
 * One button: send every song in the ride to the YouTube app as a single
 * playlist, in play order. YouTube then plays them back-to-back itself, so
 * music keeps going with the screen locked (YouTube Premium) and through
 * CarPlay. YouTube apps can't be told to add to their queue, so the driver
 * taps it again after riders add songs to get the updated playlist.
 */
export function PlayQueueInYouTube() {
  const { queue, sendToYouTube } = useDriverRide();
  const player = usePlayer();

  // Every approved song still in the ride's list, in play order.
  const songs = queue
    .filter((q) => q.status === "queued" || q.status === "playing" || q.status === "played")
    .sort((a, b) => a.position - b.position)
    .slice(0, MAX_QUEUE_LINK_VIDEOS);
  const href = youTubeQueueUrl(songs.map((q) => q.youtube_video_id));

  return (
    <section className="w-full rounded-3xl border border-play/40 bg-play/10 p-4 text-left">
      <h2 className="flex items-center gap-2 font-black">
        <ListVideo className="size-5 text-play" aria-hidden /> Background play (YouTube Premium)
      </h2>
      {href ? (
        <>
          <p className="mt-1 text-sm text-mist">
            Sends all {plural(songs.length, "song")} in this ride to the YouTube app as one playlist.
            It plays them back-to-back, even with the screen locked and through CarPlay. Riders
            added more? Tap again for the updated playlist.
          </p>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              player?.handOff();
              sendToYouTube(songs.map((q) => q.id));
            }}
            className="mt-3 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-play px-4 text-center font-black text-white hover:bg-violet-400"
          >
            <ListVideo className="size-5 shrink-0" aria-hidden /> Play all in YouTube playlist ({songs.length})
          </a>
        </>
      ) : (
        <p className="mt-3 flex min-h-14 items-center justify-center rounded-2xl bg-night-3 font-bold text-mist">
          Add songs to the queue first
        </p>
      )}
    </section>
  );
}
