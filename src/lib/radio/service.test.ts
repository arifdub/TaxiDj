import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { findStations } = await import("./service");

afterEach(() => vi.unstubAllGlobals());

const station = (id: string, extra = {}) => ({
  stationuuid: `00000000-0000-0000-0000-${id.padStart(12, "0")}`,
  name: `Station ${id}`,
  url_resolved: `https://s.example.com/${id}`,
  lastcheckok: 1,
  clickcount: 1,
  ...extra,
});

describe("findStations", () => {
  it("asks for nearby stations and the country's popular ones, https only", async () => {
    const calls: URL[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const url = new URL(input);
        calls.push(url);
        if (url.hostname === "all.api.radio-browser.info") return Response.json([{ name: "de1.api.radio-browser.info" }]);
        if (url.searchParams.has("geo_lat")) return Response.json([station("1", { geo_lat: 53.34, geo_long: -6.27 })]);
        return Response.json([station("2", { clickcount: 999 }), station("1", { geo_lat: 53.34, geo_long: -6.27 })]);
      }),
    );
    const out = await findStations({ lat: 53.35, lng: -6.26, countryCode: "IE" });
    const searches = calls.filter((u) => u.pathname === "/json/stations/search");
    const geo = searches.find((u) => u.searchParams.has("geo_lat"))!;
    expect(geo.hostname).toBe("de1.api.radio-browser.info");
    expect(Object.fromEntries(geo.searchParams)).toMatchObject({
      geo_lat: "53.35",
      geo_long: "-6.26",
      geo_distance: "100000",
      is_https: "true",
      hidebroken: "true",
    });
    expect(searches.find((u) => u.searchParams.get("countrycode") === "IE")).toBeTruthy();
    // Nearby first, de-duplicated.
    expect(out.map((s) => s.name)).toEqual(["Station 1", "Station 2"]);
  });

  it("tries another mirror when one fails", async () => {
    let n = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string) => {
        const url = new URL(input);
        if (url.hostname === "all.api.radio-browser.info") throw new Error("down");
        n++;
        if (n === 1) return new Response("oops", { status: 500 });
        return Response.json([station("3")]);
      }),
    );
    const out = await findStations({ query: "rte", countryCode: "IE" });
    expect(out.map((s) => s.name)).toEqual(["Station 3"]);
  });
});
