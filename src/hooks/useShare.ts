"use client";

import { useCallback, useState } from "react";

/** Web Share with clipboard fallback. `copied` flips true briefly after copying. */
export function useShare() {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Older iOS: fall back to a temporary input.
      const input = document.createElement("input");
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  const share = useCallback(
    async (url: string) => {
      if (navigator.share) {
        try {
          await navigator.share({
            title: "Taxi DJ",
            text: "Join my Taxi DJ ride and add your music to the queue:",
            url,
          });
          return;
        } catch (err) {
          if ((err as Error).name === "AbortError") return;
        }
      }
      await copy(url);
    },
    [copy],
  );

  return { share, copy, copied };
}
