import "server-only";

// Spotify Web API (search + track lookup) using the Client Credentials flow:
// no user sign-in; SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET stay on the server.
// Taxi DJ only reads track metadata; it never streams Spotify audio.

import { isValidSpotifyTrackId, spotifyTrackUrl } from "./parse";

export interface SpotifyTrack {
  spotifyId: string;
  title: string;
  artist: string;
  album: string | null;
  imageUrl: string | null;
  durationSeconds: number;
  spotifyUrl: string;
}

export class SpotifyError extends Error {
  constructor(public code: "NOT_CONFIGURED" | "NOT_FOUND" | "UPSTREAM" | "RATE_LIMITED") {
    super(code);
  }
}

export function isSpotifyConfigured() {
  return Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

let token: { value: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (!isSpotifyConfigured()) throw new SpotifyError("NOT_CONFIGURED");
  if (token && token.expiresAt > Date.now() + 30_000) return token.value;
  const basic = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new SpotifyError("UPSTREAM");
  const data = (await res.json()) as { access_token: string; expires_in: number };
  token = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return token.value;
}

async function api(path: string) {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${await accessToken()}` },
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 3600 },
  });
  if (res.status === 404 || res.status === 400) throw new SpotifyError("NOT_FOUND");
  if (res.status === 429) throw new SpotifyError("RATE_LIMITED");
  if (!res.ok) throw new SpotifyError("UPSTREAM");
  return res.json();
}

interface ApiTrack {
  id: string;
  name: string;
  duration_ms: number;
  artists: { name: string }[];
  album?: { name?: string; images?: { url: string; width: number }[] };
}

function toTrack(t: ApiTrack): SpotifyTrack {
  // Smallest image that's still at least 200px wide, for fast thumbnails.
  const images = [...(t.album?.images ?? [])].sort((a, b) => a.width - b.width);
  const image = images.find((i) => i.width >= 200) ?? images[images.length - 1];
  return {
    spotifyId: t.id,
    title: t.name,
    artist: t.artists.map((a) => a.name).join(", "),
    album: t.album?.name ?? null,
    imageUrl: image?.url ?? null,
    durationSeconds: Math.round(t.duration_ms / 1000),
    spotifyUrl: spotifyTrackUrl(t.id),
  };
}

export async function searchTracks(query: string, limit = 12): Promise<SpotifyTrack[]> {
  const params = new URLSearchParams({ q: query, type: "track", limit: String(limit) });
  const data = await api(`/search?${params}`);
  return ((data.tracks?.items ?? []) as ApiTrack[]).filter((t) => t && isValidSpotifyTrackId(t.id)).map(toTrack);
}

export async function getTrack(id: string): Promise<SpotifyTrack> {
  if (!isValidSpotifyTrackId(id)) throw new SpotifyError("NOT_FOUND");
  return toTrack((await api(`/tracks/${id}`)) as ApiTrack);
}
