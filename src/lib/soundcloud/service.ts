import "server-only";

import { pickStreamUrl, playableTracks, type RawScTrack, type SoundCloudTrack } from "./tracks";

// Server-side SoundCloud API client (official API, app credentials).
// Needs SOUNDCLOUD_CLIENT_ID and SOUNDCLOUD_CLIENT_SECRET from your
// registered app at soundcloud.com/you/apps. Audio is never downloaded or
// re-hosted: the browser plays SoundCloud's own stream URL.

const API = "https://api.soundcloud.com";
const TOKEN_URL = "https://secure.soundcloud.com/oauth/token";

export class SoundCloudError extends Error {
  constructor(public code: "NOT_CONFIGURED" | "NOT_FOUND" | "NOT_PLAYABLE" | "UPSTREAM" | "QUOTA") {
    super(code);
  }
}

export function isSoundCloudConfigured() {
  return Boolean(process.env.SOUNDCLOUD_CLIENT_ID && process.env.SOUNDCLOUD_CLIENT_SECRET);
}

let token: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (!isSoundCloudConfigured()) throw new SoundCloudError("NOT_CONFIGURED");
  if (token && token.expiresAt > Date.now() + 60_000) return token.value;
  const basic = Buffer.from(`${process.env.SOUNDCLOUD_CLIENT_ID}:${process.env.SOUNDCLOUD_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json; charset=utf-8",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new SoundCloudError(res.status === 429 ? "QUOTA" : "UPSTREAM");
  const data = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token) throw new SoundCloudError("UPSTREAM");
  token = { value: data.access_token, expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000 };
  return token.value;
}

async function api<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API}${path}${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `OAuth ${await accessToken()}`, Accept: "application/json; charset=utf-8" },
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (res.status === 401) token = null;
  if (res.status === 404) throw new SoundCloudError("NOT_FOUND");
  if (res.status === 429) throw new SoundCloudError("QUOTA");
  if (!res.ok) throw new SoundCloudError("UPSTREAM");
  return (await res.json()) as T;
}

/** Search tracks (only fully playable ones), or resolve a pasted SoundCloud link. */
export async function searchSoundCloud(query: string, limit = 20): Promise<SoundCloudTrack[]> {
  if (/^https:\/\/(\w+\.)?soundcloud\.com\//.test(query)) {
    const t = await api<RawScTrack>("/resolve", { url: query });
    return playableTracks([t]);
  }
  const data = await api<{ collection?: RawScTrack[] } | RawScTrack[]>("/tracks", {
    q: query,
    limit: String(Math.min(50, limit * 2)),
    access: "playable",
    linked_partitioning: "true",
  });
  const list = Array.isArray(data) ? data : (data.collection ?? []);
  return playableTracks(list).slice(0, limit);
}

/** A short-lived URL of SoundCloud's own audio stream for one track. */
export async function soundCloudStreamUrl(trackId: string): Promise<string> {
  if (!/^\d{1,20}$/.test(trackId)) throw new SoundCloudError("NOT_FOUND");
  const streams = await api<Record<string, string>>(`/tracks/soundcloud:tracks:${trackId}/streams`);
  const url = pickStreamUrl(streams);
  if (!url) throw new SoundCloudError("NOT_PLAYABLE");
  return url;
}
