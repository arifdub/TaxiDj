import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { searchMusic } = await import("./service");

interface FakeVideo {
  id: string;
  title: string;
  channel: string;
  duration: string;
  categoryId?: string;
  description?: string;
  size?: [number, number];
}

function mockYouTube(musicHits: FakeVideo[], allHits: FakeVideo[] = []) {
  const all = new Map([...musicHits, ...allHits].map((v) => [v.id, v]));
  const calls: URL[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string) => {
      const url = new URL(input);
      calls.push(url);
      if (url.pathname.endsWith("/search")) {
        const list = url.searchParams.get("videoCategoryId") === "10" ? musicHits : allHits;
        return Response.json({ items: list.map((v) => ({ id: { kind: "youtube#video", videoId: v.id } })) });
      }
      const ids = url.searchParams.get("id")!.split(",");
      return Response.json({
        items: ids.map((id) => {
          const v = all.get(id)!;
          const [w, h] = v.size ?? [480, 270];
          return {
            id,
            snippet: {
              title: v.title,
              channelTitle: v.channel,
              description: v.description ?? "",
              categoryId: v.categoryId ?? "10",
              liveBroadcastContent: "none",
            },
            contentDetails: { duration: v.duration },
            player: { embedWidth: String(w), embedHeight: String(h) },
          };
        }),
      });
    }),
  );
  return calls;
}

const id = (n: number) => `abcdefghi${String(n).padStart(2, "0")}`;

beforeEach(() => {
  process.env.YOUTUBE_API_KEY = "test-key";
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("searchMusic", () => {
  it("uses the official search.list with the Music category and music parameters", async () => {
    const hits = Array.from({ length: 10 }, (_, i) => ({
      id: id(i),
      title: `Song ${i} (Official Audio)`,
      channel: `Artist ${i}`,
      duration: "PT3M30S",
    }));
    const calls = mockYouTube(hits);
    await searchMusic("Blinding Lights");

    const search = calls.find((u) => u.pathname.endsWith("/search"))!;
    expect(search.origin + search.pathname).toBe("https://www.googleapis.com/youtube/v3/search");
    expect(Object.fromEntries(search.searchParams)).toMatchObject({
      part: "snippet",
      type: "video",
      q: "Blinding Lights",
      videoCategoryId: "10",
      regionCode: "IE",
      relevanceLanguage: "en",
      safeSearch: "moderate",
      order: "relevance",
      videoEmbeddable: "true",
    });
    // Enough music hits → no second (all-categories) search.
    expect(calls.filter((u) => u.pathname.endsWith("/search"))).toHaveLength(1);
    const videos = calls.find((u) => u.pathname.endsWith("/videos"))!;
    expect(videos.searchParams.get("part")).toBe("snippet,contentDetails,player");
  });

  it("ranks songs first and Shorts / reactions last, keeping plain YouTube video results", async () => {
    mockYouTube(
      [
        { id: id(1), title: "Shape of You reaction", channel: "Reacts", duration: "PT12M" },
        { id: id(2), title: "shape of you #shorts", channel: "clips", duration: "PT20S", size: [203, 360] },
        { id: id(3), title: "Ed Sheeran - Shape of You (Official Music Video)", channel: "Ed Sheeran", duration: "PT4M24S" },
        { id: id(4), title: "Shape of You", channel: "Ed Sheeran - Topic", duration: "PT3M54S", description: "Provided to YouTube by Atlantic Records" },
        ...Array.from({ length: 6 }, (_, i) => ({ id: id(10 + i), title: `Other song ${i}`, channel: "Someone", duration: "PT3M" })),
      ],
    );
    const results = await searchMusic("Shape of You");
    const order = results.map((r) => r.videoId);
    expect(order.slice(0, 2).sort()).toEqual([id(3), id(4)].sort());
    expect(order.indexOf(id(1))).toBeGreaterThan(5);
    expect(order.at(-1)).toBe(id(2)); // the Short
    // Topic channel name is cleaned; thumbnails are YouTube's own.
    const topic = results.find((r) => r.videoId === id(4))!;
    expect(topic.channel).toBe("Ed Sheeran");
    expect(topic.thumbnailUrl).toBe(`https://i.ytimg.com/vi/${id(4)}/hqdefault.jpg`);
    expect(topic.durationSeconds).toBe(234);
  });

  it("tops up with an all-categories search when the Music category returns few videos", async () => {
    const calls = mockYouTube(
      [{ id: id(1), title: "Hum Dil De Chuke Sanam - Title Track", channel: "T-Series", duration: "PT7M4S" }],
      [
        { id: id(1), title: "Hum Dil De Chuke Sanam - Title Track", channel: "T-Series", duration: "PT7M4S" },
        { id: id(2), title: "Hum Dil De Chuke Sanam movie scene", channel: "Clips", duration: "PT5M", categoryId: "24" },
        { id: id(3), title: "Hum Dil De Chuke Sanam Full Song", channel: "Bollywood Classics", duration: "PT6M58S", categoryId: "24" },
      ],
    );
    const results = await searchMusic("Hum Dil De Chuke Sanam");
    const searches = calls.filter((u) => u.pathname.endsWith("/search"));
    expect(searches).toHaveLength(2);
    expect(searches[1].searchParams.has("videoCategoryId")).toBe(false);
    expect(results.map((r) => r.videoId)).toEqual([id(1), id(3), id(2)]); // de-duplicated, scene last
  });
});
