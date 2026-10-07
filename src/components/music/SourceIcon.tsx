import { FileAudio } from "lucide-react";
import { SoundCloudIcon, SpotifyIcon } from "@/components/music/AddSongPanels";
import { YouTubeIcon } from "@/components/ui";
import type { SongRequest } from "@/lib/types";

/** Small logo for where a song comes from (YouTube, Spotify pick, SoundCloud, audio file). */
export function SourceIcon({
  song,
  size = "sm",
}: {
  song: Pick<SongRequest, "provider" | "spotify_track_id">;
  size?: "sm" | "md";
}) {
  const sq = size === "md" ? "size-4" : "size-3";
  if (song.provider === "audio") return <FileAudio className={`${sq} shrink-0 text-taxi`} aria-hidden />;
  if (song.provider === "soundcloud") return <SoundCloudIcon className={`${sq} shrink-0`} />;
  if (song.spotify_track_id) return <SpotifyIcon className={`${sq} shrink-0`} />;
  return <YouTubeIcon className={`${size === "md" ? "h-4" : "h-3"} w-auto shrink-0`} />;
}
