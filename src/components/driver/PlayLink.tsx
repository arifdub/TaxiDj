"use client";

import type { ComponentProps } from "react";
import { usePlayer } from "@/components/driver/PlayerProvider";
import type { SongRequest } from "@/lib/types";

/**
 * Play control for a queue item.
 *
 * * In-app mode: a button that loads the song into the embedded YouTube
 *   player and updates the queue via `onPlay`.
 * * YouTube-app mode: a real link to the song. Tapping it opens the official
 *   YouTube / YouTube Music app. It must be a user-initiated <a> so iOS hands
 *   the link to the app instead of blocking a scripted pop-up.
 */
export function PlayLink({
  item,
  onPlay,
  children,
  ...props
}: Omit<ComponentProps<"a">, "href"> & {
  item: Pick<SongRequest, "id" | "youtube_video_id" | "youtube_url">;
  onPlay?: () => void;
}) {
  const player = usePlayer();

  if (player?.embedded) {
    const { className, title, id, style } = props;
    return (
      <button
        type="button"
        className={className}
        title={title}
        id={id}
        style={style}
        aria-label={props["aria-label"]}
        onClick={() => {
          player.load(item);
          onPlay?.();
        }}
      >
        {children}
      </button>
    );
  }

  return (
    <a
      href={item.youtube_url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => onPlay?.()}
      {...props}
    >
      {children}
    </a>
  );
}
