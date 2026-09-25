"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Check, Link2, Search } from "lucide-react";
import { PastePanel, SearchPanel, SpotifyIcon, SpotifyPanel, TabButton } from "@/components/music/AddSongPanels";
import { PassengerHeader } from "@/components/passenger/PassengerFrame";
import { usePassenger } from "@/components/passenger/PassengerContext";
import { RequireJoined } from "@/components/passenger/RequireJoined";
import { Notice } from "@/components/ui";
import { addSongRequest } from "@/lib/api";
import { friendlyError } from "@/lib/errors";
import { matchSpotifyTrack } from "@/lib/music/client";
import type { RequestSource, SpotifyTrack, VideoResult } from "@/lib/types";

type Tab = "search" | "spotify" | "paste";

export default function MusicPage() {
  return (
    <RequireJoined>
      <PassengerHeader />
      <AddMusic />
    </RequireJoined>
  );
}

function AddMusic() {
  const { ride, queue, used, limit, refresh, code } = usePassenger();
  const [tab, setTab] = useState<Tab>("search");
  const [searchConfigured, setSearchConfigured] = useState<boolean | null>(null);
  // Spotify tab: pasted links work without Spotify keys; search needs keys.
  const [spotifyConfigured, setSpotifyConfigured] = useState(false);
  const [spotifySearch, setSpotifySearch] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((c) => {
        setSearchConfigured(Boolean(c.youtubeSearch));
        setSpotifyConfigured(Boolean(c.spotifyLinks ?? c.spotifySearch));
        setSpotifySearch(Boolean(c.spotifySearch));
        if (!c.youtubeSearch) setTab("paste");
      })
      .catch(() => setSearchConfigured(false));
  }, []);

  const limitReached = used >= limit;
  const inQueue = new Set(
    queue
      .filter((q) => q.status === "pending" || q.status === "queued" || q.status === "playing")
      .map((q) => q.youtube_video_id),
  );
  const spotifyInQueue = new Set(
    queue
      .filter((q) => q.spotify_track_id && (q.status === "pending" || q.status === "queued" || q.status === "playing"))
      .map((q) => q.spotify_track_id!),
  );

  const add = useCallback(
    async (
      video: VideoResult | (() => Promise<VideoResult>),
      source: RequestSource,
      opts: { spotifyTrackId?: string; key?: string } = {},
    ) => {
      if (!ride) return;
      setAdding(opts.key ?? (typeof video === "function" ? "" : video.videoId));
      setAddError(null);
      setAdded(null);
      try {
        // Spotify picks resolve to their YouTube match first.
        if (typeof video === "function") video = await video();
        await addSongRequest({
          rideId: ride.id,
          videoId: video.videoId,
          title: video.title,
          artist: video.channel,
          durationSeconds: video.durationSeconds,
          source,
          spotifyTrackId: opts.spotifyTrackId,
        });
        setAdded(video.title);
        await refresh();
      } catch (err) {
        setAddError(friendlyError(err));
        refresh();
      } finally {
        setAdding(null);
      }
    },
    [ride, refresh],
  );
  const addSpotify = (track: SpotifyTrack) =>
    add(() => matchSpotifyTrack(track), "youtube", { spotifyTrackId: track.spotifyId, key: track.spotifyId });


  return (
    <main className="flex-1 pb-8">
      <div className="mt-2 flex items-end justify-between">
        <h1 className="text-3xl font-black tracking-tight">Add music</h1>
        <p className="text-sm font-semibold text-zinc-600">
          Requests used{" "}
          <span className={`font-black ${limitReached ? "text-stop" : "text-ink"}`}>
            {used} / {limit}
          </span>
        </p>
      </div>
      <p className="text-sm text-zinc-500">{limit} requests maximum</p>

      {limitReached && (
        <Notice tone="info" className="mt-4">
          You&apos;ve reached your {limit}-song limit for this ride.{" "}
          <Link href={`/join/${code}/requests`} className="font-bold underline">
            See your requests
          </Link>
        </Notice>
      )}

      {added && (
        <div role="status" className="mt-4 flex animate-fade-in items-center gap-3 rounded-2xl bg-green-50 p-3 text-green-900 ring-1 ring-green-200">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-go text-white">
            <Check className="size-5" aria-hidden />
          </span>
          <p className="min-w-0 flex-1 text-sm">
            <strong className="block truncate">{added}</strong> added to the queue!
          </p>
          <Link href={`/join/${code}/requests`} className="rounded-xl px-2 py-2 text-sm font-bold underline">
            View
          </Link>
        </div>
      )}
      {addError && (
        <Notice tone="error" className="mt-4">
          {addError}
        </Notice>
      )}

      <div role="tablist" aria-label="How to add music" className={`mt-5 grid ${spotifyConfigured ? "grid-cols-3" : "grid-cols-2"} gap-2`}>
        <TabButton active={tab === "search"} onClick={() => setTab("search")} icon={<Search className="size-4" />}>
          Music
        </TabButton>
        {spotifyConfigured && (
          <TabButton active={tab === "spotify"} onClick={() => setTab("spotify")} icon={<SpotifyIcon className="size-4" />}>
            Spotify
          </TabButton>
        )}
        <TabButton active={tab === "paste"} onClick={() => setTab("paste")} icon={<Link2 className="size-4" />}>
          Paste link
        </TabButton>
      </div>

      <div className="mt-4">
        {tab === "spotify" ? (
            <SpotifyPanel
              searchEnabled={spotifySearch}
              onAdd={addSpotify}
              onAddVideo={(v, spotifyTrackId) => add(v, "youtube", { spotifyTrackId })}
              adding={adding}
              inQueue={spotifyInQueue}
              videoInQueue={inQueue}
              disabled={limitReached}
            />
          ) : tab === "search" ? (
          searchConfigured === false ? (
            <Notice tone="info">
              Music search isn&apos;t set up on this Taxi DJ yet.{" "}
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
              disabled={limitReached}
              onUnavailable={() => setSearchConfigured(false)}
            />
          )
        ) : (
          <PastePanel onAdd={add} adding={adding} inQueue={inQueue} disabled={limitReached} />
        )}
      </div>
    </main>
  );
}

