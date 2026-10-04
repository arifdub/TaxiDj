import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isSoundCloudUrl, pickStreamUrl, playableTracks } from "./tracks";

vi.mock("server-only", () => ({}));
const { searchSoundCloud, soundCloudStreamUrl } = await import("./service");

const track = (id: number, over = {}) => ({
  kind: "track",
  id,
  urn: `soundcloud:tracks:${id}`,
  title: `Track ${id}`,
  duration: 215_000,
  artwork_url: `https://i1.sndcdn.com/artworks-${id}-large.jpg`,
  permalink_url: `https://soundcloud.com/artist/track-${id}?utm=x`,
  access: "playable",
  streamable: true,
  user: { username: "Artist" },
  ...over,
});

describe("playableTracks", () => {
  it("keeps only fully playable tracks and tidies fields", () => {
    const out = playableTracks([
      track(1),
      track(2, { access: "preview" }),
      track(3, { access: "blocked" }),
      track(4, { streamable: false }),
      track(5, { permalink_url: "https://evil.example.com/x" }),
      track(6, { kind: "playlist" }),
      track(7, { artwork_url: null, user: { username: "DJ", avatar_url: "https://i1.sndcdn.com/avatars-7-large.jpg" } }),
    ]);
    expect(out.map((t) => t.id)).toEqual(["1", "7"]);
    expect(out[0]).toEqual({
      id: "1",
      title: "Track 1",
      artist: "Artist",
      durationSeconds: 215,
      artworkUrl: "https://i1.sndcdn.com/artworks-1-t500x500.jpg",
      permalinkUrl: "https://soundcloud.com/artist/track-1",
    });
    expect(out[1].artworkUrl).toBe("https://i1.sndcdn.com/avatars-7-t500x500.jpg");
  });

  it("recognises SoundCloud links", () => {
    expect(isSoundCloudUrl("https://soundcloud.com/a/b")).toBe(true);
    expect(isSoundCloudUrl("https://m.soundcloud.com/a/b")).toBe(true);
    expect(isSoundCloudUrl("https://soundcloud.com.evil.com/a")).toBe(false);
    expect(isSoundCloudUrl("night drive")).toBe(false);
  });

  it("prefers a plain MP3 stream, then HLS", () => {
    expect(pickStreamUrl({ hls_aac_160_url: "https://h/aac", http_mp3_128_url: "https://m/mp3" })).toBe("https://m/mp3");
    expect(pickStreamUrl({ hls_aac_160_url: "https://h/aac", hls_mp3_128_url: "https://h/mp3" })).toBe("https://h/aac");
    expect(pickStreamUrl({ preview_mp3_128_url: "https://p/prev" })).toBeNull();
  });
});

describe("SoundCloud service", () => {
  const calls: Request[] = [];
  beforeEach(() => {
    process.env.SOUNDCLOUD_CLIENT_ID = "cid";
    process.env.SOUNDCLOUD_CLIENT_SECRET = "secret";
    calls.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string, init?: RequestInit) => {
        const req = new Request(input, init);
        calls.push(req);
        const url = new URL(input);
        if (url.hostname === "secure.soundcloud.com") return Response.json({ access_token: "tok", expires_in: 3600 });
        if (url.pathname === "/tracks") return Response.json({ collection: [track(1), track(2, { access: "preview" })] });
        if (url.pathname === "/resolve") return Response.json(track(9));
        if (url.pathname.endsWith("/streams")) return Response.json({ http_mp3_128_url: "https://cf-media.sndcdn.com/x.mp3?sig=1" });
        return new Response("nope", { status: 404 });
      }),
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it("searches with app credentials and only returns playable tracks", async () => {
    const out = await searchSoundCloud("night drive");
    const tokenReq = calls.find((r) => r.url.startsWith("https://secure.soundcloud.com"))!;
    expect(tokenReq.headers.get("authorization")).toBe(`Basic ${Buffer.from("cid:secret").toString("base64")}`);
    expect(await tokenReq.text()).toBe("grant_type=client_credentials");
    const search = calls.find((r) => new URL(r.url).pathname === "/tracks")!;
    expect(search.headers.get("authorization")).toBe("OAuth tok");
    expect(new URL(search.url).searchParams.get("access")).toBe("playable");
    expect(out.map((t) => t.id)).toEqual(["1"]);
  });

  it("resolves a pasted SoundCloud link", async () => {
    const out = await searchSoundCloud("https://soundcloud.com/artist/track-9");
    expect(new URL(calls.at(-1)!.url).searchParams.get("url")).toBe("https://soundcloud.com/artist/track-9");
    expect(out[0].id).toBe("9");
  });

  it("gets SoundCloud's own stream URL for a track", async () => {
    expect(await soundCloudStreamUrl("123")).toBe("https://cf-media.sndcdn.com/x.mp3?sig=1");
    expect(new URL(calls.at(-1)!.url).pathname).toBe("/tracks/soundcloud:tracks:123/streams");
    await expect(soundCloudStreamUrl("abc")).rejects.toThrow("NOT_FOUND");
  });
});
