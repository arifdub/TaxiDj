"use client";

// YouTube search + paste-a-link panels, shared by the passenger "Add music"
// screen and the driver's "Add song" screen. Light theme; the driver screen
// shows them on a white card.

import { useEffect, useRef, useState } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { Button, Notice, SongSkeleton, Thumbnail, YouTubeIcon } from "@/components/ui";
import { friendlyError } from "@/lib/errors";
import { formatDuration } from "@/lib/format";
import type { RequestSource, VideoResult } from "@/lib/types";
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
