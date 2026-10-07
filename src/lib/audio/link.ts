// Audio file links: a song file the driver or a passenger keeps online
// (Google Drive, Dropbox, or any web address that serves an audio file).
// Taxi DJ plays the file straight from that address in a plain audio player
// (like the radio); nothing is uploaded, copied or stored by Taxi DJ.
//
// Shared by the browser (checking a pasted link) and tests. The database
// checks the same rules again (audio_link_ok in the migration).

export type AudioLinkError = "EMPTY" | "NOT_LINK" | "NOT_HTTPS" | "FOLDER" | "NOT_ALLOWED" | "TOO_LONG";

export interface AudioLink {
  /** Address the player loads (share links turned into direct-file links). */
  url: string;
  /** Where the file lives, shown as the song's "artist" line. */
  sourceLabel: string;
  /** Song name guessed from the file name (null if the link doesn't say). */
  titleGuess: string | null;
}

export const MAX_AUDIO_URL_LENGTH = 2000;

const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|webm|mp4|weba)$/i;

/** Hosts a phone mustn't be sent to: the phone itself and home/office networks. */
function isPrivateHost(host: string) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || /\.(local|localhost|internal|lan|home|intranet)$/.test(h)) return true;
  if (h.includes(":")) return true; // IPv6 literal
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

function fileTitle(pathname: string): string | null {
  const last = pathname.split("/").filter(Boolean).pop();
  if (!last) return null;
  let name = last;
  try {
    name = decodeURIComponent(last);
  } catch {
    // Keep it as typed.
  }
  if (!AUDIO_EXT.test(name)) return null;
  const title = name.replace(AUDIO_EXT, "").replace(/[_+]+/g, " ").replace(/\s+/g, " ").trim();
  return title ? title.slice(0, 200) : null;
}

function hostLabel(host: string) {
  return host.toLowerCase().replace(/^www\./, "");
}

const DRIVE_ID = /^[A-Za-z0-9_-]{10,200}$/;

/** Reads a pasted link to an audio file. */
export function parseAudioLink(input: string): AudioLink | { error: AudioLinkError } {
  const text = input.trim();
  if (!text) return { error: "EMPTY" };
  if (text.length > MAX_AUDIO_URL_LENGTH) return { error: "TOO_LONG" };
  let u: URL;
  try {
    u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`);
  } catch {
    return { error: "NOT_LINK" };
  }
  if (u.protocol === "http:") return { error: "NOT_HTTPS" };
  if (u.protocol !== "https:") return { error: "NOT_LINK" };
  if (u.username || u.password || isPrivateHost(u.hostname)) return { error: "NOT_ALLOWED" };
  if (!u.hostname.includes(".")) return { error: "NOT_LINK" };
  u.hash = "";
  const host = u.hostname.toLowerCase();

  // Google Drive: share links open a web page; this form serves the file.
  if (host === "drive.google.com" || host === "docs.google.com" || host === "drive.usercontent.google.com") {
    if (/\/folders\//.test(u.pathname)) return { error: "FOLDER" };
    const id = u.pathname.match(/\/file\/d\/([^/]+)/)?.[1] ?? u.searchParams.get("id");
    if (!id || !DRIVE_ID.test(id)) return { error: "NOT_LINK" };
    const direct = `https://drive.google.com/uc?export=download&id=${id}`;
    return { url: direct, sourceLabel: "Google Drive", titleGuess: null };
  }

  // Dropbox: "dl=0" opens a preview page; "raw=1" serves the file.
  if (host === "dropbox.com" || host === "www.dropbox.com" || host === "dl.dropboxusercontent.com") {
    if (host !== "dl.dropboxusercontent.com") {
      if (/^\/(home|sh)\b/.test(u.pathname)) return { error: "FOLDER" };
      u.searchParams.delete("dl");
      u.searchParams.set("raw", "1");
    }
    return { url: u.toString(), sourceLabel: "Dropbox", titleGuess: fileTitle(u.pathname) };
  }

  const url = u.toString();
  if (url.length > MAX_AUDIO_URL_LENGTH) return { error: "TOO_LONG" };
  return { url, sourceLabel: hostLabel(host), titleGuess: fileTitle(u.pathname) };
}

export const AUDIO_LINK_MESSAGES: Record<AudioLinkError, string> = {
  EMPTY: "",
  NOT_LINK: "That doesn't look like a link to an audio file.",
  NOT_HTTPS: "That link isn't secure (http). Use a link that starts with https://.",
  FOLDER: "That's a link to a folder. Open the song file itself, then copy its share link.",
  NOT_ALLOWED: "That link points to a private network address, which can't be played here.",
  TOO_LONG: "That link is too long.",
};
