export function formatDuration(totalSeconds: number | null | undefined): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return "";
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "1 h 12 min", "25 min" or "Under a minute". */
export function formatElapsed(fromIso: string, toIso?: string | null): string {
  const ms = new Date(toIso ?? Date.now()).getTime() - new Date(fromIso).getTime();
  const minutes = Math.round(ms / 60000);
  if (minutes < 1) return "Under a minute";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

export function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Public passenger URL for a ride, e.g. https://taxidj.com/join/AB72X */
export function joinUrl(code: string, origin?: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    origin ||
    (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}/join/${code}`;
}

/** The URL without protocol, for display: "taxidj.com/join/AB72X". */
/** Permanent car QR code link: always leads to the driver's current ride. */
export function carUrl(code: string, origin?: string): string {
  return joinUrl(code, origin).replace(/\/join\/[^/]*$/, `/c/${code}`);
}

export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "");
}
