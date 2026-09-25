// Local ranking that makes YouTube Data API results feel like a music search.
//
// The search itself already asks YouTube for the Music category
// (videoCategoryId=10), but that alone doesn't guarantee songs: reactions,
// reviews, Shorts and movie scenes can still be tagged "Music". This scores
// each official API result on music signals (official/lyrics/full song,
// label and artist channels, "Provided to YouTube by" art tracks, song-length
// duration) and non-music signals (reaction, interview, trailer, tutorial,
// Shorts…), then sorts. Nothing is removed — unwanted results just sink —
// and YouTube's own relevance order is kept as a tie-breaker.
//
// Pure functions only (no network), so it's unit-tested.

export interface MusicCandidate {
  videoId: string;
  title: string;
  description: string;
  /** Channel name as returned by the API (may end in " - Topic"). */
  channelTitle: string;
  tags: string[];
  /** YouTube category ID ("10" = Music). */
  categoryId: string | null;
  durationSeconds: number | null;
  /** Portrait player (from videos.list player.embedWidth/embedHeight). */
  vertical: boolean | null;
  /** Position in YouTube's own relevance order (0 = first). */
  apiRank: number;
}

export const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}#]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();

/** True when `phrase` appears in `text` as whole words (both normalized). */
function has(text: string, phrase: string) {
  return ` ${text} `.includes(` ${phrase} `);
}

// Positive signals in the title (weight each; the total is capped).
const TITLE_MUSIC: [string, number][] = [
  ["official music video", 4],
  ["official video", 3.5],
  ["official audio", 3.5],
  ["official lyric video", 3.5],
  ["lyric video", 2.5],
  ["lyrical video", 2.5],
  ["lyrical", 2],
  ["lyrics", 2],
  ["official", 1.5],
  ["full song", 2.5],
  ["full video", 2],
  ["full audio", 2],
  ["video song", 2],
  ["audio song", 2],
  ["title track", 2.5],
  ["title song", 2],
  ["music video", 2],
  ["audio", 1],
  ["song", 1],
  ["soundtrack", 1.5],
  ["ost", 1.5],
  ["visualizer", 1.5],
  ["visualiser", 1.5],
  ["remastered", 1],
  ["hd video", 0.5],
];

// Well-known music labels/networks. Only a boost — any channel can rank well.
const MUSIC_LABELS = [
  "t series",
  "sony music",
  "zee music",
  "saregama",
  "tips official",
  "tips music",
  "universal music",
  "warner music",
  "atlantic records",
  "columbia records",
  "interscope",
  "republic records",
  "island records",
  "capitol records",
  "rca records",
  "def jam",
  "yrf",
  "yash raj",
  "speed records",
  "white hill music",
  "desi melodies",
  "coke studio",
  "venus",
  "shemaroo",
  "eros now music",
  "aditya music",
  "lahari music",
  "think music",
  "believe music",
  "the orchard",
  "spinnin records",
  "monstercat",
  "ncs",
  "big hit",
  "hybe labels",
  "smtown",
  "jyp entertainment",
];

// Negative signals: [phrase, title penalty]. Descriptions count at 1/4.
const NOT_MUSIC: [string, number][] = [
  ["reaction", 7],
  ["reacts", 7],
  ["reacting", 7],
  ["first time hearing", 7],
  ["review", 5],
  ["interview", 6],
  ["podcast", 6],
  ["news", 5],
  ["explained", 5],
  ["breakdown", 4],
  ["analysis", 4],
  ["trailer", 5],
  ["teaser", 4],
  ["movie scene", 6],
  ["scene", 4],
  ["scenes", 4],
  ["comedy", 4],
  ["behind the scenes", 5],
  ["making of", 4],
  ["vlog", 6],
  ["live stream", 5],
  ["livestream", 5],
  ["tutorial", 6],
  ["lesson", 5],
  ["how to play", 6],
  ["how to sing", 5],
  ["piano tutorial", 6],
  ["guitar tutorial", 6],
  ["dance tutorial", 6],
  ["easy chords", 4],
  ["chords", 3],
  ["gameplay", 6],
  ["gaming", 6],
  ["fortnite", 5],
  ["minecraft", 5],
  ["roblox", 5],
  ["shorts", 6],
  ["#shorts", 7],
  ["short", 3],
  ["status", 3],
  ["whatsapp status", 5],
  ["tiktok", 3],
  ["meme", 4],
  ["prank", 5],
  ["unboxing", 6],
  ["karaoke", 3],
  ["instrumental", 2],
  ["cover", 2],
  ["cover reaction", 7],
  ["dance cover", 4],
  ["8d audio", 2],
  ["slowed", 2],
  ["sped up", 2],
  ["nightcore", 2],
];

