import "server-only";

// Keyless Spotify lookup via Spotify's public oEmbed endpoint (the same one
// used for link previews). No developer account, key or Premium needed.
// It returns the track's title and cover art (not the artist or duration).

import { spotifyTrackUrl } from "./parse";

export interface SpotifyLinkInfo {
  spotifyId: string;
  title: string;
  imageUrl: string | null;
  spotifyUrl: string;
}

export async function lookupSpotifyLink(spotifyId: string): Promise<SpotifyLinkInfo | null> {
  const url = spotifyTrackUrl(spotifyId);
  const res = await fetch(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 86400 },
  });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`Spotify oEmbed responded ${res.status}`);
  const data = (await res.json()) as { title?: string; thumbnail_url?: string };
  if (!data.title) return null;
  return { spotifyId, title: data.title, imageUrl: data.thumbnail_url ?? null, spotifyUrl: url };
}
