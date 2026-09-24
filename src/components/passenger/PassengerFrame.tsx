"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Ban, Clock, QrCode, WifiOff } from "lucide-react";
import { ConfigNotice } from "@/components/ConfigNotice";
import { Logo } from "@/components/Logo";
import { Button, Skeleton } from "@/components/ui";
import { PassengerProvider, usePassenger } from "@/components/passenger/PassengerContext";
import { isSupabaseConfigured } from "@/lib/supabase/client";

/** Bright, simple frame for the passenger web app. */
export function PassengerFrame({ code, children }: { code: string; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-zinc-50 text-ink">
      <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col bg-white px-4 safe-top safe-bottom sm:border-x sm:border-zinc-200">
        {isSupabaseConfigured ? (
          <PassengerProvider code={code}>
            <Gate>{children}</Gate>
          </PassengerProvider>
        ) : (
          <div className="py-10">
            <div className="mb-8 flex justify-center">
              <Logo tone="light" size="lg" stacked showTagline />
            </div>
            <ConfigNotice tone="light" />
          </div>
        )}
      </div>
    </div>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const { phase, retry } = usePassenger();

  if (phase === "loading") {
    return (
      <div className="flex flex-1 flex-col items-center gap-6 py-16" role="status" aria-label="Loading ride">
        <Logo tone="light" size="lg" stacked showTagline />
        <Skeleton tone="light" className="h-6 w-48" />
        <Skeleton tone="light" className="h-14 w-full" />
        <Skeleton tone="light" className="h-14 w-full" />
      </div>
    );
  }
  if (phase === "invalid") {
    return (
      <StatusScreen icon={<QrCode className="size-8" />} title="This QR code isn't valid">
        We couldn&apos;t find a Taxi DJ ride for this link. Ask your driver to show their QR code
        again.
      </StatusScreen>
    );
  }
  if (phase === "ended") {
    return (
      <StatusScreen icon={<Ban className="size-8" />} title="This Taxi DJ ride has ended.">
        Thanks for riding! Songs can no longer be added to this ride.
      </StatusScreen>
    );
  }
  if (phase === "expired") {
    return (
      <StatusScreen icon={<Clock className="size-8" />} title="This Taxi DJ ride has expired.">
        Ask your driver to start a new ride and show you the new QR code.
      </StatusScreen>
    );
  }
  if (phase === "error") {
    return (
      <StatusScreen
        icon={<WifiOff className="size-8" />}
        title="We can't reach Taxi DJ"
        action={
          <Button className="w-full" onClick={retry}>
            Try again
          </Button>
        }
      >
        Check your internet connection and try again.
      </StatusScreen>
    );
  }
  return <>{children}</>;
}

function StatusScreen({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 py-16 text-center">
      <Logo tone="light" size="lg" stacked showTagline />
      <div className="grid size-16 place-items-center rounded-3xl bg-zinc-100 text-ink">{icon}</div>
      <div>
        <h1 className="text-2xl font-black">{title}</h1>
        <p className="mx-auto mt-2 max-w-xs text-zinc-600">{children}</p>
      </div>
      {action && <div className="w-full max-w-xs">{action}</div>}
    </div>
  );
}

/** Header + tabs shown once a passenger has joined. */
export function PassengerHeader() {
  const { code, used, limit, publicRide } = usePassenger();
  const pathname = usePathname();
  const tabs = [
    { href: `/join/${code}/music`, label: "Add music" },
    { href: `/join/${code}/requests`, label: `My requests (${used}/${limit})` },
  ];
  return (
    <header className="sticky top-0 z-30 -mx-4 bg-white/95 px-4 pb-3 pt-2 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <Logo tone="light" size="sm" />
        <p className="truncate text-sm font-semibold text-zinc-600">🚕 {publicRide?.name}</p>
      </div>
      <nav aria-label="Passenger" className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-zinc-100 p-1">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-11 items-center justify-center rounded-xl text-sm font-bold ${
                active ? "bg-white text-ink shadow-sm" : "text-zinc-600"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
