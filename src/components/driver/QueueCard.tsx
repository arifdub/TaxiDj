"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Ban, Check, Ellipsis, Play, Trash2, UserRound } from "lucide-react";
import { PlayLink } from "@/components/driver/PlayLink";
import { useDriverRide } from "@/components/driver/RideContext";
import { StatusBadge, Thumbnail } from "@/components/ui";
import { formatDuration } from "@/lib/format";
import type { QueueItem } from "@/lib/types";

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
