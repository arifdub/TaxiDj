"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Ban, Check, CircleCheck, Ellipsis, ListVideo, Music2, Play, Trash2, UserRound } from "lucide-react";
import { PlayLink } from "@/components/driver/PlayLink";
import { usePlayer } from "@/components/driver/PlayerProvider";
import { useDriverRide } from "@/components/driver/RideContext";
import { StatusBadge, Thumbnail } from "@/components/ui";
import { formatDuration } from "@/lib/format";
import type { QueueItem, RequestSource } from "@/lib/types";
import { youTubeWatchUrl } from "@/lib/youtube/parse";

/** One song in the driver's UP NEXT list, with play + management actions. */
export function QueueCard({
  item,
  index,
  isFirst,
  isLast,
}: {
  item: QueueItem;
  index: number;
  isFirst: boolean;
  isLast: boolean;
}) {
  const { act, busy } = useDriverRide();
  const player = usePlayer();
  const [open, setOpen] = useState(false);
  const pending = item.status === "pending";
  const working = busy === item.id;

  return (
    <li
      className={`rounded-3xl border bg-night-2 p-3 transition-colors ${
        pending ? "border-amber-400/40" : "border-line"
      } ${working ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-3">
        <span className="w-6 text-center font-mono text-lg font-black text-mist" aria-label={`Position ${index + 1}`}>
          {index + 1}
        </span>
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
        <PlayLink
          item={item}
          onPlay={() => act(item.id, "play")}
          aria-label={`Play ${item.title} now`}
          className="grid size-14 shrink-0 place-items-center rounded-full bg-taxi text-ink hover:bg-taxi-light"
        >
          <Play className="size-6 fill-current" aria-hidden />
        </PlayLink>
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
      <div className="mt-3 grid grid-cols-2 gap-2">
        <OpenInApp item={item} target="youtube_music" onOpen={() => { player?.handOff(); act(item.id, "play"); }} />
        <OpenInApp item={item} target="youtube" onOpen={() => { player?.handOff(); act(item.id, "play"); }} />
      </div>
      {item.sent_to_youtube_at && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-play">
          <CircleCheck className="size-3.5" aria-hidden /> Sent to YouTube
        </p>
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
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
          <ActionButton onClick={() => act(item.id, "move_up")} icon={<ArrowUp />} label="Move up" disabled={isFirst || working} />
          <ActionButton onClick={() => act(item.id, "move_down")} icon={<ArrowDown />} label="Move down" disabled={isLast || working} />
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