// Words that mean a long upload is what the passenger wants.
const LONG_OK = ["jukebox", "playlist", "mix", "album", "full album", "concert", "live", "nonstop", "mashup", "songs", "hits"];

/** Scores one candidate for a search query. Higher = more music-like. */
export function musicScore(c: MusicCandidate, query: string, total: number): number {
  const q = norm(query);
  const qWords = q.split(" ").filter((w) => w.length > 1);
  const title = norm(c.title);
  const channelRaw = c.channelTitle.trim();
  const channel = norm(channelRaw);
  const desc = norm(c.description.slice(0, 600));
  const tags = norm(c.tags.join(" "));

  let s = 0;

  // 1. Matches what was typed (song name or artist).
  if (q && has(title, q)) s += 3;
  if (qWords.length) {
    const hits = qWords.filter((w) => has(title, w) || has(channel, w)).length;
    s += (hits / qWords.length) * 3;
  }
  if (q && has(channel, q)) s += 2; // e.g. searching an artist name

  // 2. Music words in the title (capped so keyword-stuffing doesn't win).
  let titleBoost = 0;
  for (const [phrase, w] of TITLE_MUSIC) if (has(title, phrase) && !has(q, phrase)) titleBoost += w;
  s += Math.min(titleBoost, 5);

  // 3. Music channels: auto-generated artist channels, VEVO, labels.
  if (/ - Topic$/.test(channelRaw)) s += 3.5;
  if (/vevo$/i.test(channelRaw.replace(/\s+/g, ""))) s += 3.5;
  if (MUSIC_LABELS.some((l) => has(channel, l) || channel.replace(/ /g, "").startsWith(l.replace(/ /g, "")))) s += 3;
  else if (/\b(music|records|recordings|official|songs|label|entertainment)\b/.test(channel)) s += 1.5;

  // 4. Official releases in the description / category.
  if (desc.includes("provided to youtube by")) s += 3.5; // official art tracks
  if (/℗|\(p\) ?\d{4}|music label|label:|lyricist|lyrics:|composer|music director|singer:/i.test(c.description.slice(0, 1500)))
    s += 1.5;
  if (c.categoryId === "10") s += 2;
  else if (c.categoryId) s -= 1;

  // 5. Not-music signals. When the passenger asked for one ("… reaction",
  // "… piano tutorial"), results that have it rank up instead.
  let penalty = 0;
  for (const [phrase, w] of NOT_MUSIC) {
    if (has(q, phrase)) {
      if (has(title, phrase)) s += 4;
      continue;
    }
    if (has(title, phrase)) penalty += w;
    else if (has(tags, phrase) || has(desc, phrase)) penalty += w / 4;
  }
  s -= Math.min(penalty, 14);

  // 6. Length: normal songs are ~2–10 minutes. Long is fine when asked for.
  const d = c.durationSeconds;
  const wantsLong = LONG_OK.some((w) => has(q, w));
  if (d != null && d > 0) {
    if (d >= 120 && d <= 600) s += 2;
    else if (d >= 90 && d < 120) s += 0.5;
    else if (d > 600 && d <= 900) s += wantsLong ? 1 : 0;
    else if (d > 900) s += wantsLong ? 1 : d > 3600 ? -3 : -1.5;
    else if (d < 60) s -= 4;
    else s -= 1.5; // 60–90 s
  }

  // 7. Shorts: portrait player, "#shorts", or very short with no song words.
  const shortsTagged = /#shorts?\b/i.test(`${c.title} ${c.description.slice(0, 300)}`) || has(tags, "shorts");
  if (c.vertical) s -= d != null && d <= 180 ? 6 : 3;
  if (shortsTagged) s -= 4;

  // 8. YouTube's relevance order as a gentle tie-breaker.
  if (total > 1) s += ((total - 1 - c.apiRank) / (total - 1)) * 2.5;

  return s;
}

/** Candidates sorted best-first for a music search. Keeps every result. */
export function rankMusicResults<T extends MusicCandidate>(candidates: T[], query: string): T[] {
  const total = candidates.length;
  return candidates
    .map((c) => ({ c, s: musicScore(c, query, total) }))
    .sort((a, b) => b.s - a.s || a.c.apiRank - b.c.apiRank)
    .map((x) => x.c);
}

/** Shorts check from API metadata (for labelling or tests). */
export function looksLikeShort(c: Pick<MusicCandidate, "vertical" | "durationSeconds" | "title" | "description" | "tags">) {
  if (/#shorts?\b/i.test(`${c.title} ${c.description.slice(0, 300)}`) || c.tags.some((t) => /^#?shorts?$/i.test(t))) return true;
  return Boolean(c.vertical) && (c.durationSeconds ?? 0) <= 180;
}
