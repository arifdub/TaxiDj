"use client";

import { useState } from "react";
import { ChevronDown, CircleCheck, QrCode as QrIcon } from "lucide-react";
import { ErrorBar } from "@/components/driver/ErrorBar";
import { PlayLink } from "@/components/driver/PlayLink";
import { QueueCard } from "@/components/driver/QueueCard";
import { useDriverRide } from "@/components/driver/RideContext";
import { ButtonLink, EmptyState, StatusBadge, Thumbnail } from "@/components/ui";
import { history, nowPlaying, upNext } from "@/lib/queue";

export default function QueuePage() {
  const { ride, queue, act } = useDriverRide();
  const current = nowPlaying(queue);
  const waiting = upNext(queue);
  const played = history(queue);
  const [showPlayed, setShowPlayed] = useState(false);

  return (
    <div className="space-y-6 pb-6">
      <h1 className="text-3xl font-black tracking-tight">
        Up Next <span className="text-mist">({waiting.length})</span>
      </h1>
      <ErrorBar />

      {current && (
        <div className="flex items-center gap-3 rounded-3xl border border-go/40 bg-go/10 p-3">
          <Thumbnail src={current.thumbnail_url} className="size-14" />
          <div className="min-w-0 flex-1">
            <StatusBadge status="playing" />
            <p className="mt-1 truncate font-bold">{current.title}</p>
          </div>
          <button
            type="button"
            onClick={() => act(current.id, "finish")}
            className="flex min-h-12 items-center gap-1.5 rounded-2xl bg-night-3 px-3 text-sm font-bold"
          >
            <CircleCheck className="size-4" aria-hidden /> Done
          </button>
        </div>
      )}

      {waiting.length === 0 ? (
        <EmptyState
          icon={<QrIcon className="size-7" />}
          title="Your queue is empty."
          action={<ButtonLink href={`/driver/ride/${ride.id}/qr`}>Show QR code</ButtonLink>}
        >
          Show the QR code and invite passengers to add a song.
        </EmptyState>
      ) : (
        <ol className="space-y-3">
          {waiting.map((item, i) => (
            <QueueCard key={item.id} item={item} index={i} isFirst={i === 0} isLast={i === waiting.length - 1} />
          ))}
        </ol>
      )}

      {played.length > 0 && (
        <section>
          <button
            type="button"
            onClick={() => setShowPlayed((s) => !s)}
            aria-expanded={showPlayed}
            className="flex min-h-12 w-full items-center justify-between text-sm font-black uppercase tracking-widest text-mist"
          >
            Played ({played.length})
            <ChevronDown className={`size-5 transition-transform ${showPlayed ? "rotate-180" : ""}`} aria-hidden />
          </button>
          {showPlayed && (
            <ul className="mt-2 space-y-2">
              {played.map((item) => (
                <li key={item.id} className="flex items-center gap-3 rounded-2xl bg-night-2 p-2.5 opacity-80">
                  <Thumbnail src={item.thumbnail_url} className="size-12" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{item.title}</p>
                    <p className="truncate text-xs text-mist">{item.passenger?.nickname ?? "Passenger"}</p>
                  </div>
                  <PlayLink
                    item={item}
                    onPlay={() => act(item.id, "play")}
                    className="rounded-xl bg-night-3 px-3 py-3 text-xs font-bold"
                  >
                    Play again
                  </PlayLink>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
