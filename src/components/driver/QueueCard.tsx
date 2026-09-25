"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, AudioLines, Ban, Check, CircleCheck, Ellipsis, ListVideo, Music2, Pause, Play, Trash2, UserRound } from "lucide-react";
import { PlayLink } from "@/components/driver/PlayLink";
import { SpotifyIcon } from "@/components/music/AddSongPanels";
import { usePlayer } from "@/components/driver/PlayerProvider";
import { useDriverRide } from "@/components/driver/RideContext";
import { StatusBadge, Thumbnail } from "@/components/ui";
import { formatDuration } from "@/lib/format";
import type { QueueItem, RequestSource } from "@/lib/types";
import { youTubeWatchUrl } from "@/lib/youtube/parse";

/** One song in the driver's UP NEXT list, with play + management actions. */
export function QueueCard({
  item,
  label,
  isFirst,
  isLast,
  newestFirst = false,
}: {
  item: QueueItem;
  /** Short label shown at the left, e.g. "1" or "Next". */
  label?: string;
  isFirst: boolean;
  isLast: boolean;
  /** List shows newest songs on top, so visual "up" is later in play order. */
  newestFirst?: boolean;
}) {
  const { act, busy } = useDriverRide();
  const player = usePlayer();
  const [open, setOpen] = useState(false);
  const pending = item.status === "pending";
  const playing = item.status === "playing";
  const played = item.status === "played";
  const waiting = pending || item.status === "queued";
  const working = busy === item.id;
  const audible = player?.status === "playing" || player?.status === "buffering";
  const playNow = () => {
    if (!playing) act(item.id, "play");
  };

  return (
    <li
      className={`rounded-3xl border bg-night-2 p-3 transition-colors ${
        pending ? "border-amber-400/40" : playing ? "border-go/50 bg-go/10" : "border-line"
      } ${played ? "opacity-80" : ""} ${working ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-3">
        {label && (
          <span
            className={`shrink-0 text-center font-black ${
              label === "Next" ? "rounded-lg bg-taxi px-1.5 py-0.5 text-xs uppercase text-ink" : "w-6 font-mono text-lg text-mist"
            }`}
          >
            {label}
          </span>
        )}
        <Thumbnail src={item.thumbnail_url} className="size-16" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-base font-bold leading-tight">{item.title}</p>
          <p className="truncate text-sm text-mist">
            {item.artist ?? "YouTube"}
            {item.duration_seconds ? ` · ${formatDuration(item.duration_seconds)}` : ""}
          </p>
          <p className="mt-1 flex items-center gap-1 truncate text-xs font-semibold text-taxi">
            <UserRound className="size-3.5" aria-hidden /> {item.passenger?.nickname ?? "Passenger"}
          </p>
        </div>
        {playing && player?.embedded ? (
          // The song in the Taxi DJ player: Pause while playing, Play when paused.
          <button
            type="button"
            onClick={() => (audible ? player.pause() : player.load(item))}
            aria-label={audible ? `Pause ${item.title}` : `Resume ${item.title}`}
            className="grid size-14 shrink-0 place-items-center rounded-full bg-taxi text-ink hover:bg-taxi-light"
          >
            {audible ? <Pause className="size-6 fill-current" aria-hidden /> : <Play className="ml-0.5 size-6 fill-current" aria-hidden />}
          </button>
        ) : playing ? (
          // Playing in the YouTube app: show that it's on; tapping reopens it.
          <PlayLink
            item={item}
            aria-label={`${item.title} is playing in YouTube`}
            className="grid size-14 shrink-0 place-items-center rounded-full bg-go text-ink"
          >
            <AudioLines className="size-6" aria-hidden />
          </PlayLink>
        ) : (
          <PlayLink
            item={item}
            onPlay={playNow}
            aria-label={`Play ${item.title} ${played ? "again" : "now"}`}
            className="grid size-14 shrink-0 place-items-center rounded-full bg-taxi text-ink hover:bg-taxi-light"
          >
            <Play className="ml-0.5 size-6 fill-current" aria-hidden />
          </PlayLink>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-label={`More options for ${item.title}`}
          className="grid size-11 shrink-0 place-items-center rounded-full text-mist hover:bg-white/5"
        >
          <Ellipsis className="size-6" aria-hidden />
        </button>
      </div>

      {/* Open just this song in the YouTube Music / YouTube app (plays now). */}
      <div className={`mt-3 grid gap-2 ${item.spotify_url ? "grid-cols-3" : "grid-cols-2"}`}>
        <OpenInApp item={item} target="youtube_music" onOpen={() => { player?.handOff(); playNow(); }} />
        <OpenInApp item={item} target="youtube" onOpen={() => { player?.handOff(); playNow(); }} />
        {item.spotify_url && (
          // Picked from Spotify: play the exact track in the Spotify app.
          <a
            href={item.spotify_url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => { player?.handOff(); playNow(); }}
            aria-label={`Play ${item.title} in Spotify`}
            className="flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-[#1DB954]/50 bg-[#1DB954]/15 px-2 text-sm font-bold text-white hover:bg-[#1DB954]/25"
          >
            <SpotifyIcon className="size-4 shrink-0" /> Spotify
          </a>
        )}
      </div>
      {(playing || played || item.sent_to_youtube_at) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {(playing || played) && <StatusBadge status={item.status} />}
          {item.sent_to_youtube_at && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-play">
              <CircleCheck className="size-3.5" aria-hidden /> Sent to YouTube
            </span>
          )}
        </div>
      )}

      {pending && (
        <div className="mt-3 flex items-center gap-2">
          <StatusBadge status="pending" />
          <div className="flex-1" />
          <ActionButton onClick={() => act(item.id, "reject")} icon={<Ban />} label="Reject" tone="danger" disabled={working} />
          <ActionButton onClick={() => act(item.id, "approve")} icon={<Check />} label="Approve" tone="go" disabled={working} />
        </div>
      )}

      {open && (
        <div className={`mt-3 grid gap-2 border-t border-line pt-3 ${waiting ? "grid-cols-3" : "grid-cols-2"}`}>
          {waiting && (
            <>
              <ActionButton
                onClick={() => act(item.id, newestFirst ? "move_down" : "move_up")}
                icon={<ArrowUp />}
                label={newestFirst ? "Play later" : "Move up"}
                disabled={(newestFirst ? isLast : isFirst) || working}
              />
              <ActionButton
                onClick={() => act(item.id, newestFirst ? "move_up" : "move_down")}
                icon={<ArrowDown />}
                label={newestFirst ? "Play sooner" : "Move down"}
                disabled={(newestFirst ? isFirst : isLast) || working}
              />
            </>
          )}
          {playing && (
            <ActionButton onClick={() => act(item.id, "finish")} icon={<CircleCheck />} label="Done" disabled={working} />
          )}
          <ActionButton
            onClick={() => act(item.id, "remove")}
            icon={<Trash2 />}
            label="Remove"
            tone="danger"
            disabled={working}
          />
        </div>
      )}
    </li>
  );
}

function OpenInApp({
  item,
  target,
  onOpen,
}: {
  item: QueueItem;
  target: RequestSource;
  onOpen: () => void;
}) {
  const music = target === "youtube_music";
  return (
    <a
      href={youTubeWatchUrl(item.youtube_video_id, target)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onOpen}
      aria-label={`Play ${item.title} in ${music ? "YouTube Music" : "YouTube"}`}
      className="flex min-h-11 items-center justify-center gap-1.5 rounded-2xl border border-play/40 bg-play/10 px-2 text-sm font-bold text-white hover:bg-play/20"
    >
      {music ? <Music2 className="size-4 text-play" aria-hidden /> : <ListVideo className="size-4 text-play" aria-hidden />}
      {music ? "YouTube Music" : "YouTube"}
    </a>
  );
}

function ActionButton({
  onClick,
  icon,
  label,
  tone = "neutral",
  disabled,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tone?: "neutral" | "danger" | "go";
  disabled?: boolean;
}) {
  const color = {
    neutral: "bg-night-3 text-white",
    danger: "bg-stop/15 text-red-300",
    go: "bg-go/20 text-green-300",
  }[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex min-h-12 items-center justify-center gap-1.5 rounded-2xl px-3 text-sm font-bold disabled:opacity-40 [&_svg]:size-4 ${color}`}
    >
      {icon}
      {label}
    </button>
  );
}
