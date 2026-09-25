import { describe, expect, it } from "vitest";
import { isValidSpotifyTrackId, looksLikeSpotifyLink, parseSpotifyTrackLink } from "./parse";

const ID = "0VjIjW4GlUZAMYd2vXMi3b";

describe("parseSpotifyTrackLink", () => {
  it.each([
    [`https://open.spotify.com/track/${ID}`],
    [`https://open.spotify.com/track/${ID}?si=abc123`],
    [`https://open.spotify.com/intl-de/track/${ID}`],
    [`open.spotify.com/track/${ID}`],
    [`spotify:track:${ID}`],
  ])("accepts %s", (input) => {
    expect(parseSpotifyTrackLink(input)).toBe(ID);
  });

  it.each([
    [`https://open.spotify.com/album/${ID}`],
    [`https://evil.com/track/${ID}`],
    ["https://open.spotify.com/track/short"],
    ["blinding lights"],
  ])("rejects %s", (input) => {
    expect(parseSpotifyTrackLink(input)).toBeNull();
  });

  it("detects links", () => {
    expect(looksLikeSpotifyLink(`https://open.spotify.com/track/${ID}`)).toBe(true);
    expect(looksLikeSpotifyLink("the weeknd")).toBe(false);
    expect(isValidSpotifyTrackId(ID)).toBe(true);
    expect(isValidSpotifyTrackId("x")).toBe(false);
  });
});
