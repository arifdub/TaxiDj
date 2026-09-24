"use client";

import { CircleCheck, ListVideo, Music2, RotateCcw } from "lucide-react";
import { usePlayer } from "@/components/driver/PlayerProvider";
import { useDriverRide } from "@/components/driver/RideContext";
import { plural } from "@/lib/format";
import { nowPlaying } from "@/lib/queue";
import type { QueueItem, RequestSource } from "@/lib/types";
import { MAX_QUEUE_LINK_VIDEOS, youTubeQueueUrl } from "@/lib/youtube/parse";

/**
 * Background play via the YouTube / YouTube Music app (works with the screen
 * locked for YouTube Premium members).
 *
 * YouTube doesn't let other apps add to its "Up next" queue, so songs are
 * handed over as a temporary playlist. Taxi DJ remembers what was already
 * sent (song_requests.sent_to_youtube_at), so after the first hand-off the
 * button sends only the songs riders added since.
 */
export function PlayQueueInYouTube() {
  const { queue, sendToYouTube } = useDriverRide();
  const player = usePlayer();
  const current = nowPlaying(queue);
  const queued = queue.filter((q) => q.status === "queued").sort((a, b) => a.position - b.position);
  const all = [...(current ? [current] : []), ...queued];
  const unsent = all.filter((q) => !q.sent_to_youtube_at);
  const anySent = queue.some((q) => q.sent_to_youtube_at);

  // Every song still in the ride's list (played songs stay until removed).
  const rideSongs = queue
    .filter((q) => q.status === "pending" || q.status === "queued" || q.status === "playing" || q.status === "played")
    .sort((a, b) => a.position - b.position)
    .slice(0, MAX_QUEUE_LINK_VIDEOS);
  const hasPlayed = rideSongs.some((q) => q.status === "played");
  const sendWhole = () => {
    player?.handOff();
    sendToYouTube(rideSongs.map((q) => q.id));
  };

  const batch = (anySent ? unsent : all).slice(0, MAX_QUEUE_LINK_VIDEOS);
  const isUpdate = anySent && unsent.length > 0;

  return (
    <section className="w-full rounded-3xl border border-play/40 bg-play/10 p-4 text-left">
      <h2 className="flex items-center gap-2 font-black">
        <ListVideo className="size-5 text-play" aria-hidden /> Background play (YouTube Premium)
      </h2>

      {batch.length > 0 ? (
        <>
          <p className="mt-1 text-sm text-mist">
            {isUpdate ? (
              <>
                <strong className="text-white">{plural(unsent.length, "new song")}</strong> since you last
                sent the queue. Tap when YouTube finishes the songs you sent; the new songs start
                straight away.
              </>
            ) : (
              <>
                Sends {plural(batch.length, "song")} to YouTube as one playlist. It plays them
                back-to-back, even with the screen locked and through CarPlay.
              </>
            )}
          </p>
          <SendButtons
            batch={batch}
            label={isUpdate ? `Send ${plural(batch.length, "new song")} to` : "Play queue in"}
            onSend={() => {
              player?.handOff();
              sendToYouTube(batch.map((q) => q.id));
            }}
          />
          {hasPlayed && (
            <SendButtons
              batch={rideSongs}
              label={`Play whole ride playlist (${rideSongs.length}) in`}
              subtle
              onSend={sendWhole}
            />
          )}
        </>
      ) : anySent && rideSongs.length > 0 ? (
        <>
          <p className="mt-2 flex items-center gap-2 text-sm font-bold text-go">
            <CircleCheck className="size-4" aria-hidden /> All songs are in YouTube. New requests will
            appear here to send.
          </p>
          <SendButtons
            batch={rideSongs}
            label={`Play whole ride playlist (${rideSongs.length}) in`}
            subtle
            onSend={sendWhole}
          />
        </>
      ) : (
        <p className="mt-3 flex min-h-14 items-center justify-center rounded-2xl bg-night-3 font-bold text-mist">
          Add songs to the queue first
        </p>
      )}
    </section>
  );
}

function SendButtons({
  batch,
  label,
  onSend,
  subtle = false,
}: {
  batch: QueueItem[];
  label: string;
  onSend: () => void;
  subtle?: boolean;
}) {
  const ids = batch.map((q) => q.youtube_video_id);
  const link = (target: RequestSource) => youTubeQueueUrl(ids, target)!;
  const secondary =
    "flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-play/50 px-4 text-sm font-bold text-white hover:bg-play/15";

  return (
    <div className="mt-3 grid gap-2">
      <a
        href={link("youtube_music")}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onSend}
        className={
          subtle
            ? secondary
            : "flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-play px-4 font-black text-white hover:bg-violet-400"
        }
      >
        {subtle ? <RotateCcw className="size-4" aria-hidden /> : <Music2 className="size-5" aria-hidden />}
        {label} YouTube Music
      </a>
      <a href={link("youtube")} target="_blank" rel="noopener noreferrer" onClick={onSend} className={secondary}>
        <ListVideo className="size-4" aria-hidden /> {label} YouTube
      </a>
    </div>
  );
}
