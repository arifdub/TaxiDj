// Radio station data from Radio Browser (https://www.radio-browser.info), a
// free, open, community directory of internet radio stations with an
// official public API. Stations are played from their own public stream
// URLs; nothing is downloaded or re-hosted.
//
// Pure helpers only (shared by the server route and tests).

export interface RadioStation {
  id: string;
  name: string;
  streamUrl: string;
  homepage: string | null;
  favicon: string | null;
  country: string | null;
  countryCode: string | null;
  state: string | null;
  tags: string[];
  codec: string | null;
  bitrate: number | null;
  hls: boolean;
  /** Distance from the driver in km (when location was used). */
  distanceKm: number | null;
}

/** Fields we use from a Radio Browser station. */
export interface RawStation {
  stationuuid?: string;
  name?: string;
  url?: string;
  url_resolved?: string;
  homepage?: string;
  favicon?: string;
  country?: string;
  countrycode?: string;
  state?: string;
  tags?: string;
  codec?: string;
  bitrate?: number;
  hls?: number;
  lastcheckok?: number;
  geo_lat?: number | null;
  geo_long?: number | null;
  clickcount?: number;
  votes?: number;
}

const httpsUrl = (u: string | undefined | null) => {
  const v = (u ?? "").trim();
  try {
    return new URL(v).protocol === "https:" ? v : null;
  } catch {
    return null;
  }
};

/** Great-circle distance in km. */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Cleans up Radio Browser results: only working stations with a secure
 * (https) stream (browsers block http audio on https pages), no duplicates,
 * nearest first when a location is given, otherwise most popular first.
 */
export function normalizeStations(
  raw: RawStation[],
  opts: { near?: { lat: number; lng: number } | null; limit?: number } = {},
): RadioStation[] {
  const seen = new Set<string>();
  const out: (RadioStation & { popularity: number })[] = [];
  for (const s of raw) {
    const streamUrl = httpsUrl(s.url_resolved) ?? httpsUrl(s.url);
    const name = (s.name ?? "").replace(/\s+/g, " ").trim();
    if (!s.stationuuid || !streamUrl || !name || s.lastcheckok === 0) continue;
    const key = name.toLowerCase();
    if (seen.has(key) || seen.has(streamUrl)) continue;
    seen.add(key);
    seen.add(streamUrl);
    const hasGeo = typeof s.geo_lat === "number" && typeof s.geo_long === "number";
    out.push({
      id: s.stationuuid,
      name: name.slice(0, 80),
      streamUrl,
      homepage: httpsUrl(s.homepage) ?? (s.homepage?.startsWith("http://") ? s.homepage : null),
      favicon: httpsUrl(s.favicon),
      country: s.country?.trim() || null,
      countryCode: s.countrycode?.trim().toUpperCase() || null,
      state: s.state?.trim() || null,
      tags: (s.tags ?? "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 4),
      codec: s.codec?.trim() || null,
      bitrate: s.bitrate && s.bitrate > 0 ? s.bitrate : null,
      hls: s.hls === 1,
      distanceKm:
        opts.near && hasGeo ? Math.round(distanceKm(opts.near, { lat: s.geo_lat!, lng: s.geo_long! })) : null,
      popularity: (s.clickcount ?? 0) + (s.votes ?? 0) * 2,
    });
  }
  if (opts.near) {
    // Nearby stations first (within 100 km), each group by popularity.
    const near = (d: number | null) => (d != null && d <= 100 ? 0 : 1);
    out.sort((a, b) => near(a.distanceKm) - near(b.distanceKm) || b.popularity - a.popularity);
  } else {
    out.sort((a, b) => b.popularity - a.popularity);
  }
  return out.slice(0, opts.limit ?? 40).map((s) => {
    const { popularity, ...station } = s;
    void popularity;
    return station;
  });
}
