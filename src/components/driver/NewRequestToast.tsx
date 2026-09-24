"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Music2, UserRound, X } from "lucide-react";
import type { QueueItem } from "@/lib/types";

const AUTO_DISMISS_MS = 8000;

/**
 * Calm, glanceable "NEW SONG REQUEST" card. No flashing or looping motion —
 * it slides in once and dismisses itself.
 */
export function NewRequestToast({
  items,
  rideId,
  dismiss,
}: {
  items: QueueItem[];
  rideId: string;
  dismiss: (id: string) => void;
}) {
  const latest = items[items.length - 1];

  useEffect(() => {
    if (!latest) return;
    const t = setTimeout(() => dismiss(latest.id), AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [latest, dismiss]);

  if (!latest) return null;
  const more = items.length - 1;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 px-4 safe-top" aria-live="polite">
      <div
        key={latest.id}
        role="status"
        className="pointer-events-auto mx-auto flex max-w-lg animate-slide-down items-center gap-3 rounded-3xl border border-taxi/50 bg-night-2 p-3 pr-2 shadow-2xl shadow-black/60"
      >
        <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-taxi text-ink">
          <Music2 className="size-6" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-wider text-taxi">
            New song request{more > 0 ? ` +${more}` : ""}
          </p>
          <p className="truncate font-bold">{latest.title}</p>
          <p className="flex items-center gap-1 truncate text-sm text-mist">
            <UserRound className="size-3.5" aria-hidden /> {latest.passenger?.nickname ?? "Passenger"}
          </p>
        </div>
        <Link
          href={`/driver/ride/${rideId}/queue`}
          onClick={() => items.forEach((i) => dismiss(i.id))}
          className="rounded-xl bg-taxi px-3 py-3 text-sm font-black text-ink"
        >
          VIEW QUEUE
        </Link>
        <button
          type="button"
          onClick={() => items.forEach((i) => dismiss(i.id))}
          aria-label="Dismiss"
          className="grid size-11 place-items-center rounded-full text-mist hover:bg-white/5"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
