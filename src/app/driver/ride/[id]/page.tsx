"use client";

import Link from "next/link";
import { ChevronRight, Maximize2, Plus, QrCode as QrIcon, Share2 } from "lucide-react";
import { ErrorBar } from "@/components/driver/ErrorBar";
import { NowPlayingCard } from "@/components/driver/NowPlayingCard";
import { QueueCard } from "@/components/driver/QueueCard";
import { useDriverRide } from "@/components/driver/RideContext";
import { QrCode } from "@/components/QrCode";
import { Button, EmptyState } from "@/components/ui";
import { useShare } from "@/hooks/useShare";
import { displayUrl, joinUrl } from "@/lib/format";
import { upNext } from "@/lib/queue";

const PREVIEW_COUNT = 3;

/** Active ride dashboard — the driver's main screen. */
export default function RideDashboard() {
  const { ride, queue, confirmEnd } = useDriverRide();
  const waiting = upNext(queue);
  const url = joinUrl(ride.join_code);
  const { share, copied } = useShare();

  return (
    <div className="space-y-6 pb-6">
      <ErrorBar />
      <NowPlayingCard />

      <section aria-labelledby="up-next">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="up-next" className="text-xs font-black uppercase tracking-widest text-taxi">
            Up next {waiting.length > 0 && <span className="text-mist">({waiting.length})</span>}
          </h2>
          <div className="flex items-center gap-1">
          <Link
            href={`/driver/ride/${ride.id}/add`}
            className="flex min-h-11 items-center gap-1 rounded-xl px-2 text-sm font-bold text-taxi hover:bg-white/5"
          >
            <Plus className="size-4" aria-hidden /> Add song
          </Link>
          {waiting.length > 0 && (
            <Link
              href={`/driver/ride/${ride.id}/queue`}
              className="flex min-h-11 items-center gap-1 text-sm font-bold text-mist hover:text-white"
            >
              Manage queue <ChevronRight className="size-4" aria-hidden />
            </Link>
          )}
          </div>
        </div>
        {waiting.length === 0 ? (
          <EmptyState icon={<QrIcon className="size-7" />} title="Your queue is empty.">
            Show the QR code and invite passengers to add a song.
          </EmptyState>
        ) : (
          <ol className="space-y-3">
            {waiting.slice(0, PREVIEW_COUNT).map((item, i) => (
              <QueueCard key={item.id} item={item} label={i === 0 ? "Next" : String(i + 1)} isFirst={i === 0} isLast={i === waiting.length - 1} />
            ))}
            {waiting.length > PREVIEW_COUNT && (
              <li>
                <Link
                  href={`/driver/ride/${ride.id}/queue`}
                  className="flex min-h-12 items-center justify-center rounded-2xl border border-line text-sm font-bold text-mist hover:text-white"
                >
                  +{waiting.length - PREVIEW_COUNT} more in the queue
                </Link>
              </li>
            )}
          </ol>
        )}
      </section>

      <section aria-labelledby="join" className="rounded-3xl border border-line bg-night-2 p-4">
        <h2 id="join" className="sr-only">
          Passenger QR code
        </h2>
        <div className="flex items-center gap-4">
          <Link
            href={`/driver/ride/${ride.id}/qr`}
            className="relative shrink-0 rounded-2xl bg-white p-2"
            aria-label="Show large QR code"
          >
            <QrCode value={url} className="size-28" />
            <Maximize2 className="absolute -right-2 -top-2 size-7 rounded-full bg-taxi p-1.5 text-ink" aria-hidden />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-mist">Join code</p>
            <p className="font-mono text-4xl font-black tracking-[0.2em] text-taxi">{ride.join_code}</p>
            <p className="truncate text-sm text-mist">{displayUrl(url)}</p>
          </div>
        </div>
        <Button variant="dark" className="mt-4 w-full" onClick={() => share(url)}>
          <Share2 className="size-5" aria-hidden /> {copied ? "Link copied!" : "Share"}
        </Button>
      </section>

      <Button variant="danger" size="xl" className="w-full" onClick={confirmEnd}>
        END RIDE
      </Button>
    </div>
  );
}
