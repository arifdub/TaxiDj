import { describe, expect, it } from "vitest";
import { looksLikeShort, rankMusicResults, type MusicCandidate } from "./music-rank";

// Realistic YouTube Data API result sets (titles/channels/descriptions as the
// API returns them), in YouTube's own order — deliberately with non-music
// results near the top to check they get pushed down.
type Fixture = Partial<MusicCandidate> & { title: string; channelTitle: string };

function build(list: Fixture[]): MusicCandidate[] {
  return list.map((f, i) => ({
    videoId: `vid${String(i).padStart(8, "0")}`,
    description: "",
    tags: [],
    categoryId: "10",
    durationSeconds: 240,
    vertical: false,
    apiRank: i,
    ...f,
  }));
}

const titles = (list: MusicCandidate[]) => list.map((c) => c.title);
const rankOf = (list: MusicCandidate[], title: string) => titles(list).indexOf(title);

const SEARCHES: Record<string, { results: Fixture[]; good: string[]; bad: string[] }> = {
  "Hum Dil De Chuke Sanam": {
    results: [
      { title: "Hum Dil De Chuke Sanam Movie Scene | Salman Khan, Aishwarya Rai", channelTitle: "Bollywood Scenes", categoryId: "24", durationSeconds: 420 },
      { title: "Hum Dil De Chuke Sanam reaction | Foreigners react", channelTitle: "React Nation", categoryId: "24", durationSeconds: 900 },
      { title: "Hum Dil De Chuke Sanam - Title Track | Salman Khan, Aishwarya Rai | Kavita Krishnamurthy", channelTitle: "T-Series", durationSeconds: 424, description: "Song: Hum Dil De Chuke Sanam\nSinger: Kavita Krishnamurthy\nMusic Director: Ismail Darbar" },
      { title: "Aishwarya Rai interview about Hum Dil De Chuke Sanam", channelTitle: "Filmfare", categoryId: "25", durationSeconds: 610 },
      { title: "Hum Dil De Chuke Sanam", channelTitle: "Kavita Krishnamurthy - Topic", durationSeconds: 418, description: "Provided to YouTube by Universal Music India\n\nHum Dil De Chuke Sanam · Kavita Krishnamurthy" },
      { title: "Hum Dil De Chuke Sanam #shorts", channelTitle: "Aish Fan", durationSeconds: 28, vertical: true },
      { title: "Hum Dil De Chuke Sanam Full Song | Bollywood Classics", channelTitle: "Bollywood Classics", durationSeconds: 424 },
      { title: "Hum Dil De Chuke Sanam (1999) Movie Review", channelTitle: "Film Companion", categoryId: "1", durationSeconds: 780 },
    ],
    good: [
      "Hum Dil De Chuke Sanam - Title Track | Salman Khan, Aishwarya Rai | Kavita Krishnamurthy",
      "Hum Dil De Chuke Sanam",
      "Hum Dil De Chuke Sanam Full Song | Bollywood Classics",
    ],
    bad: [
      "Hum Dil De Chuke Sanam Movie Scene | Salman Khan, Aishwarya Rai",
      "Hum Dil De Chuke Sanam reaction | Foreigners react",
      "Aishwarya Rai interview about Hum Dil De Chuke Sanam",
      "Hum Dil De Chuke Sanam #shorts",
      "Hum Dil De Chuke Sanam (1999) Movie Review",
    ],
  },
  "Shape of You": {
    results: [
      { title: "Shape of You reaction!!", channelTitle: "Music Reacts", durationSeconds: 540 },
      { title: "Shape of You - Piano Tutorial (Easy)", channelTitle: "Piano Pete", durationSeconds: 300 },
      { title: "Ed Sheeran - Shape of You (Official Music Video)", channelTitle: "Ed Sheeran", durationSeconds: 263 },
      { title: "Shape of You Dance Tutorial", channelTitle: "Dance Studio", categoryId: "26", durationSeconds: 480 },
      { title: "Shape of You", channelTitle: "Ed Sheeran - Topic", durationSeconds: 234, description: "Provided to YouTube by Rhino/Warner Records\n\nShape of You · Ed Sheeran" },
      { title: "Ed Sheeran - Shape Of You (Lyrics)", channelTitle: "7clouds", durationSeconds: 235 },
      { title: "Ed Sheeran Shape of You review — is it overrated?", channelTitle: "Pop Critic", durationSeconds: 720 },
      { title: "shape of you #shorts", channelTitle: "random", durationSeconds: 15, vertical: true },
    ],
    good: ["Ed Sheeran - Shape of You (Official Music Video)", "Shape of You", "Ed Sheeran - Shape Of You (Lyrics)"],
    bad: [
      "Shape of You reaction!!",
      "Shape of You - Piano Tutorial (Easy)",
      "Shape of You Dance Tutorial",
      "Ed Sheeran Shape of You review — is it overrated?",
      "shape of you #shorts",
    ],
  },
  "Blinding Lights": {
    results: [
      { title: "The Weeknd - Blinding Lights (Official Video)", channelTitle: "TheWeekndVEVO", durationSeconds: 263 },
      { title: "Blinding Lights | Gameplay Fortnite emote", channelTitle: "GamerX", categoryId: "20", durationSeconds: 60 },
      { title: "The Weeknd - Blinding Lights (Official Audio)", channelTitle: "The Weeknd", durationSeconds: 202 },
      { title: "Blinding Lights explained: the meaning behind the song", channelTitle: "Song Explainers", categoryId: "27", durationSeconds: 600 },
      { title: "The Weeknd - Blinding Lights (Lyrics)", channelTitle: "Lyrics Hub", durationSeconds: 201 },
    ],
    good: ["The Weeknd - Blinding Lights (Official Video)", "The Weeknd - Blinding Lights (Official Audio)", "The Weeknd - Blinding Lights (Lyrics)"],
    bad: ["Blinding Lights | Gameplay Fortnite emote", "Blinding Lights explained: the meaning behind the song"],
  },
  Pasoori: {
    results: [
      { title: "Pasoori reaction | Coke Studio Season 14", channelTitle: "Desi Reacts", durationSeconds: 840 },
      { title: "Coke Studio | Season 14 | Pasoori | Ali Sethi x Shae Gill", channelTitle: "Coke Studio Pakistan", durationSeconds: 224 },
      { title: "Pasoori - Lyrics | Ali Sethi, Shae Gill", channelTitle: "Lyrical Beats", durationSeconds: 226 },
      { title: "Pasoori song status 🔥 #shorts", channelTitle: "status king", durationSeconds: 30, vertical: true },
      { title: "Ali Sethi interview: how Pasoori happened", channelTitle: "BBC News", categoryId: "25", durationSeconds: 540 },
    ],
    good: ["Coke Studio | Season 14 | Pasoori | Ali Sethi x Shae Gill", "Pasoori - Lyrics | Ali Sethi, Shae Gill"],
    bad: ["Pasoori reaction | Coke Studio Season 14", "Pasoori song status 🔥 #shorts", "Ali Sethi interview: how Pasoori happened"],
  },
  Despacito: {
    results: [
      { title: "Despacito guitar lesson - how to play", channelTitle: "Guitar Guy", categoryId: "27", durationSeconds: 900 },
      { title: "Luis Fonsi - Despacito ft. Daddy Yankee", channelTitle: "LuisFonsiVEVO", durationSeconds: 282 },
      { title: "Despacito (Lyrics / Letra) - Luis Fonsi ft. Daddy Yankee", channelTitle: "Latin Lyrics", durationSeconds: 229 },
      { title: "Despacito news: most viewed video ever", channelTitle: "CNN", categoryId: "25", durationSeconds: 180 },
    ],
    good: ["Luis Fonsi - Despacito ft. Daddy Yankee", "Despacito (Lyrics / Letra) - Luis Fonsi ft. Daddy Yankee"],
    bad: ["Despacito guitar lesson - how to play", "Despacito news: most viewed video ever"],
  },
  "Arijit Singh": {
    results: [
      { title: "Arijit Singh interview with Karan Johar", channelTitle: "Star World", categoryId: "24", durationSeconds: 1500 },
      { title: "Tum Hi Ho - Aashiqui 2 | Arijit Singh | Full Video Song", channelTitle: "T-Series", durationSeconds: 262 },
      { title: "Arijit Singh Live Stream | Concert Vlog", channelTitle: "Fan Vlogs", categoryId: "22", durationSeconds: 3000 },
      { title: "Kesariya - Brahmastra | Arijit Singh | Official Lyric Video", channelTitle: "Sony Music India", durationSeconds: 268 },
      { title: "Channa Mereya", channelTitle: "Arijit Singh - Topic", durationSeconds: 289, description: "Provided to YouTube by Sony Music Entertainment India" },
    ],
    good: [
      "Tum Hi Ho - Aashiqui 2 | Arijit Singh | Full Video Song",
      "Kesariya - Brahmastra | Arijit Singh | Official Lyric Video",
      "Channa Mereya",
    ],
    bad: ["Arijit Singh interview with Karan Johar", "Arijit Singh Live Stream | Concert Vlog"],
  },
  "Taylor Swift": {
    results: [
      { title: "Taylor Swift news: Eras Tour announcement", channelTitle: "Entertainment Tonight", categoryId: "24", durationSeconds: 300 },
      { title: "Taylor Swift - Anti-Hero (Official Music Video)", channelTitle: "TaylorSwiftVEVO", durationSeconds: 290 },
      { title: "Reacting to Taylor Swift for the first time", channelTitle: "Reaction Room", durationSeconds: 1200 },
      { title: "Taylor Swift - Cruel Summer (Official Audio)", channelTitle: "Taylor Swift", durationSeconds: 179 },
      { title: "Taylor Swift podcast episode 12", channelTitle: "Swiftie Pod", categoryId: "22", durationSeconds: 3600 },
    ],
    good: ["Taylor Swift - Anti-Hero (Official Music Video)", "Taylor Swift - Cruel Summer (Official Audio)"],
    bad: [
      "Taylor Swift news: Eras Tour announcement",
      "Reacting to Taylor Swift for the first time",
      "Taylor Swift podcast episode 12",
    ],
  },
  "Bollywood songs": {
    results: [
      { title: "Bollywood songs reaction compilation", channelTitle: "React Pals", durationSeconds: 1300 },
      { title: "Bollywood Romantic Songs 2024 | Video Jukebox | Top Hindi Songs", channelTitle: "T-Series", durationSeconds: 3000 },
      { title: "Top Bollywood songs explained", channelTitle: "Film Nerd", categoryId: "27", durationSeconds: 700 },
      { title: "Tum Se Hi | Jab We Met | Full Song", channelTitle: "Saregama Music", durationSeconds: 322 },
      { title: "Bollywood songs #shorts", channelTitle: "clips", durationSeconds: 20, vertical: true },
    ],
    good: ["Bollywood Romantic Songs 2024 | Video Jukebox | Top Hindi Songs", "Tum Se Hi | Jab We Met | Full Song"],
    bad: ["Bollywood songs reaction compilation", "Top Bollywood songs explained", "Bollywood songs #shorts"],
  },
};

