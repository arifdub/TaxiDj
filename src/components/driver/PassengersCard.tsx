"use client";

import { useState } from "react";
import { UserMinus, Users } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useDriverRide } from "@/components/driver/RideContext";
import { removePassenger } from "@/lib/api";
import { friendlyError } from "@/lib/errors";
import { plural } from "@/lib/format";
import type { Passenger } from "@/lib/types";

/**
 * Who has joined this ride, with Remove: e.g. someone who kept the car QR
 * code but isn't in the car. Removed passengers lose their waiting songs and
 * can't add songs or rejoin this ride.
 */
export function PassengersCard() {
  const { ride, passengers, queue, refresh } = useDriverRide();
  const [target, setTarget] = useState<Passenger | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const riders = passengers.filter((p) => p.session_identifier !== ride.driver_id);
  if (riders.length === 0) return null;
  const active = riders.filter((p) => !p.removed_at);

  const songCount = (id: string) =>
    queue.filter((q) => q.passenger_id === id && q.status !== "removed" && q.status !== "rejected").length;

  async function confirmRemove() {
    if (!target) return;
    setBusy(true);
    setError(null);
    try {
      await removePassenger(target.id);
      setTarget(null);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
      refresh();
    }
  }

  return (
    <section aria-labelledby="passengers" className="rounded-3xl border border-line bg-night-2 p-4">
      <h2 id="passengers" className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-taxi">
        <Users className="size-4" aria-hidden /> Passengers <span className="text-mist">({active.length})</span>
      </h2>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
      <ul className="mt-2 divide-y divide-line">
        {riders.map((p) => (
          <li key={p.id} className={`flex min-h-12 items-center gap-3 py-1.5 ${p.removed_at ? "opacity-50" : ""}`}>
            <div className="min-w-0 flex-1">
              <p className="truncate font-bold">{p.nickname}</p>
              <p className="text-xs text-mist">
                {p.removed_at ? "Removed" : `${plural(songCount(p.id), "song")} added`}
              </p>
            </div>
            {!p.removed_at && (
              <button
                type="button"
                onClick={() => setTarget(p)}
                aria-label={`Remove ${p.nickname} from this ride`}
                className="flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-mist hover:bg-white/5 hover:text-red-300"
              >
                <UserMinus className="size-4" aria-hidden /> Remove
              </button>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={target !== null}
        title={`Remove ${target?.nickname ?? "passenger"}?`}
        body="Their songs that haven't played yet are removed, and they can't add songs or join this ride again."
        confirmLabel="Remove"
        onConfirm={confirmRemove}
        onCancel={() => setTarget(null)}
        loading={busy}
      />
    </section>
  );
}
