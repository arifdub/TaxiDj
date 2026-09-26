"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Car, QrCode, RefreshCw } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button, Spinner } from "@/components/ui";
import { resolveCarCode } from "@/lib/api";
import type { CarCodeTarget } from "@/lib/types";

/**
 * Permanent car QR code (printed card in the taxi). Sends the passenger to
 * the ride the driver has running now; each ride still has its own join
 * code, so nothing carries over from earlier rides.
 */
export default function CarCodePage() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [state, setState] = useState<"loading" | "error" | "unknown" | CarCodeTarget>("loading");

  const check = useCallback(async () => {
    try {
      const target = await resolveCarCode(code);
      if (target?.state === "active" && target.join_code) {
        router.replace(`/join/${target.join_code}`);
        return;
      }
      setState(target ?? "unknown");
    } catch {
      setState("error");
    }
  }, [code, router]);

  useEffect(() => {
    // Re-check every few seconds while waiting for the driver to start a ride.
    let stop = false;
    const tick = () => {
      if (!stop) check();
    };
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, 5000);
    return () => {
      stop = true;
      clearTimeout(first);
      clearInterval(t);
    };
  }, [check]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 px-6 py-10 text-center">
      <Logo tone="light" size="xl" stacked showTagline />
      {state === "loading" ? (
        <p className="flex items-center gap-2 text-zinc-600">
          <Spinner className="size-5" /> Finding this taxi&apos;s ride…
        </p>
      ) : state === "unknown" ? (
        <div>
          <QrCode className="mx-auto size-10 text-zinc-400" aria-hidden />
          <h1 className="mt-3 text-2xl font-black">This QR code isn&apos;t in use any more</h1>
          <p className="mt-2 text-zinc-600">Ask the driver for the ride&apos;s QR code or join code.</p>
        </div>
      ) : state === "error" ? (
        <div>
          <h1 className="text-2xl font-black">Couldn&apos;t connect</h1>
          <p className="mt-2 text-zinc-600">Check your internet connection and try again.</p>
          <Button className="mt-5" onClick={() => { setState("loading"); check(); }}>
            <RefreshCw className="size-5" aria-hidden /> Try again
          </Button>
        </div>
      ) : (
        <div>
          <Car className="mx-auto size-10 text-taxi-dark" aria-hidden />
          <h1 className="mt-3 text-2xl font-black">No ride is running right now</h1>
          <p className="mt-2 text-zinc-600">
            {state.name ? <strong>{state.name}</strong> : "The driver"} hasn&apos;t started a Taxi DJ ride yet. Keep this
            page open – it opens the music queue as soon as the ride starts.
          </p>
        </div>
      )}
    </main>
  );
}
