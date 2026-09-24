import { describe, expect, it } from "vitest";
import { isValidVideoId, parseIsoDuration, parseYouTubeUrl } from "./parse";

describe("parseYouTubeUrl", () => {
  it.each([
    ["https://www.youtube.com/watch?v=fHI8X4OXluQ", "youtube"],
    ["https://youtube.com/watch?v=fHI8X4OXluQ&t=42s", "youtube"],
    ["https://m.youtube.com/watch?v=fHI8X4OXluQ", "youtube"],
    ["https://youtu.be/fHI8X4OXluQ?si=abc", "youtube"],
    ["youtu.be/fHI8X4OXluQ", "youtube"],
    ["https://www.youtube.com/shorts/fHI8X4OXluQ", "youtube"],
    ["https://www.youtube.com/embed/fHI8X4OXluQ", "youtube"],
    ["https://www.youtube.com/live/fHI8X4OXluQ?feature=share", "youtube"],
    ["https://www.youtube.com/watch?v=fHI8X4OXluQ&list=PL123", "youtube"],
    ["https://music.youtube.com/watch?v=fHI8X4OXluQ&feature=share", "youtube_music"],
    ["  https://www.youtube.com/watch?v=fHI8X4OXluQ  ", "youtube"],
  ])("accepts %s", (input, source) => {
    expect(parseYouTubeUrl(input)).toEqual({ ok: true, videoId: "fHI8X4OXluQ", source });
  });

  it.each([
    ["", "EMPTY"],
    ["https://evil.com/watch?v=fHI8X4OXluQ", "NOT_YOUTUBE"],
    ["https://youtube.com.evil.com/watch?v=fHI8X4OXluQ", "NOT_YOUTUBE"],
    ["https://user@youtube.com/watch?v=fHI8X4OXluQ", "NOT_YOUTUBE"],
    ["javascript:alert(1)", "NOT_YOUTUBE"],
    ["not a url at all", "NOT_YOUTUBE"],
    ["https://www.youtube.com/playlist?list=PL123", "PLAYLIST_ONLY"],
    ["https://www.youtube.com/watch?v=short", "NO_VIDEO"],
    ["https://www.youtube.com/@TheWeeknd", "NO_VIDEO"],
  ])("rejects %s", (input, error) => {
    expect(parseYouTubeUrl(input)).toEqual({ ok: false, error });
  });
});

describe("isValidVideoId", () => {
  it("validates 11-character IDs", () => {
    expect(isValidVideoId("fHI8X4OXluQ")).toBe(true);
    expect(isValidVideoId("fHI8X4OXlu")).toBe(false);
    expect(isValidVideoId("fHI8X4OXl'Q")).toBe(false);
    expect(isValidVideoId(null)).toBe(false);
  });
});

describe("parseIsoDuration", () => {
  it("parses durations", () => {
    expect(parseIsoDuration("PT3M20S")).toBe(200);
    expect(parseIsoDuration("PT1H2M3S")).toBe(3723);
    expect(parseIsoDuration("PT45S")).toBe(45);
    expect(parseIsoDuration("P0D")).toBe(0);
    expect(parseIsoDuration("garbage")).toBeNull();
    expect(parseIsoDuration(undefined)).toBeNull();
  });
});
