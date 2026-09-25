"use client";

// YouTube search + paste-a-link panels, shared by the passenger "Add music"
// screen and the driver's "Add song" screen. Light theme; the driver screen
// shows them on a white card.

import { useEffect, useRef, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { Button, Notice, SongSkeleton, Spinner, Thumbnail, YouTubeIcon } from "@/components/ui";
import { friendlyError } from "@/lib/errors";
import { formatDuration } from "@/lib/format";
import type { RequestSource, SpotifyTrack, VideoResult } from "@/lib/types";
import { looksLikeSpotifyLink, parseSpotifyTrackLink } from "@/lib/spotify/parse";
import { parseYouTubeUrl, type ParseError } from "@/lib/youtube/parse";

export function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex min-h-12 items-center justify-center gap-2 rounded-2xl border-2 text-sm font-bold ${
        active ? "border-ink bg-ink text-white" : "border-zinc-200 bg-white text-zinc-700"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

// ------------------------------------------------------------- Search ----

export function SearchPanel({
  onAdd,
  adding,
  inQueue,
  disabled,
  onUnavailable,
}: {
  onAdd: (v: VideoResult) => void;
  adding: string | null;
  inQueue: Set<string>;
  disabled: boolean;
  onUnavailable: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<VideoResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    inputRef.current?.blur(); // hide the mobile keyboard so results are visible
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/youtube/search?q=${encodeURIComponent(q)}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.error === "NOT_CONFIGURED") return onUnavailable();
        setResults(null);
        setError(
          data.error === "RATE_LIMITED"
            ? "You're searching a little fast. Please wait a moment and try again."
            : "YouTube search is unavailable right now. You can still paste a YouTube link.",
        );
        return;
      }
      setResults(data.results);
    } catch (err) {
      setError(friendlyError(err, "YouTube search is unavailable right now. You can still paste a YouTube link."));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={search} role="search" className="flex gap-2">
        <label htmlFor="search" className="sr-only">
          Search YouTube
        </label>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-zinc-400" aria-hidden />
          <input
            ref={inputRef}
            id="search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search YouTube…"
            enterKeyHint="search"
            autoComplete="off"
            maxLength={100}
            className="h-14 w-full rounded-2xl border-2 border-zinc-200 bg-zinc-50 pl-12 pr-4 text-lg focus:border-taxi-dark focus:bg-white focus:outline-none"
          />
        </div>
        <Button type="submit" className="px-5" aria-label="Search" loading={loading}>
          {!loading && <Search className="size-5" aria-hidden />}
        </Button>
      </form>

      <div className="mt-4" aria-live="polite">
        {loading ? (
          <SongSkeleton tone="light" count={5} />
        ) : error ? (
          <Notice tone="error">{error}</Notice>
        ) : results?.length === 0 ? (
          <p className="py-8 text-center text-zinc-500">No results. Try a different search.</p>
        ) : results ? (
          <ul className="divide-y divide-zinc-100">
            {results.map((v) => (
              <ResultRow
                key={v.videoId}
                video={v}
                onAdd={() => onAdd(v)}
                adding={adding === v.videoId}
                inQueue={inQueue.has(v.videoId)}
                disabled={disabled || (adding !== null && adding !== v.videoId)}
              />
            ))}
          </ul>
        ) : (
          <p className="py-8 text-center text-zinc-500">Search for any song, artist or music video.</p>
        )}
      </div>
    </div>
  );
}

