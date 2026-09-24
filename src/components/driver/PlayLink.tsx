"use client";

import type { ComponentProps } from "react";
import { playback } from "@/lib/playback";
import type { SongRequest } from "@/lib/types";

/**
 * A real link to the song on YouTube. Tapping it opens the official YouTube /
 * YouTube Music app (or youtube.com) and, at the same time, updates the queue
 * via `onPlay`. It must be a user-initiated <a> so iOS hands the link to the
 * YouTube app instead of blocking a scripted pop-up.
 */
export function PlayLink({
  item,
  onPlay,
  children,
  ...props
}: Omit<ComponentProps<"a">, "href"> & {
  item: Pick<SongRequest, "youtube_url">;
  onPlay?: () => void;
}) {
  return (
    <a
      href={playback.urlFor(item)}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onPlay?.()}
      {...props}
    >
      {children}
    </a>
  );
}
