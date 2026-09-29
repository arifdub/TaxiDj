"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { LocateFixed, Pause, Play, Radio, Search, Square, Star } from "lucide-react";
import { useRadio } from "@/components/driver/RadioProvider";
import { useDriverRide } from "@/components/driver/RideContext";
import { useRadioFavorites } from "@/hooks/useRadioFavorites";
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
  const { favorites } = useRadioFavorites();
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
  // Favourites are shown on top, so they're left out of the list below.
  const favIds = new Set(favorites.map((f) => f.id));
  const others = (stations ?? []).filter((s) => !favIds.has(s.id));
  const list = showAll ? others : others.slice(0, SHOW);

  return (
    <section aria-labelledby="radio" className="mt-8 w-full rounded-3xl border border-line bg-night-2 p-4 text-left">
      <h2 id="radio" className="flex scroll-mt-4 items-center gap-2 text-2xl font-black">
        <Radio className="size-7 text-taxi" aria-hidden /> Local radio
      </h2>
      <p className="mt-1 text-sm text-mist">
        For when the queue is empty. When a passenger&apos;s song plays, the radio pauses, and it comes back on when
        the queue is finished.
      </p>

      {radio.station && <NowOnAir />}

      {favorites.length > 0 && (
        <>
          <h3 className="mt-6 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-taxi">
            <Star className="size-5 fill-current" aria-hidden /> Favourites
          </h3>
          <ul className="mt-3 grid grid-cols-2 gap-3">
            {favorites.map((s) => (
              <FavoriteTile key={s.id} station={s} />
            ))}
          </ul>
        </>
      )}

      <div className="mt-6 flex gap-2">
        <form onSubmit={search} role="search" className="relative flex-1">
          <label htmlFor="radio-search" className="sr-only">
            Search radio stations
          </label>
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-mist" aria-hidden />
          <input
            id="radio-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Station name…"
            enterKeyHint="search"
            maxLength={60}
            className="h-14 w-full rounded-2xl border border-line bg-night-3 pl-12 pr-3 text-lg text-white placeholder:text-mist/60 focus:border-taxi focus:outline-none"
          />
        </form>
        <button
          type="button"
          onClick={nearMe}
          className="flex h-14 shrink-0 items-center gap-2 rounded-2xl bg-night-3 px-4 font-bold text-white hover:bg-white/10"
        >
          <LocateFixed className="size-5 text-taxi" aria-hidden /> Near me
        </button>
      </div>

      <h3 className="mt-5 text-sm font-black uppercase tracking-widest text-mist">{label}</h3>
      <div aria-live="polite">
        {loading ? (
          <p className="flex items-center gap-2 py-8 text-mist">
            <Spinner className="size-5" /> Finding stations…
          </p>
        ) : error ? (
          <p className="py-4 text-red-300">{error}</p>
        ) : list.length === 0 ? (
          <p className="py-4 text-mist">
            {stations?.length ? "All of these are in your favourites." : "No stations found. Try another name."}
          </p>
        ) : (
          <ul className="mt-2 space-y-2">
            {list.map((s) => (
              <StationRow key={s.id} station={s} />
            ))}
          </ul>
        )}
        {!loading && others.length > SHOW && !showAll && (
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className="mt-3 min-h-14 w-full rounded-2xl border border-line text-base font-bold text-white hover:bg-white/5"
          >
            Show {others.length - SHOW} more stations
          </button>
        )}
      </div>
      <p className="mt-4 text-xs text-mist">
        Tap ☆ to add a station to your favourites (saved on this phone). Station list from{" "}
        <a href="https://www.radio-browser.info" target="_blank" rel="noopener noreferrer" className="underline">
          radio-browser.info
        </a>
        ; streams come straight from each station.
      </p>
    </section>
  );
}

function StationLogo({ station, className }: { station: RadioStation; className: string }) {
  const [broken, setBroken] = useState(false);
  return station.favicon && !broken ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={station.favicon} alt="" onError={() => setBroken(true)} className={`${className} rounded-2xl bg-white object-contain`} />
  ) : (
    <span className={`${className} grid place-items-center rounded-2xl bg-night-3 text-taxi`}>
      <Radio className="size-1/2" aria-hidden />
    </span>
  );
}

function place(s: RadioStation) {
  return [s.state, s.countryCode].filter(Boolean).join(", ");
}

function useStationState(station: RadioStation) {
  const radio = useRadio()!;
  const current = radio.station?.id === station.id;
  const on = current && (radio.status === "playing" || radio.status === "loading");
  const loading = current && radio.status === "loading";
  const tap = () => (current ? radio.toggle() : radio.play(station));
  return { current, on, loading, tap };
}

function FavButton({ station, className = "" }: { station: RadioStation; className?: string }) {
  const { isFavorite, toggleFavorite } = useRadioFavorites();
  const fav = isFavorite(station.id);
  return (
    <button
      type="button"
      onClick={() => toggleFavorite(station)}
      aria-pressed={fav}
      aria-label={fav ? `Remove ${station.name} from favourites` : `Add ${station.name} to favourites`}
      className={`grid size-14 shrink-0 place-items-center rounded-2xl hover:bg-white/5 ${fav ? "text-taxi" : "text-mist"} ${className}`}
    >
      <Star className={`size-7 ${fav ? "fill-current" : ""}`} aria-hidden />
    </button>
  );
}

