"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LocateFixed, Pause, Play, Radio, Search, Square } from "lucide-react";
import { useRadio } from "@/components/driver/RadioProvider";
import { useDriverRide } from "@/components/driver/RideContext";
import { nowPlaying } from "@/lib/queue";
import { Spinner } from "@/components/ui";
import type { RadioStation } from "@/lib/radio/stations";

// "Local radio" section at the bottom of the Player tab.

const SHOW = 12;

function canPlay(s: RadioStation) {
  if (!s.hls) return true;
  // HLS (.m3u8) streams play natively in Safari only.
  return typeof document !== "undefined" && document.createElement("audio").canPlayType("application/vnd.apple.mpegurl") !== "";
}

export function RadioCard() {
  const radio = useRadio();
  const [stations, setStations] = useState<RadioStation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [label, setLabel] = useState("Popular in your country");
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async (params: Record<string, string>, nextLabel: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/radio/stations?${new URLSearchParams(params)}`);
      if (!res.ok) throw new Error();
      const data = (await res.json()) as { stations: RadioStation[] };
      setStations(data.stations.filter(canPlay));
      setLabel(nextLabel);
      setShowAll(false);
    } catch {
      setError("Radio stations couldn't be loaded right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load({}, "Popular in your country"), 0);
    return () => clearTimeout(t);
  }, [load]);

  const nearMe = () => {
    if (!("geolocation" in navigator)) return setError("Location isn't available on this device.");
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => load({ lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) }, "Stations near you"),
      () => {
        setLoading(false);
        setError("Location is off. Showing popular stations in your country instead.");
      },
      { maximumAge: 600_000, timeout: 10_000 },
    );
  };

  const search = (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q) load({ q }, `Results for “${q}”`);
    else load({}, "Popular in your country");
  };

  if (!radio) return null;
  const list = stations ? (showAll ? stations : stations.slice(0, SHOW)) : [];

  return (
    <section aria-labelledby="radio" className="mt-8 w-full rounded-3xl border border-line bg-night-2 p-4 text-left">
      <h2 id="radio" className="flex items-center gap-2 text-lg font-black">
        <Radio className="size-5 text-taxi" aria-hidden /> Local radio
      </h2>
      <p className="mt-1 text-sm text-mist">
        For when the queue is empty. When a passenger&apos;s song plays, the radio pauses, and it comes back on when
        the queue is finished.
      </p>

      {radio.station && <NowOnAir />}

      <div className="mt-4 flex gap-2">
        <form onSubmit={search} role="search" className="relative flex-1">
          <label htmlFor="radio-search" className="sr-only">
            Search radio stations
          </label>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-mist" aria-hidden />
          <input
            id="radio-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Station name…"
            enterKeyHint="search"
            maxLength={60}
            className="h-12 w-full rounded-2xl border border-line bg-night-3 pl-9 pr-3 text-white placeholder:text-mist/60 focus:border-taxi focus:outline-none"
          />
        </form>
        <button
          type="button"
          onClick={nearMe}
          className="flex h-12 shrink-0 items-center gap-1.5 rounded-2xl bg-night-3 px-3 text-sm font-bold text-white hover:bg-white/10"
        >
          <LocateFixed className="size-4 text-taxi" aria-hidden /> Near me
        </button>
      </div>

      <h3 className="mt-4 text-xs font-black uppercase tracking-widest text-mist">{label}</h3>
      <div aria-live="polite">
        {loading ? (
          <p className="flex items-center gap-2 py-6 text-sm text-mist">
            <Spinner className="size-4" /> Finding stations…
          </p>
        ) : error ? (
          <p className="py-4 text-sm text-red-300">{error}</p>
        ) : list.length === 0 ? (
          <p className="py-4 text-sm text-mist">No stations found. Try another name.</p>
        ) : (
          <ul className="mt-1 divide-y divide-line">
            {list.map((s) => (
              <StationRow key={s.id} station={s} />
            ))}
          </ul>
        )}
        {!loading && stations && stations.length > SHOW && !showAll && (
          <button type="button" onClick={() => setShowAll(true)} className="mt-2 min-h-11 w-full rounded-2xl text-sm font-bold text-mist hover:text-white">
            Show {stations.length - SHOW} more
          </button>
        )}
      </div>
      <p className="mt-3 text-[11px] text-mist">
        Station list from{" "}
        <a href="https://www.radio-browser.info" target="_blank" rel="noopener noreferrer" className="underline">
          radio-browser.info
        </a>
        . Streams come straight from each station.
      </p>
    </section>
  );
}

function StationLogo({ station, className }: { station: RadioStation; className: string }) {
  const [broken, setBroken] = useState(false);
  return station.favicon && !broken ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={station.favicon} alt="" onError={() => setBroken(true)} className={`${className} rounded-xl bg-white object-contain`} />
  ) : (
    <span className={`${className} grid place-items-center rounded-xl bg-night-3 text-taxi`}>
      <Radio className="size-1/2" aria-hidden />
    </span>
  );
}

function place(s: RadioStation) {
  return [s.state, s.countryCode].filter(Boolean).join(", ");
}

function StationRow({ station }: { station: RadioStation }) {
  const radio = useRadio()!;
  const current = radio.station?.id === station.id;
  const on = current && (radio.status === "playing" || radio.status === "loading");
  return (
    <li>
      <button
        type="button"
        onClick={() => (current ? radio.toggle() : radio.play(station))}
        aria-label={`${on ? "Pause" : "Play"} ${station.name}`}
        className={`flex min-h-14 w-full items-center gap-3 py-2 text-left ${current ? "text-taxi" : "text-white"}`}
      >
        <StationLogo station={station} className="size-10 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{station.name}</span>
          <span className="block truncate text-xs text-mist">
            {[place(station), station.distanceKm != null ? `${station.distanceKm} km` : null, station.tags.slice(0, 2).join(" · ")]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        {current && radio.status === "loading" ? (
          <Spinner className="size-5" />
        ) : on ? (
          <Pause className="size-5 fill-current" aria-hidden />
        ) : (
          <Play className="size-5 fill-current" aria-hidden />
        )}
      </button>
    </li>
  );
}

function NowOnAir() {
  const radio = useRadio()!;
  const s = radio.station!;
  const on = radio.status === "playing" || radio.status === "loading";
  return (
    <div className="mt-4 flex items-center gap-3 rounded-2xl border border-taxi/40 bg-taxi/10 p-3">
      <StationLogo station={s} className="size-12 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-black uppercase tracking-widest text-taxi">
          {radio.status === "error"
            ? "Station unavailable"
            : radio.waitingForQueue
              ? "Paused for the queue"
              : on
                ? "On air"
                : "Paused"}
        </p>
        <p className="truncate font-bold">{s.name}</p>
        <p className="truncate text-xs text-mist">
          {radio.status === "error" ? "This stream isn't working. Try another station." : place(s)}
        </p>
      </div>
      <button
        type="button"
        onClick={radio.toggle}
        aria-label={on ? "Pause radio" : "Play radio"}
        className="grid size-12 shrink-0 place-items-center rounded-full bg-taxi text-ink"
      >
        {radio.status === "loading" ? (
          <Spinner className="size-5" />
        ) : on ? (
          <Pause className="size-5 fill-current" aria-hidden />
        ) : (
          <Play className="ml-0.5 size-5 fill-current" aria-hidden />
        )}
      </button>
      <button
        type="button"
        onClick={radio.stop}
        aria-label="Stop radio"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-night-3 text-white"
      >
        <Square className="size-4 fill-current" aria-hidden />
      </button>
    </div>
  );
}

/** Small "on air" pill on the other ride tabs while the radio plays. */
export function RadioMiniBar() {
  const radio = useRadio();
  const { queue } = useDriverRide();
  // Not on the Player tab (full controls there) or while a song is loaded
  // (the song player is docked at the bottom).
  const hidden = usePathname().endsWith("/player") || Boolean(nowPlaying(queue));
  if (hidden || !radio?.station) return null;
  const on = radio.status === "playing" || radio.status === "loading";
  if (!on) return null;
  return (
    <div
      className="fixed left-3 z-30 flex max-w-[60vw] items-center gap-2 rounded-full border border-taxi/40 bg-night-2/95 py-1 pl-3 pr-1 text-xs font-bold text-white shadow-lg backdrop-blur"
      style={{ bottom: "calc(max(1rem, env(safe-area-inset-bottom)) + 4.75rem)" }}
    >
      <Radio className="size-4 shrink-0 text-taxi" aria-hidden />
      <span className="truncate">{radio.station.name}</span>
      <button type="button" onClick={radio.toggle} aria-label="Pause radio" className="grid size-9 shrink-0 place-items-center rounded-full bg-taxi text-ink">
        <Pause className="size-4 fill-current" aria-hidden />
      </button>
    </div>
  );
}
