import { describe, expect, it } from "vitest";
import { parseAudioLink } from "./link";

describe("parseAudioLink", () => {
  it("turns Google Drive share links into direct file links", () => {
    for (const link of [
      "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp_qrs-TUV/view?usp=sharing",
      "https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp_qrs-TUV",
      "drive.google.com/uc?id=1AbCdEfGhIjKlMnOp_qrs-TUV&export=download",
    ]) {
      expect(parseAudioLink(link)).toEqual({
        url: "https://drive.google.com/uc?export=download&id=1AbCdEfGhIjKlMnOp_qrs-TUV",
        sourceLabel: "Google Drive",
        titleGuess: null,
      });
    }
  });

  it("rejects Drive and Dropbox folders", () => {
    expect(parseAudioLink("https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp")).toEqual({ error: "FOLDER" });
    expect(parseAudioLink("https://www.dropbox.com/home/Music")).toEqual({ error: "FOLDER" });
  });

  it("makes Dropbox links serve the file and keeps the key", () => {
    const r = parseAudioLink("https://www.dropbox.com/scl/fi/abc123/My_Song.mp3?rlkey=xyz&dl=0");
    expect(r).toEqual({
      url: "https://www.dropbox.com/scl/fi/abc123/My_Song.mp3?rlkey=xyz&raw=1",
      sourceLabel: "Dropbox",
      titleGuess: "My Song",
    });
  });

  it("accepts direct audio links and guesses the title from the file name", () => {
    expect(parseAudioLink("https://example.com/music/Night%20Drive.mp3#t=3")).toEqual({
      url: "https://example.com/music/Night%20Drive.mp3",
      sourceLabel: "example.com",
      titleGuess: "Night Drive",
    });
    expect(parseAudioLink("https://www.cdn.example.org/stream?id=4")).toMatchObject({ sourceLabel: "cdn.example.org", titleGuess: null });
  });

  it("refuses insecure, private and non-links", () => {
    expect(parseAudioLink("")).toEqual({ error: "EMPTY" });
    expect(parseAudioLink("not a link")).toEqual({ error: "NOT_LINK" });
    expect(parseAudioLink("http://example.com/a.mp3")).toEqual({ error: "NOT_HTTPS" });
    expect(parseAudioLink("ftp://example.com/a.mp3")).toEqual({ error: "NOT_LINK" });
    for (const h of ["localhost", "192.168.1.5", "10.0.0.1", "127.0.0.1", "172.20.1.1", "[::1]", "nas.local"]) {
      expect(parseAudioLink(`https://${h}/a.mp3`)).toEqual({ error: "NOT_ALLOWED" });
    }
    expect(parseAudioLink("https://user:pw@example.com/a.mp3")).toEqual({ error: "NOT_ALLOWED" });
    expect(parseAudioLink(`https://example.com/${"a".repeat(2100)}.mp3`)).toEqual({ error: "TOO_LONG" });
  });
});