function ResultRow({
  video,
  onAdd,
  adding,
  inQueue,
  disabled,
}: {
  video: VideoResult;
  onAdd: () => void;
  adding: boolean;
  inQueue: boolean;
  disabled: boolean;
}) {
  return (
    <li className="flex items-center gap-3 py-3">
      <div className="relative">
        <Thumbnail src={video.thumbnailUrl} className="h-16 w-24" />
        {video.durationSeconds ? (
          <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 font-mono text-[10px] font-bold text-white">
            {formatDuration(video.durationSeconds)}
          </span>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-sm font-bold leading-snug">{video.title}</p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-zinc-500">
          <YouTubeIcon className="h-3 w-auto shrink-0" /> {video.channel}
        </p>
      </div>
      {inQueue ? (
        <span className="flex min-h-11 items-center gap-1 rounded-xl bg-zinc-100 px-3 text-xs font-bold text-zinc-600">
          <Check className="size-4" aria-hidden /> In queue
        </span>
      ) : (
        <Button
          size="md"
          onClick={onAdd}
          loading={adding}
          disabled={disabled}
          aria-label={`Add ${video.title} to the queue`}
          className="px-3"
        >
          {!adding && <Plus className="size-4" aria-hidden />} Add
        </Button>
      )}
    </li>
  );
}

// -------------------------------------------------------------- Paste ----

const PARSE_MESSAGES: Record<ParseError, string> = {
  EMPTY: "",
  NOT_YOUTUBE: "That isn't a YouTube or YouTube Music link.",
  PLAYLIST_ONLY: "Playlists aren't supported yet. Please paste a link to a single song.",
  NO_VIDEO: "We couldn't find a video in that link. Try copying the song's share link.",
};

export function PastePanel({
  onAdd,
  adding,
  inQueue,
  disabled,
}: {
  onAdd: (v: VideoResult, source: RequestSource) => void;
  adding: string | null;
  inQueue: Set<string>;
  disabled: boolean;
}) {
  const [value, setValue] = useState("");
  // Result of the metadata lookup, keyed by the video it belongs to.
  const [lookup, setLookup] = useState<
    { videoId: string; preview: { video: VideoResult; source: RequestSource } | null; error: string | null } | null
  >(null);

  const parsed = parseYouTubeUrl(value);
  const videoId = parsed.ok ? parsed.videoId : null;
  const source: RequestSource = parsed.ok ? parsed.source : "youtube";
  const current = lookup && lookup.videoId === videoId ? lookup : null;
  const loading = Boolean(videoId) && !current;
  const preview = current?.preview ?? null;
  const error = parsed.ok ? (current?.error ?? null) : parsed.error === "EMPTY" ? null : PARSE_MESSAGES[parsed.error];

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    const done = (preview: { video: VideoResult; source: RequestSource } | null, error: string | null) => {
      if (!cancelled) setLookup({ videoId, preview, error });
    };
    fetch(`/api/youtube/video?id=${videoId}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.status === 404) return done(null, "That video is unavailable or private.");
        if (!res.ok) {
          // Metadata lookup is best-effort: still allow adding by ID.
          return done(
            {
              video: {
                videoId,
                title: "YouTube video",
                channel: null,
                thumbnailUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                durationSeconds: null,
              },
              source,
            },
            null,
          );
        }
        done({ video: data.video, source }, null);
      })
      .catch((err) => done(null, friendlyError(err)));
    return () => {
      cancelled = true;
    };
  }, [videoId, source]);

  async function pasteFromClipboard() {
    try {
      setValue(await navigator.clipboard.readText());
    } catch {
      // Clipboard permission denied: the user can paste manually.
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor="url" className="text-sm font-bold text-zinc-700">
          Paste a YouTube link
        </label>
        <div className="relative mt-2">
          <input
            id="url"
            type="url"
            inputMode="url"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="https://youtube.com/…"
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? "url-error" : undefined}
            className="h-14 w-full rounded-2xl border-2 border-zinc-200 bg-zinc-50 pl-4 pr-12 text-base focus:border-taxi-dark focus:bg-white focus:outline-none"
          />
          {value && (
            <button
              type="button"
              onClick={() => setValue("")}
              aria-label="Clear link"
              className="absolute right-1.5 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full text-zinc-500 hover:bg-zinc-100"
            >
              <X className="size-5" aria-hidden />
            </button>
          )}
        </div>
        {!value && (
          <button type="button" onClick={pasteFromClipboard} className="mt-2 min-h-11 text-sm font-bold text-queue">
            Paste from clipboard
          </button>
        )}
        <p className="mt-1 text-xs text-zinc-500">Works with YouTube and YouTube Music links.</p>
      </div>

      {error && (
        <p id="url-error" role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
          {error}
        </p>
      )}

      {loading && <SongSkeleton tone="light" count={1} />}

      {preview && !loading && (
        <div className="rounded-3xl border border-zinc-200 p-3">
          <div className="flex items-center gap-3">
            <Thumbnail src={preview.video.thumbnailUrl} className="h-20 w-28" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 font-bold leading-snug">{preview.video.title}</p>
              <p className="mt-0.5 flex items-center gap-1 truncate text-sm text-zinc-500">
                <YouTubeIcon className="h-3 w-auto shrink-0" />
                {preview.video.channel ?? (preview.source === "youtube_music" ? "YouTube Music" : "YouTube")}
                {preview.video.durationSeconds ? ` · ${formatDuration(preview.video.durationSeconds)}` : ""}
              </p>
            </div>
          </div>
          {inQueue.has(preview.video.videoId) ? (
            <p className="mt-3 rounded-2xl bg-zinc-100 py-4 text-center font-bold text-zinc-600">
              Already in the queue
            </p>
          ) : (
            <Button
              size="xl"
              className="mt-3 w-full"
              onClick={() => onAdd(preview.video, preview.source)}
              loading={adding === preview.video.videoId}
              disabled={disabled}
            >
              ADD TO QUEUE
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------- Spotify ----

/**
 * Spotify tab.
 * * With Spotify API keys: search Spotify, or paste a song link. Picking a song
 *   calls `onAdd(track)`; the caller matches it to YouTube automatically.
 * * Without keys (no Spotify developer account needed): paste a song link.
 *   Taxi DJ reads the title from Spotify's public link preview, shows the
 *   best YouTube versions, and the rider picks one via `onAddVideo`.
 */
export function SpotifyPanel({
  searchEnabled,
  onAdd,
  onAddVideo,
  adding,
  inQueue,
  videoInQueue,
  disabled,
}: {
  searchEnabled: boolean;
  onAdd: (track: SpotifyTrack) => void;
  onAddVideo: (video: VideoResult, spotifyTrackId: string) => void;
  adding: string | null;
  /** Spotify IDs already waiting/playing in the ride. */
  inQueue: Set<string>;
  /** YouTube video IDs already waiting/playing in the ride. */
  videoInQueue: Set<string>;
  disabled: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotifyTrack[] | null>(null);
  const [linkResult, setLinkResult] = useState<{
    spotifyId: string;
    title: string;
    imageUrl: string | null;
    spotifyUrl: string;
    videos: VideoResult[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function getJson(url: string) {
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(res.status === 404 ? "NOT_FOUND" : (data.error ?? "UPSTREAM"));
    return data;
  }

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    inputRef.current?.blur();
    setLoading(true);
    setError(null);
    setResults(null);
    setLinkResult(null);
    try {
      if (looksLikeSpotifyLink(q)) {
        const id = parseSpotifyTrackLink(q);
        if (!id) {
          setError("That Spotify link isn't a single song. Share a song link, not a playlist or album.");
          return;
        }
        if (searchEnabled) {
          setResults([(await getJson(`/api/spotify/track?id=${id}`)).track]);
        } else {
          const { track } = await getJson(`/api/spotify/link?id=${id}`);
          const { videos } = await getJson(`/api/music/match?list=1&title=${encodeURIComponent(track.title)}`);
          setLinkResult({ ...track, videos: videos.slice(0, 5) });
        }
      } else if (searchEnabled) {
        setResults((await getJson(`/api/spotify/search?q=${encodeURIComponent(q)}`)).results);
      } else {
        setError("Paste a Spotify song link: in Spotify tap ⋯ or Share on a song → Copy link.");
      }
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(
        code === "NOT_FOUND"
          ? "We couldn't find that Spotify song."
          : code === "RATE_LIMITED"
            ? "You're going a little fast. Please wait a moment and try again."
            : friendlyError(err, "Spotify is unavailable right now. You can still search YouTube."),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <form onSubmit={search} role="search" className="flex gap-2">
        <label htmlFor="spotify-search" className="sr-only">
          {searchEnabled ? "Search Spotify or paste a Spotify song link" : "Paste a Spotify song link"}
        </label>
        <div className="relative flex-1">
          <SpotifyIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2" />
          <input
            ref={inputRef}
            id="spotify-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={searchEnabled ? "Search Spotify or paste a link…" : "Paste a Spotify song link…"}
            enterKeyHint={searchEnabled ? "search" : "go"}
            inputMode={searchEnabled ? "search" : "url"}
            autoComplete="off"
            autoCapitalize="off"
            maxLength={200}
            className="h-14 w-full rounded-2xl border-2 border-zinc-200 bg-zinc-50 pl-12 pr-4 text-lg focus:border-[#1DB954] focus:bg-white focus:outline-none"
          />
        </div>
        <button
          type="submit"
          aria-label={searchEnabled ? "Search Spotify" : "Find Spotify song"}
          disabled={loading}
          className="grid min-h-14 min-w-14 place-items-center rounded-2xl bg-[#1DB954] px-4 text-black hover:bg-[#1ed760] disabled:opacity-60 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#1DB954]"
        >
          {loading ? <Spinner className="size-5" /> : <Search className="size-5" aria-hidden />}
        </button>
      </form>
      {!searchEnabled && !query && (
        <button
          type="button"
          onClick={async () => {
            try {
              setQuery(await navigator.clipboard.readText());
            } catch {
              // Clipboard permission denied: the user can paste manually.
            }
          }}
          className="mt-2 min-h-11 text-sm font-bold text-[#1a8f45]"
        >
          Paste from clipboard
        </button>
      )}

      <div className="mt-4" aria-live="polite">
        {loading ? (
          <SongSkeleton tone="light" count={searchEnabled ? 5 : 3} />
        ) : error ? (
          <Notice tone="error">{error}</Notice>
        ) : linkResult ? (
          <LinkMatches result={linkResult} {...{ onAddVideo, adding, inQueue, videoInQueue, disabled }} />
        ) : results?.length === 0 ? (
          <p className="py-8 text-center text-zinc-500">No results. Try a different search.</p>
        ) : results ? (
          <ul className="divide-y divide-zinc-100">
            {results.map((t) => {
              const busy = adding === t.spotifyId;
              return (
                <li key={t.spotifyId} className="flex items-center gap-3 py-3">
                  <div className="relative">
                    <Thumbnail src={t.imageUrl} className="size-16" />
                    <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 font-mono text-[10px] font-bold text-white">
                      {formatDuration(t.durationSeconds)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-bold leading-snug">{t.title}</p>
                    <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-zinc-500">
                      <SpotifyIcon className="size-3 shrink-0" /> {t.artist}
                    </p>
                    <a
                      href={t.spotifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-0.5 inline-block text-[11px] font-semibold text-[#1a8f45] underline"
                    >
                      Listen on Spotify
                    </a>
                  </div>
                  {inQueue.has(t.spotifyId) ? (
                    <span className="flex min-h-11 items-center gap-1 rounded-xl bg-zinc-100 px-3 text-xs font-bold text-zinc-600">
                      <Check className="size-4" aria-hidden /> In queue
                    </span>
                  ) : (
                    <Button
                      size="md"
                      onClick={() => onAdd(t)}
                      loading={busy}
                      disabled={disabled || (adding !== null && !busy)}
                      aria-label={`Add ${t.title} to the queue`}
                      className="px-3"
                    >
                      {!busy && <Plus className="size-4" aria-hidden />} Add
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        ) : searchEnabled ? (
          <p className="py-8 text-center text-sm text-zinc-500">
            Search Spotify for any song, or paste a Spotify song link. Songs play through YouTube in
            the car.
          </p>
        ) : (
          <div className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600">
            <p className="font-bold text-ink">Add a song from Spotify</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>In Spotify, tap ⋯ (or Share) on a song.</li>
              <li>Tap <strong>Copy link</strong>.</li>
              <li>Paste it above and pick the right version.</li>
            </ol>
            <p className="mt-2 text-xs text-zinc-500">Works with free and Premium Spotify. Songs play through YouTube in the car.</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** Pasted Spotify link (no API keys): pick which YouTube version to add. */
function LinkMatches({
  result,
  onAddVideo,
  adding,
  inQueue,
  videoInQueue,
  disabled,
}: {
  result: { spotifyId: string; title: string; imageUrl: string | null; spotifyUrl: string; videos: VideoResult[] };
  onAddVideo: (video: VideoResult, spotifyTrackId: string) => void;
  adding: string | null;
  inQueue: Set<string>;
  videoInQueue: Set<string>;
  disabled: boolean;
}) {
  const already = inQueue.has(result.spotifyId);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-2xl bg-[#1DB954]/10 p-3 ring-1 ring-[#1DB954]/30">
        <Thumbnail src={result.imageUrl} className="size-14" />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 text-[11px] font-black uppercase tracking-wider text-[#1a8f45]">
            <SpotifyIcon className="size-3" /> From Spotify
          </p>
          <p className="truncate font-bold">{result.title}</p>
          <a href={result.spotifyUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-[#1a8f45] underline">
            Listen on Spotify
          </a>
        </div>
      </div>
      {already ? (
        <p className="rounded-2xl bg-zinc-100 py-4 text-center font-bold text-zinc-600">Already in the queue</p>
      ) : (
        <>
          <p className="text-sm font-bold text-zinc-700">Pick the version to play:</p>
          <ul className="divide-y divide-zinc-100">
            {result.videos.map((v, i) => (
              <ResultRow
                key={v.videoId}
                video={i === 0 ? { ...v, channel: `${v.channel ?? "YouTube"} · Best match` } : v}
                onAdd={() => onAddVideo({ ...v, title: result.title }, result.spotifyId)}
                adding={adding === v.videoId}
                inQueue={videoInQueue.has(v.videoId)}
                disabled={disabled || (adding !== null && adding !== v.videoId)}
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

export function SpotifyIcon({ className = "size-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} role="img" aria-label="Spotify">
      <circle cx="12" cy="12" r="12" fill="#1DB954" />
      <path
        d="M17.3 16.4a.75.75 0 0 1-1 .25c-2.8-1.7-6.3-2.1-10.4-1.1a.75.75 0 1 1-.35-1.46c4.5-1 8.4-.6 11.5 1.3.35.2.46.66.25 1ZM18.7 13.2a.94.94 0 0 1-1.3.3c-3.2-2-8.1-2.5-11.9-1.4a.94.94 0 1 1-.54-1.8c4.3-1.3 9.7-.7 13.4 1.6.44.27.58.85.3 1.3Zm.13-3.3C15 7.6 8.6 7.4 4.9 8.5a1.13 1.13 0 1 1-.65-2.16c4.2-1.3 11.3-1 15.7 1.6a1.13 1.13 0 0 1-1.15 1.96Z"
        fill="#000"
      />
    </svg>
  );
}
