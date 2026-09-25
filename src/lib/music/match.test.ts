import { describe, expect, it } from "vitest";
import type { VideoResult } from "@/lib/types";
import { pickBestMatch } from "./match";

const v = (videoId: string, title: string, channel: string, durationSeconds: number): VideoResult => ({
  videoId,
  title,
  channel,
  durationSeconds,
  thumbnailUrl: "",
});

describe("pickBestMatch", () => {
  const track = { title: "Blinding Lights", artist: "The Weeknd", durationSeconds: 200 };

  it("prefers the official version with matching duration", () => {
    const best = pickBestMatch(
      [
        v("aaaaaaaaaaa", "Blinding Lights (Cover)", "Some Singer", 201),
        v("bbbbbbbbbbb", "The Weeknd - Blinding Lights (Live)", "The Weeknd", 260),
        v("ccccccccccc", "Blinding Lights", "The Weeknd - Topic", 200),
      ],
      track,
    );
    expect(best?.videoId).toBe("ccccccccccc");
  });

  it("returns null with no candidates", () => {
    expect(pickBestMatch([], track)).toBeNull();
  });

  it("keeps remixes when the track itself is a remix", () => {
    const best = pickBestMatch(
      [v("aaaaaaaaaaa", "Song", "Artist", 180), v("bbbbbbbbbbb", "Song (Remix)", "Artist", 240)],
      { title: "Song (Remix)", artist: "Artist", durationSeconds: 240 },
    );
    expect(best?.videoId).toBe("bbbbbbbbbbb");
  });
});
