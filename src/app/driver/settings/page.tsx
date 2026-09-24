"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LogOut, Minus, Plus } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { DriverGate } from "@/components/driver/DriverGate";
import { DriverShell } from "@/components/driver/DriverShell";
import { Button, Notice, Skeleton } from "@/components/ui";
import { ensureDriver, updateDriverSettings } from "@/lib/api";
import { friendlyError } from "@/lib/errors";
import { supabase } from "@/lib/supabase/client";
import { usePlaybackMode } from "@/hooks/usePlaybackMode";
import type { PlaybackMode } from "@/lib/playback";
import type { Driver } from "@/lib/types";

export default function SettingsPage() {
  return (
    <DriverGate>
      {(user) => (
        <DriverShell title="Settings" backHref="/">
          <SettingsForm user={user} />
        </DriverShell>
      )}
    </DriverGate>
  );
}

function SettingsForm({ user }: { user: User }) {
  const router = useRouter();
  const [driver, setDriver] = useState<Driver | null>(null);
  const [name, setName] = useState("");
  const [requireApproval, setRequireApproval] = useState(false);
  const [limit, setLimit] = useState(3);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    ensureDriver()
      .then((d) => {
        setDriver(d);
        setName(d.display_name);
        setRequireApproval(!d.auto_approve);
        setLimit(d.max_requests_per_passenger);
      })
      .catch((err) => setMessage({ tone: "error", text: friendlyError(err) }));
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const d = await updateDriverSettings({
        displayName: name,
        autoApprove: !requireApproval,
        maxRequestsPerPassenger: limit,
      });
      setDriver(d);
      setMessage({ tone: "success", text: "Saved. Changes apply to your next ride." });
    } catch (err) {
      setMessage({ tone: "error", text: friendlyError(err) });
    } finally {
      setSaving(false);
    }
  }

  async function signOut() {
    await supabase().auth.signOut();
    router.push("/");
  }

  if (!driver && !message) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {driver && (
        <form onSubmit={save} className="space-y-4">
          <div className="rounded-3xl border border-line bg-night-2 p-4">
            <label htmlFor="display-name" className="font-bold">
              Car name
            </label>
            <p id="display-name-help" className="text-sm text-mist">
              Passengers see this when they join, e.g. &ldquo;Arif&apos;s Car&rdquo;.
            </p>
            <input
              id="display-name"
              aria-describedby="display-name-help"
              value={name}
              maxLength={40}
              required
              onChange={(e) => setName(e.target.value)}
              className="mt-3 h-14 w-full rounded-2xl border border-line bg-night-3 px-4 text-lg focus:border-taxi focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-4 rounded-3xl border border-line bg-night-2 p-4">
            <div className="flex-1">
              <p className="font-bold" id="songs-label">
                Max songs per passenger
              </p>
              <p className="text-sm text-mist">How many songs each passenger can add per ride.</p>
            </div>
            <div className="flex items-center gap-2" role="group" aria-labelledby="songs-label">
              <button
                type="button"
                aria-label="Fewer songs"
                onClick={() => setLimit((l) => Math.max(1, l - 1))}
                className="grid size-11 place-items-center rounded-full bg-night-3"
              >
                <Minus className="size-5" aria-hidden />
              </button>
              <output className="w-8 text-center text-2xl font-black" aria-live="polite">
                {limit}
              </output>
              <button
                type="button"
                aria-label="More songs"
                onClick={() => setLimit((l) => Math.min(10, l + 1))}
                className="grid size-11 place-items-center rounded-full bg-night-3"
              >
                <Plus className="size-5" aria-hidden />
              </button>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-4 rounded-3xl border border-line bg-night-2 p-4">
            <div className="flex-1">
              <p className="font-bold">Approve songs before they&apos;re queued</p>
              <p className="text-sm text-mist">
                Off: songs go straight into the queue (fewer taps while driving).
              </p>
            </div>
            <input
              type="checkbox"
              role="switch"
              checked={requireApproval}
              onChange={(e) => setRequireApproval(e.target.checked)}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className="relative h-8 w-14 shrink-0 rounded-full bg-night-3 transition-colors peer-checked:bg-taxi peer-focus-visible:outline-3 peer-focus-visible:outline-taxi after:absolute after:left-1 after:top-1 after:size-6 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-6"
            />
          </label>

          <Button type="submit" className="w-full" loading={saving}>
            Save settings
          </Button>
        </form>
      )}

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <PlaybackModeSetting />

      <div className="rounded-3xl border border-line bg-night-2 p-4">
        <p className="font-bold">Account</p>
        <p className="text-sm text-mist">
          {user.is_anonymous ? "Guest driver (this device only)" : (user.email ?? "Signed in")}
        </p>
        <Button variant="dark" size="md" className="mt-3" onClick={signOut}>
          <LogOut className="size-4" aria-hidden /> Sign out
        </Button>
      </div>
    </div>
  );
}

const MODES: { value: PlaybackMode; title: string; body: string }[] = [
  {
    value: "embedded",
    title: "Taxi DJ player",
    body: "Plays inside Taxi DJ with play, pause, stop and next controls, and moves to the next song automatically. Keep Taxi DJ open while music plays.",
  },
  {
    value: "external",
    title: "YouTube app",
    body: "Opens each song in the YouTube or YouTube Music app. Keeps playing with the screen locked. Tap Next in Taxi DJ for each song.",
  },
];

function PlaybackModeSetting() {
  const [mode, setMode] = usePlaybackMode();
  return (
    <fieldset className="rounded-3xl border border-line bg-night-2 p-4">
      <legend className="float-left w-full font-bold">Play music in</legend>
      <p className="clear-both text-sm text-mist">Saved on this device.</p>
      <div className="mt-3 space-y-2">
        {MODES.map((m) => (
          <label
            key={m.value}
            className={`flex cursor-pointer gap-3 rounded-2xl border p-3 ${
              mode === m.value ? "border-taxi bg-taxi/10" : "border-line bg-night-3"
            }`}
          >
            <input
              type="radio"
              name="playback-mode"
              value={m.value}
              checked={mode === m.value}
              onChange={() => setMode(m.value)}
              className="mt-1 size-5 shrink-0 accent-taxi"
            />
            <span>
              <span className="block font-bold">{m.title}</span>
              <span className="block text-sm text-mist">{m.body}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
