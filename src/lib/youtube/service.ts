import "server-only";

// Server-side YouTube integration. Everything YouTube-specific lives here so
// the provider can be swapped or upgraded without touching the UI.
//
// Uses only official endpoints:
//   * YouTube Data API v3 (search.list, videos.list) — needs YOUTUBE_API_KEY
//   * YouTube oEmbed — keyless fallback for looking up a pasted link
// No scraping, no media download.

import type { VideoResult } from "@/lib/types";
import { rankMusicResults, type MusicCandidate } from "./music-rank";
import { isValidVideoId, parseIsoDuration, youTubeThumbnailUrl } from "./parse";

const API = "https://www.googleapis.com/youtube/v3";

export class YouTubeError extends Error {
  constructor(
    public code: "NOT_CONFIGURED" | "NOT_FOUND" | "UPSTREAM" | "QUOTA",
    message?: string,
  ) {
    super(message ?? code);
  }
}

export function isYouTubeSearchConfigured() {
  return Boolean(process.env.YOUTUBE_API_KEY);
}

function apiKey() {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) throw new YouTubeError("NOT_CONFIGURED");
  return key;
}

/** Decodes the few HTML entities the Data API puts in snippet titles. */
function decodeEntities(text: string) {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Strips YouTube's auto-generated " - Topic" suffix from music channels. */
function cleanChannel(name: string | undefined | null) {
  if (!name) return null;
  return decodeEntities(name).replace(/ - Topic$/, "");
}

async function getJson(url: string) {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 3600 },
  });
  if (res.status === 403) throw new YouTubeError("QUOTA");
  if (res.status === 404 || res.status === 401) throw new YouTubeError("NOT_FOUND");
  if (!res.ok) throw new YouTubeError("UPSTREAM", `YouTube responded ${res.status}`);
  return res.json();
}

interface ApiVideo {
  id: string;
  snippet?: {
    title?: string;
    description?: string;
    channelTitle?: string;
    tags?: string[];
    categoryId?: string;
    liveBroadcastContent?: string;
  };
  contentDetails?: { duration?: string };
  player?: { embedWidth?: string | number; embedHeight?: string | number };
}

function toResult(v: ApiVideo): VideoResult {
  return {
    videoId: v.id,
    title: decodeEntities(v.snippet?.title ?? "YouTube video"),
    channel: cleanChannel(v.snippet?.channelTitle),
    thumbnailUrl: youTubeThumbnailUrl(v.id),
    durationSeconds: parseIsoDuration(v.contentDetails?.duration),
  };
}

async function videosById(ids: string[], withPlayer = false): Promise<ApiVideo[]> {
  if (ids.length === 0) return [];
  const params = new URLSearchParams({
    part: withPlayer ? "snippet,contentDetails,player" : "snippet,contentDetails",
    id: ids.join(","),
    maxResults: String(ids.length),
    key: apiKey(),
  });
  // With a size limit, the API reports the player's aspect ratio (portrait = Shorts).
  if (withPlayer) params.set("maxHeight", "360");
  const data = await getJson(`${API}/videos?${params}`);
  return (data.items ?? []) as ApiVideo[];
}

/** Searches YouTube for music videos. Requires YOUTUBE_API_KEY. */
export async function searchVideos(query: string, maxResults = 12): Promise<VideoResult[]> {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    q: query,
    maxResults: String(maxResults),
    videoEmbeddable: "true",
    safeSearch: "moderate",
    key: apiKey(),
  });
  const data = await getJson(`${API}/search?${params}`);
  const ids: string[] = (data.items ?? [])
    .map((item: { id?: { videoId?: string } }) => item.id?.videoId)
    .filter(isValidVideoId);

  // search.list has no durations; one cheap videos.list call adds them.
  const details = await videosById(ids);
  const byId = new Map(details.map((v) => [v.id, v]));
  return ids
    .map((id) => byId.get(id))
    .filter((v): v is ApiVideo => Boolean(v) && v!.snippet?.liveBroadcastContent !== "live")
    .map(toResult);
}

