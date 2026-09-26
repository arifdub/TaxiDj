import "server-only";

import { normalizeStations, type RadioStation, type RawStation } from "./stations";

// Server-side Radio Browser client. Uses the official public API, picks a
// mirror from the published server list, and identifies Taxi DJ with a
// User-Agent as the API guidelines ask.

const UA = "TaxiDJ/1.0 (+https://taxidj.app)";
const FALLBACK_HOSTS = ["de1.api.radio-browser.info", "de2.api.radio-browser.info", "fi1.api.radio-browser.info"];

let hosts: { list: string[]; at: number } | null = null;

async function mirrors(): Promise<string[]> {
  if (hosts && Date.now() - hosts.at < 3600_000) return hosts.list;
  try {
    const res = await fetch("https://all.api.radio-browser.info/json/servers", {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(4000),
    });
    const list = ((await res.json()) as { name?: string }[])
      .map((s) => s.name)
      .filter((n): n is string => typeof n === "string" && /\.api\.radio-browser\.info$/.test(n));
    if (list.length) {
      // Shuffle so load is spread across mirrors.
      list.sort(() => Math.random() - 0.5);
      hosts = { list: [...new Set(list)], at: Date.now() };
      return hosts.list;
    }
  } catch {
    // Fall through to the built-in list.
  }
  return FALLBACK_HOSTS;
}

async function api<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  let lastError: unknown;
  // Published mirrors first, then the built-in ones as backup.
  const tryHosts = [...new Set([...(await mirrors()), ...FALLBACK_HOSTS])].slice(0, 3);
  for (const host of tryHosts) {
    try {
      const res = await fetch(`https://${host}${path}${qs ? `?${qs}` : ""}`, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        signal: AbortSignal.timeout(6000),
        next: { revalidate: 600 },
      });
      if (!res.ok) throw new Error(`Radio Browser ${res.status}`);
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("Radio Browser unavailable");
}

const BASE: Record<string, string> = {
  hidebroken: "true",
  is_https: "true",
  order: "clickcount",
  reverse: "true",
  limit: "120",
};

/**
 * Stations for the driver: by name when searching; otherwise near the given
 * location (GPS), topped up with the most popular stations in the country.
 */
export async function findStations(opts: {
  query?: string;
  lat?: number;
  lng?: number;
  countryCode?: string | null;
}): Promise<RadioStation[]> {
  const near = opts.lat != null && opts.lng != null ? { lat: opts.lat, lng: opts.lng } : null;
  const country = opts.countryCode && /^[A-Z]{2}$/.test(opts.countryCode) ? opts.countryCode : null;
  const raw: RawStation[] = [];

  if (opts.query) {
    raw.push(...(await api<RawStation[]>("/json/stations/search", { ...BASE, name: opts.query, limit: "60" })));
    // Prefer matches from the driver's country.
    if (country) raw.sort((a, b) => Number(b.countrycode === country) - Number(a.countrycode === country));
    return normalizeStations(raw, { near, limit: 40 });
  }

  const [nearby, national] = await Promise.all([
    near
      ? api<RawStation[]>("/json/stations/search", {
          ...BASE,
          geo_lat: String(near.lat),
          geo_long: String(near.lng),
          geo_distance: "100000", // metres
        }).catch(() => [])
      : Promise.resolve([] as RawStation[]),
    country
      ? api<RawStation[]>("/json/stations/search", { ...BASE, countrycode: country })
      : api<RawStation[]>("/json/stations/search", { ...BASE, limit: "60" }),
  ]);
  raw.push(...nearby, ...national);
  return normalizeStations(raw, { near, limit: 40 });
}

/** Tells Radio Browser a station was played (their popularity count). */
export async function countClick(stationId: string) {
  if (!/^[0-9a-f-]{36}$/i.test(stationId)) return;
  await api(`/json/url/${stationId}`).catch(() => {});
}