describe("rankMusicResults", () => {
  it.each(Object.entries(SEARCHES))("puts songs first for “%s”", (query, { results, good, bad }) => {
    const ranked = rankMusicResults(build(results), query);
    // Nothing is dropped.
    expect(ranked).toHaveLength(results.length);
    // Every music result ranks above every non-music result.
    const worstGood = Math.max(...good.map((t) => rankOf(ranked, t)));
    const bestBad = Math.min(...bad.map((t) => rankOf(ranked, t)));
    expect(good.every((t) => rankOf(ranked, t) >= 0) && bad.every((t) => rankOf(ranked, t) >= 0)).toBe(true);
    expect(worstGood, titles(ranked).join("\n")).toBeLessThan(bestBad);
  });

  it("keeps YouTube's order for equally good results", () => {
    const ranked = rankMusicResults(
      build([
        { title: "Song A (Official Audio)", channelTitle: "Artist A" },
        { title: "Song B (Official Audio)", channelTitle: "Artist B" },
      ]),
      "song",
    );
    expect(titles(ranked)).toEqual(["Song A (Official Audio)", "Song B (Official Audio)"]);
  });

  it("doesn't penalise words the passenger searched for", () => {
    const ranked = rankMusicResults(
      build([
        { title: "Ed Sheeran - Shape of You (Official Music Video)", channelTitle: "Ed Sheeran" },
        { title: "Shape of You reaction", channelTitle: "Music Reacts" },
      ]),
      "Shape of You reaction",
    );
    expect(ranked[0].title).toBe("Shape of You reaction");
  });

  it("works for independent artists (no label, no keywords)", () => {
    const ranked = rankMusicResults(
      build([
        { title: "Midnight Drive vlog", channelTitle: "Travel With Sam", categoryId: "19", durationSeconds: 1100 },
        { title: "Midnight Drive", channelTitle: "Lena Park", durationSeconds: 211 },
      ]),
      "Midnight Drive",
    );
    expect(ranked[0].title).toBe("Midnight Drive");
  });

  it("doesn't hard-reject long uploads (concerts, jukeboxes)", () => {
    const ranked = rankMusicResults(
      build([{ title: "Arijit Singh Live Concert Full", channelTitle: "Arijit Singh", durationSeconds: 5400 }]),
      "Arijit Singh live concert",
    );
    expect(ranked).toHaveLength(1);
  });
});

describe("looksLikeShort", () => {
  it("detects Shorts from API metadata", () => {
    const base = { title: "x", description: "", tags: [] as string[], durationSeconds: 30, vertical: false };
    expect(looksLikeShort({ ...base, vertical: true })).toBe(true);
    expect(looksLikeShort({ ...base, title: "song #shorts" })).toBe(true);
    expect(looksLikeShort({ ...base, tags: ["Shorts"] })).toBe(true);
    expect(looksLikeShort(base)).toBe(false);
    expect(looksLikeShort({ ...base, vertical: true, durationSeconds: 600 })).toBe(false);
  });
});
