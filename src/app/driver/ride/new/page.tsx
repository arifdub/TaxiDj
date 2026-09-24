"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { DriverGate } from "@/components/driver/DriverGate";
import { DriverShell } from "@/components/driver/DriverShell";
import { Logo } from "@/components/Logo";
import { Button, Notice, Spinner } from "@/components/ui";
import { startRide } from "@/lib/api";
import { friendlyError } from "@/lib/errors";

export default function NewRidePage() {
  return <DriverGate>{() => <StartRide />}</DriverGate>;
}

function StartRide() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const start = useCallback(async () => {
    setError(null);
    try {
      const ride = await startRide();
      router.replace(`/driver/ride/${ride.id}/qr`);
    } catch (err) {
      setError(friendlyError(err));
      started.current = false;
    }
  }, [router]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start();
  }, [start]);

  return (
    <DriverShell backHref="/">
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-6 text-center">
        <Logo size="lg" stacked />
        {error ? (
          <div className="w-full space-y-4">
            <Notice tone="error">{error}</Notice>
            <Button className="w-full" onClick={start}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-lg font-semibold text-mist" role="status">
            <Spinner className="size-6 text-taxi" /> Starting your ride…
          </div>
        )}
      </div>
    </DriverShell>
  );
}
