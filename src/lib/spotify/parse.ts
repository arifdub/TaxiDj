// Spotify link/ID helpers. Pure functions — safe on client and server.

const TRACK_ID = /^[A-Za-z0-9]{22}$/;

export function isValidSpotifyTrackId(id: unknown): id is string {
  return typeof id === "string" && TRACK_ID.test(id);
}

/**
 * Extracts a track ID from a Spotify link or URI:
 *   https://open.spotify.com/track/ID?si=…, https://open.spotify.com/intl-de/track/ID,
 *   spotify:track:ID
 */
export function parseSpotifyTrackLink(input: string): string | null {
  const raw = input.trim();
  const uri = /^spotify:track:([A-Za-z0-9]{22})$/.exec(raw);
  if (uri) return uri[1];
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.hostname !== "open.spotify.com" || url.username || url.password) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  const i = parts.indexOf("track");
  const id = i >= 0 ? parts[i + 1] : undefined;
  return isValidSpotifyTrackId(id) ? id : null;
}

export function spotifyTrackUrl(trackId: string) {
  return `https://open.spotify.com/track/${trackId}`;
}

/** Looks like a Spotify link rather than a search query. */
export function looksLikeSpotifyLink(input: string) {
  return /open\.spotify\.com|^spotify:/i.test(input.trim());
}
