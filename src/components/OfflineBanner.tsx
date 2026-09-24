"use client";

import { WifiOff } from "lucide-react";
import { useOnline } from "@/hooks/useOnline";

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 bg-stop px-4 py-2 text-sm font-bold text-white"
    >
      <WifiOff className="size-4" aria-hidden />
      You&apos;re offline. We&apos;ll reconnect automatically.
    </div>
  );
}
