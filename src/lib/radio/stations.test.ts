import { describe, expect, it } from "vitest";
import { distanceKm, normalizeStations, type RawStation } from "./stations";

const uuid = (n: number) => `00000000-0000-0000-0000-${String(n).padStart(12, "0")}`;
const st = (n: number, over: Partial<RawStation> = {}): RawStation => ({
  stationuuid: uuid(n),
  name: `Station ${n}`,
  url_resolved: `https://stream.example.com/${n}`,
  favicon: `https://example.com/${n}.png`,
  country: "Ireland",
  countrycode: "IE",
  state: "Dublin",
  tags: "pop,news,talk,rock,extra",
  codec: "MP3",
  bitrate: 128,
  hls: 0,
  lastcheckok: 1,
  clickcount: 10,
  votes: 0,
  ...over,
});

describe("normalizeStations", () => {
  it("keeps only working https streams and drops duplicates", () => {
    const out = normalizeStations([
      st(1),
      st(2, { url_resolved: "http://insecure.example.com/2", url: "http://insecure.example.com/2" }),
      st(3, { lastcheckok: 0 }),
      st(4, { name: "Station 1" }), // same name
      st(5, { url_resolved: "https://stream.example.com/1" }), // same stream
      st(6, { url_resolved: "", url: "https://fallback.example.com/6" }),
      st(7, { name: "   " }),
    ]);
    expect(out.map((s) => s.id)).toEqual([uuid(1), uuid(6)]);
    expect(out[1].streamUrl).toBe("https://fallback.example.com/6");
  });

  it("tidies fields", () => {
    const [s] = normalizeStations([st(1, { favicon: "http://example.com/x.png", countrycode: "ie", bitrate: 0 })]);
    expect(s.favicon).toBeNull(); // http image would be blocked
    expect(s.countryCode).toBe("IE");
    expect(s.bitrate).toBeNull();
    expect(s.tags).toEqual(["pop", "news", "talk", "rock"]);
  });

  it("sorts by popularity without a location", () => {
    const out = normalizeStations([st(1, { clickcount: 5 }), st(2, { clickcount: 50 }), st(3, { votes: 30 })]);
    expect(out.map((s) => s.id)).toEqual([uuid(3), uuid(2), uuid(1)]);
  });

  it("puts nearby stations first when a location is given", () => {
    const dublin = { lat: 53.35, lng: -6.26 };
    const out = normalizeStations(
      [
        st(1, { clickcount: 1000, geo_lat: 51.9, geo_long: -8.47 }), // Cork, ~220 km, popular
        st(2, { clickcount: 5, geo_lat: 53.34, geo_long: -6.27 }), // Dublin
        st(3, { clickcount: 500 }), // no location
      ],
      { near: dublin },
    );
    expect(out[0].id).toBe(uuid(2));
    expect(out[0].distanceKm).toBe(1);
    expect(out.find((s) => s.id === uuid(1))!.distanceKm).toBeGreaterThan(200);
  });

  it("respects the limit", () => {
    expect(normalizeStations(Array.from({ length: 60 }, (_, i) => st(i + 1)), { limit: 40 })).toHaveLength(40);
  });
});

describe("distanceKm", () => {
  it("Dublin → Cork is about 220 km", () => {
    expect(Math.round(distanceKm({ lat: 53.35, lng: -6.26 }, { lat: 51.9, lng: -8.47 }))).toBeGreaterThan(210);
  });
});
