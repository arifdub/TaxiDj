"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight, CircleHelp, History, Music2, QrCode, Settings } from "lucide-react";
import { DriverGate } from "@/components/driver/DriverGate";
import { Logo } from "@/components/Logo";
import { ButtonLink, EmptyState, Skeleton } from "@/components/ui";
import { getActiveRide } from "@/lib/api";
import type { Ride } from "@/lib/types";

export function DriverHome() {
  return <DriverGate>{() => <Home />}</DriverGate>;
}

function Home() {
  const [active, setActive] = useState<Ride | null | undefined>(undefined);

  useEffect(() => {
    getActiveRide()
      .then(setActive)
      .catch(() => setActive(null));
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-4 safe-top safe-bottom">
      <section className="flex flex-1 flex-col items-center justify-center py-10">
        <div className="relative">
          <div
            aria-hidden
            className="absolute inset-0 -z-10 scale-150 rounded-full bg-taxi/10 blur-3xl"
          />
          <Logo size="xl" stacked showTagline />
        </div>
      </section>

      <section className="space-y-4 pb-4">
        {active === undefined ? (
          <Skeleton className="h-20 w-full" />
        ) : active ? (
          <Link
            href={`/driver/ride/${active.id}`}
            className="flex items-center gap-4 rounded-3xl border border-go/40 bg-go/10 p-4 hover:bg-go/15"
          >
            <span className="relative flex size-3">
              <span className="absolute inline-flex size-full rounded-full bg-go opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex size-3 rounded-full bg-go" />
            </span>
            <div className="flex-1">
              <p className="text-sm font-bold uppercase tracking-wider text-go">Ride is active</p>
              <p className="text-lg font-bold">
                Code <span className="font-mono tracking-widest text-taxi">{active.join_code}</span>
              </p>
            </div>
            <ChevronRight className="size-6 text-mist" aria-hidden />
          </Link>
        ) : (
          <EmptyState icon={<Music2 className="size-7" />} title="No active ride">
            Start a ride to let passengers add music.
          </EmptyState>
        )}

        <ButtonLink
          href={active ? `/driver/ride/${active.id}` : "/driver/ride/new"}
          size="xl"
          className="w-full text-xl"
        >
          {active ? "RESUME RIDE" : "START A RIDE"}
        </ButtonLink>

        <nav aria-label="Driver menu" className="overflow-hidden rounded-3xl border border-line bg-night-2">
          <MenuLink href="/driver/car-qr" icon={<QrCode className="size-5" />} label="Car QR card (print once)" />
          <MenuLink href="/driver/history" icon={<History className="size-5" />} label="Previous Rides" />
          <MenuLink href="/driver/settings" icon={<Settings className="size-5" />} label="Settings" />
          <MenuLink href="/driver/help" icon={<CircleHelp className="size-5" />} label="Help" />
        </nav>
      </section>
    </main>
  );
}

function MenuLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center gap-3 border-b border-line px-4 last:border-b-0 hover:bg-white/5"
    >
      <span className="text-taxi" aria-hidden>
        {icon}
      </span>
      <span className="flex-1 font-semibold">{label}</span>
      <ChevronRight className="size-5 text-mist" aria-hidden />
    </Link>
  );
}
