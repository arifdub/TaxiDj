"use client";

import { TriangleAlert, X } from "lucide-react";
import { useDriverRide } from "@/components/driver/RideContext";

export function ErrorBar() {
  const { error, clearError } = useDriverRide();
  if (!error) return null;
  return (
    <div role="alert" className="mb-4 flex items-center gap-3 rounded-2xl border border-stop/40 bg-stop/10 p-3 text-sm font-semibold text-red-200">
      <TriangleAlert className="size-5 shrink-0 text-stop" aria-hidden />
      <span className="flex-1">{error}</span>
      <button type="button" onClick={clearError} aria-label="Dismiss" className="grid size-9 place-items-center rounded-full hover:bg-white/5">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
