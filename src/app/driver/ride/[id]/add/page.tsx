"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, ChevronLeft, Link2, Search } from "lucide-react";
import { useDriverRide } from "@/components/driver/RideContext";
import { PastePanel, SearchPanel, TabButton } from "@/components/music/AddSongPanels";
import { Notice } from "@/components/ui";
import { driverAddSong } from "@/lib/api";
import { friendlyError } from "@/lib/errors";
import type { RequestSource, VideoResult } from "@/lib/types";

type Tab = "search" | "paste";

/** Driver adds songs to their own ride: YouTube search or paste a link. */
export default function DriverAddSongPage() {
  const { ride, queue, refresh } = useDriverRide();
  const [tab, setTab] = useState<Tab>("search");
  const [searchConfigured, setSearchConfigured] = useState<boolean | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((c) => {
        setSearchConfigured(Boolean(c.youtubeSearch));
        if (!c.youtubeSearch) setTab("paste");
      })
      .catch(() => setSearchConfigured(false));
  }, []);

  const inQueue = new Set(
    queue
      .filter((q) => q.status === "pending" || q.status === "queued" || q.status === "playing")
      .map((q) => q.youtube_video_id),
  );

  const add = useCallback(
    async (video: VideoResult, source: RequestSource) => {
      setAdding(video.videoId);
      setError(null);
      setAdded(null);
      try {
        await driverAddSong({
          rideId: ride.id,
          videoId: video.videoId,
          title: video.title,
          artist: video.channel,
          durationSeconds: video.durationSeconds,
          source,
        });
        setAdded(video.title);
      } catch (err) {
        setError(friendlyError(err));
      } finally {
        setAdding(null);
        refresh();
      }
    },
    [ride.id, refresh],
  );

  return (
    <div className="space-y-4 pb-6">
      <div className="flex items-center gap-2">
        <Link
          href={`/driver/ride/${ride.id}/queue`}
          aria-label="Back to queue"
          className="-ml-2 grid size-11 place-items-center rounded-full hover:bg-white/5"
        >
          <ChevronLeft className="size-7" aria-hidden />
        </Link>
        <h1 className="text-3xl font-black tracking-tight">Add a song</h1>
      </div>
      <p className="text-sm text-mist">
        Your songs go straight into the queue as <strong className="text-white">Driver</strong>, with
        no limit.
      </p>

      {added && (
        <div role="status" className="flex animate-fade-in items-center gap-3 rounded-2xl border border-go/40 bg-go/10 p-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-go text-white">
            <Check className="size-5" aria-hidden />
          </span>
          <p className="min-w-0 flex-1 text-sm">
            <strong className="block truncate">{added}</strong> added to the queue.
          </p>
          <Link href={`/driver/ride/${ride.id}/queue`} className="rounded-xl px-2 py-2 text-sm font-bold text-taxi underline">
            View queue
          </Link>
        </div>
      )}
      {error && <Notice tone="error">{error}</Notice>}

      {/* The shared search/paste panels are light-themed: show them on a card. */}
      <div className="rounded-3xl bg-white p-4 text-ink">
        <div role="tablist" aria-label="How to add a song" className="grid grid-cols-2 gap-2">
          <TabButton active={tab === "search"} onClick={() => setTab("search")} icon={<Search className="size-4" />}>
            Search YouTube
          </TabButton>
          <TabButton active={tab === "paste"} onClick={() => setTab("paste")} icon={<Link2 className="size-4" />}>
            Paste a link
          </TabButton>
        </div>
        <div className="mt-4">
          {tab === "search" ? (
            searchConfigured === false ? (
              <Notice tone="info">
                YouTube search isn&apos;t set up yet (add YOUTUBE_API_KEY in Vercel).{" "}
                <button type="button" className="font-bold underline" onClick={() => setTab("paste")}>
                  Paste a YouTube link instead
                </button>
                .
              </Notice>
            ) : (
              <SearchPanel
                onAdd={(v) => add(v, "youtube")}
                adding={adding}
                inQueue={inQueue}
                disabled={false}
                onUnavailable={() => setSearchConfigured(false)}
              />
            )
          ) : (
            <PastePanel onAdd={add} adding={adding} inQueue={inQueue} disabled={false} />
          )}
        </div>
      </div>
    </div>
  );
}
