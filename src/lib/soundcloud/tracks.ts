// SoundCloud track helpers shared by the server and tests (no network).

export interface SoundCloudTrack {
  /** Numeric SoundCloud track id (as a string). */
  id: string;
  title: string;
  artist: string | null;
  durationSeconds: number | null;
  artworkUrl: string | null;
  permalinkUrl: string;
}

/** Fields we use from SoundCloud's API track object. */
export interface RawScTrack {
  id?: number | string;
  urn?: string;
  title?: string;
  duration?: number;
  artwork_url?: string | null;
  permalink_url?: string;
  access?: string;
  streamable?: boolean;
  kind?: string;
  user?: { username?: string; avatar_url?: string | null } | null;
}

export function isSoundCloudUrl(text: string) {
  try {
    const u = new URL(text.trim());
    return u.protocol === "https:" && /(^|\.)soundcloud\.com$/.test(u.hostname) && u.hostname !== "api.soundcloud.com";
  } catch {
    return false;
  }
}

const trackId = (t: RawScTrack) => {
  const fromUrn = t.urn?.match(/^soundcloud:tracks:(\d{1,20})$/)?.[1];
  const id = fromUrn ?? (t.id != null ? String(t.id) : "");
  return /^\d{1,20}$/.test(id) ? id : null;
};

/** Larger artwork (SoundCloud returns a 100×100 "-large" image by default). */
function artwork(url: string | null | undefined) {
  if (!url || !/^https:\/\/[a-z0-9-]+\.sndcdn\.com\//.test(url)) return null;
  return url.replace(/-large(\.\w+)$/, "-t500x500$1");
}

/**
 * Keeps tracks that can be fully played in other apps (not previews or
 * blocked/paywalled ones) and maps them to what Taxi DJ needs.
 */
export function playableTracks(raw: RawScTrack[]): SoundCloudTrack[] {
  const out: SoundCloudTrack[] = [];
  for (const t of raw) {
    if (t.kind && t.kind !== "track") continue;
    if (t.access && t.access !== "playable") continue;
    if (t.streamable === false) continue;
    const id = trackId(t);
    const permalink = t.permalink_url ?? "";
    if (!id || !/^https:\/\/soundcloud\.com\/\S+$/.test(permalink)) continue;
    out.push({
      id,
      title: (t.title ?? "SoundCloud track").slice(0, 200),
      artist: t.user?.username?.slice(0, 120) ?? null,
      durationSeconds: t.duration && t.duration > 0 ? Math.round(t.duration / 1000) : null,
      artworkUrl: artwork(t.artwork_url) ?? artwork(t.user?.avatar_url),
      permalinkUrl: permalink.split("?")[0],
    });
  }
  return out;
}

/** Best stream for a browser <audio>: plain MP3 first, then HLS. */
export function pickStreamUrl(streams: Record<string, string | undefined | null>): string | null {
  for (const key of ["http_mp3_128_url", "hls_aac_160_url", "hls_mp3_128_url"]) {
    const url = streams[key];
    if (typeof url === "string" && url.startsWith("https://")) return url;
  }
  return null;
}