/** Big one-tap tile for a favourite station. */
function FavoriteTile({ station }: { station: RadioStation }) {
  const { current, on, loading, tap } = useStationState(station);
  return (
    <li className={`relative rounded-3xl border-2 ${current ? "border-taxi bg-taxi/10" : "border-line bg-night-3"}`}>
      <button
        type="button"
        onClick={tap}
        aria-label={`${on ? "Pause" : "Play"} ${station.name}`}
        className="flex min-h-36 w-full flex-col items-center justify-center gap-2 p-3 pt-4 text-center"
      >
        <StationLogo station={station} className="size-14" />
        <span className={`line-clamp-2 text-base font-black leading-tight ${current ? "text-taxi" : "text-white"}`}>
          {station.name}
        </span>
        <span className={`grid size-10 place-items-center rounded-full ${on ? "bg-taxi text-ink" : "bg-night-2 text-white"}`}>
          {loading ? (
            <Spinner className="size-5" />
          ) : on ? (
            <Pause className="size-5 fill-current" aria-hidden />
          ) : (
            <Play className="ml-0.5 size-5 fill-current" aria-hidden />
          )}
        </span>
      </button>
      <FavButton station={station} className="absolute right-0 top-0 size-12" />
    </li>
  );
}

function StationRow({ station }: { station: RadioStation }) {
  const { current, on, loading, tap } = useStationState(station);
  return (
    <li className={`flex items-center rounded-2xl ${current ? "bg-taxi/10 ring-2 ring-taxi" : "bg-night-3"}`}>
      <button
        type="button"
        onClick={tap}
        aria-label={`${on ? "Pause" : "Play"} ${station.name}`}
        className="flex min-h-20 min-w-0 flex-1 items-center gap-3 p-3 text-left"
      >
        <StationLogo station={station} className="size-14 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-lg font-black ${current ? "text-taxi" : "text-white"}`}>{station.name}</span>
          <span className="block truncate text-sm text-mist">
            {[place(station), station.distanceKm != null ? `${station.distanceKm} km` : null, station.tags.slice(0, 2).join(" · ")]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <span className={`grid size-12 shrink-0 place-items-center rounded-full ${on ? "bg-taxi text-ink" : "bg-night-2 text-white"}`}>
          {loading ? (
            <Spinner className="size-5" />
          ) : on ? (
            <Pause className="size-6 fill-current" aria-hidden />
          ) : (
            <Play className="ml-0.5 size-6 fill-current" aria-hidden />
          )}
        </span>
      </button>
      <FavButton station={station} />
    </li>
  );
}

function NowOnAir() {
  const radio = useRadio()!;
  const s = radio.station!;
  const on = radio.status === "playing" || radio.status === "loading";
  return (
    <div className="mt-5 rounded-3xl border-2 border-taxi/50 bg-taxi/10 p-4">
      <div className="flex items-center gap-3">
        <StationLogo station={s} className="size-16 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-black uppercase tracking-widest text-taxi">
            {radio.status === "error"
              ? "Station unavailable"
              : radio.waitingForQueue
                ? "Paused for the queue"
                : on
                  ? "On air"
                  : "Paused"}
          </p>
          <p className="truncate text-xl font-black">{s.name}</p>
          <p className="truncate text-sm text-mist">
            {radio.status === "error" ? "This stream isn't working. Try another station." : place(s)}
          </p>
        </div>
        <FavButton station={s} />
      </div>
      <div className="mt-4 grid grid-cols-[1fr_auto] gap-3">
        <button
          type="button"
          onClick={radio.toggle}
          aria-label={on ? "Pause radio" : "Play radio"}
          className="flex min-h-16 items-center justify-center gap-2 rounded-2xl bg-taxi text-lg font-black text-ink"
        >
          {radio.status === "loading" ? (
            <Spinner className="size-6" />
          ) : on ? (
            <>
              <Pause className="size-7 fill-current" aria-hidden /> Pause
            </>
          ) : (
            <>
              <Play className="size-7 fill-current" aria-hidden /> Play
            </>
          )}
        </button>
        <button
          type="button"
          onClick={radio.stop}
          aria-label="Stop radio"
          className="flex min-h-16 items-center gap-2 rounded-2xl bg-night-3 px-5 text-lg font-bold text-white"
        >
          <Square className="size-5 fill-current" aria-hidden /> Stop
        </button>
      </div>
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
      className="fixed left-3 z-30 flex max-w-[70vw] items-center gap-2 rounded-full border border-taxi/40 bg-night-2/95 py-1 pl-4 pr-1 text-sm font-bold text-white shadow-lg backdrop-blur"
      style={{ bottom: "calc(max(1rem, env(safe-area-inset-bottom)) + 4.75rem)" }}
    >
      <Radio className="size-4 shrink-0 text-taxi" aria-hidden />
      <span className="truncate">{radio.station.name}</span>
      <button type="button" onClick={radio.toggle} aria-label="Pause radio" className="grid size-12 shrink-0 place-items-center rounded-full bg-taxi text-ink">
        <Pause className="size-5 fill-current" aria-hidden />
      </button>
    </div>
  );
}

/**
 * "Play local radio" button for empty-queue screens: opens the radio
 * section on the Player tab. Hidden while a song is loaded.
 */
export function RadioShortcut({ className = "" }: { className?: string }) {
  const radio = useRadio();
  const { ride, queue } = useDriverRide();
  if (!radio || nowPlaying(queue)) return null;
  const on = radio.station && (radio.status === "playing" || radio.status === "loading");
  return (
    <Link
      href={`/driver/ride/${ride.id}/player#radio`}
      className={`flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-taxi/40 bg-taxi/10 px-4 font-black text-white hover:bg-taxi/20 ${className}`}
    >
      <Radio className="size-5 shrink-0 text-taxi" aria-hidden />
      {on ? (
        <span className="truncate">
          On air: {radio.station!.name} <span className="font-semibold text-mist">· Open radio</span>
        </span>
      ) : (
        "Play local radio"
      )}
    </Link>
  );
}