// ------------------------------------------------------------ Music search

const MUSIC_CATEGORY = "10";
/** Candidates fetched from YouTube before local ranking. */
const MUSIC_POOL = 25;
/** Below this many music-category hits, also search all categories. */
const MUSIC_MIN_HITS = 8;

async function searchIds(query: string, extra: Record<string, string>) {
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    q: query,
    maxResults: String(MUSIC_POOL),
    videoEmbeddable: "true",
    safeSearch: "moderate",
    order: "relevance",
    regionCode: "IE",
    relevanceLanguage: "en",
    key: apiKey(),
    ...extra,
  });
  const data = await getJson(`${API}/search?${params}`);
  return (data.items ?? [])
    .map((item: { id?: { videoId?: string } }) => item.id?.videoId)
    .filter(isValidVideoId) as string[];
}

function isVertical(v: ApiVideo): boolean | null {
  const w = Number(v.player?.embedWidth);
  const h = Number(v.player?.embedHeight);
  return w > 0 && h > 0 ? h > w : null;
}

/**
 * Music-focused search for the "Search music" screen.
 *
 * Official YouTube Data API only: search.list in the Music category
 * (videoCategoryId=10), then one videos.list call for durations, categories
 * and player shape, then local ranking (see music-rank.ts). If the Music
 * category returns few videos, a regular search tops up the pool; its
 * results are ranked the same way. Every result is a normal YouTube video.
 */
export async function searchMusic(query: string, maxResults = 15): Promise<VideoResult[]> {
  let ids = await searchIds(query, { videoCategoryId: MUSIC_CATEGORY });
  if (ids.length < MUSIC_MIN_HITS) {
    const more = await searchIds(query, {});
    ids = [...new Set([...ids, ...more])].slice(0, MUSIC_POOL + MUSIC_MIN_HITS);
  }

  const details = await videosById(ids.slice(0, 50), true);
  const byId = new Map(details.map((v) => [v.id, v]));
  const candidates: (MusicCandidate & { video: ApiVideo })[] = [];
  ids.forEach((id) => {
    const v = byId.get(id);
    const live = v?.snippet?.liveBroadcastContent;
    if (!v || live === "live" || live === "upcoming") return;
    candidates.push({
      videoId: id,
      title: decodeEntities(v.snippet?.title ?? ""),
      description: v.snippet?.description ?? "",
      channelTitle: decodeEntities(v.snippet?.channelTitle ?? ""),
      tags: v.snippet?.tags ?? [],
      categoryId: v.snippet?.categoryId ?? null,
      durationSeconds: parseIsoDuration(v.contentDetails?.duration),
      vertical: isVertical(v),
      apiRank: candidates.length,
      video: v,
    });
  });

  return rankMusicResults(candidates, query)
    .slice(0, maxResults)
    .map((c) => toResult(c.video));
}

/**
 * Looks up metadata for a single video. Uses the Data API when configured,
 * otherwise the official oEmbed endpoint (no duration available).
 */
export async function lookupVideo(videoId: string): Promise<VideoResult> {
  if (!isValidVideoId(videoId)) throw new YouTubeError("NOT_FOUND");

  if (isYouTubeSearchConfigured()) {
    const [video] = await videosById([videoId]);
    if (!video) throw new YouTubeError("NOT_FOUND");
    return toResult(video);
  }

  const params = new URLSearchParams({
    url: `https://www.youtube.com/watch?v=${videoId}`,
    format: "json",
  });
  const data = await getJson(`https://www.youtube.com/oembed?${params}`);
  return {
    videoId,
    title: typeof data.title === "string" ? data.title : "YouTube video",
    channel: cleanChannel(data.author_name),
    thumbnailUrl: youTubeThumbnailUrl(videoId),
    durationSeconds: null,
  };
}
