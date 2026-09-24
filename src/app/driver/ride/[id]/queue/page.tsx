"use client";

import { QrCode as QrIcon } from "lucide-react";
import { ErrorBar } from "@/components/driver/ErrorBar";
import { QueueCard } from "@/components/driver/QueueCard";
import { useDriverRide } from "@/components/driver/RideContext";
import { ButtonLink, EmptyState } from "@/components/ui";
import { plural } from "@/lib/format";
import { upNext } from "@/lib/queue";

/**
 * The ride's full song list. Songs stay here for the whole ride — waiting,
 * playing and played — until the rider or driver removes them, or the ride
 * ends. Every song keeps its YouTube Music / YouTube buttons.
 */
export default function QueuePage() {
  const { ride, queue } = useDriverRide();
  const songs = queue
    .filter((q) => q.status === "pending" || q.status === "queued" || q.status === "playing" || q.status === "played")
    // Newest request on top, oldest at the bottom.
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime() || b.position - a.position);
  const waiting = upNext(queue);
  const playOrder = new Map(waiting.map((q, i) => [q.id, i]));
  const firstWaiting = waiting[0]?.id;
  const lastWaiting = waiting[waiting.length - 1]?.id;

  return (
    <div className="space-y-6 pb-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">
          Ride queue <span className="text-mist">({songs.length})</span>
        </h1>
        {songs.length > 0 && (
          <p className="text-sm text-mist">
            {plural(waiting.length, "song")} waiting · newest on top · songs stay until removed or the ride ends
          </p>
        )}
      </div>
      <ErrorBar />

      {songs.length === 0 ? (
        <EmptyState
          icon={<QrIcon className="size-7" />}
          title="Your queue is empty."
          action={<ButtonLink href={`/driver/ride/${ride.id}/qr`}>Show QR code</ButtonLink>}
        >
          Show the QR code and invite passengers to add a song.
        </EmptyState>
      ) : (
        <ol className="space-y-3">
          {songs.map((item) => (
            <QueueCard
              key={item.id}
              item={item}
              newestFirst
              label={playOrder.has(item.id) ? (playOrder.get(item.id) === 0 ? "Next" : `#${playOrder.get(item.id)! + 1}`) : undefined}
              isFirst={item.id === firstWaiting}
              isLast={item.id === lastWaiting}
            />
          ))}
        </ol>
      )}
    </div>
  );
}
