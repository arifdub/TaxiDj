"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import { Disc3, House, ListMusic, QrCode, Users, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DriverGate } from "@/components/driver/DriverGate";
import { DriverRideProvider } from "@/components/driver/RideContext";
import { NewRequestToast } from "@/components/driver/NewRequestToast";
import { RadioMiniBar } from "@/components/driver/RadioCard";
import { RadioProvider } from "@/components/driver/RadioProvider";
import { PlayerProvider } from "@/components/driver/PlayerProvider";
import { RideSummary } from "@/components/driver/RideSummary";
import { DriverShell } from "@/components/driver/DriverShell";
import { ButtonLink, EmptyState, Skeleton, SongSkeleton } from "@/components/ui";
import { useRide } from "@/hooks/useRide";
import { endRide } from "@/lib/api";
import { friendlyError } from "@/lib/errors";
import { isRideOpen } from "@/lib/ride";
import type { Passenger, QueueItem, Ride } from "@/lib/types";

export default function DriverRideLayout({ children }: { children: ReactNode }) {
  return <DriverGate>{() => <RideFrame>{children}</RideFrame>}</DriverGate>;
}

function RideFrame({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [incoming, setIncoming] = useState<QueueItem[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [ending, setEnding] = useState(false);
  const [endError, setEndError] = useState<string | null>(null);

  // Songs the driver added themselves don't need a "new request" alert.
  const onNewRequests = useCallback(
    (items: QueueItem[], { ride: r, passengers }: { ride: Ride; passengers: Passenger[] }) => {
      const driverRows = new Set(passengers.filter((p) => p.session_identifier === r.driver_id).map((p) => p.id));
      const fromRiders = items.filter((i) => !driverRows.has(i.passenger_id));
      if (fromRiders.length) setIncoming((prev) => [...prev, ...fromRiders].slice(-3));
    },
    [],
  );
  const data = useRide(id, { withPassengers: true, onNewRequests });
  const confirmEnd = useCallback(() => setConfirming(true), []);

  if (data.notFound) {
    return (
      <DriverShell backHref="/" title="Taxi DJ">
        <EmptyState icon={<X className="size-7" />} title="Ride not found" action={<ButtonLink href="/">Back to home</ButtonLink>}>
          This ride doesn&apos;t exist or belongs to another driver.
        </EmptyState>
      </DriverShell>
    );
  }

  if (!data.ride) {
    return (
      <DriverShell backHref="/" title="Taxi DJ">
        <div className="space-y-6 pt-4">
          <Skeleton className="aspect-square w-full" />
          <SongSkeleton />
        </div>
      </DriverShell>
    );
  }

  const ride = data.ride;

  if (!isRideOpen(ride)) {
    return <RideSummary ride={ride} queue={data.queue} passengers={data.passengers} />;
  }

  async function doEnd() {
    setEnding(true);
    setEndError(null);
    try {
      await endRide(ride.id);
      setConfirming(false);
      router.push("/");
    } catch (err) {
      setEndError(friendlyError(err));
    } finally {
      setEnding(false);
    }
  }

  return (
    <DriverRideProvider data={{ ...data, ride }} confirmEnd={confirmEnd}>
      <div className="min-h-dvh bg-ink pb-28 text-white">
        <div className="mx-auto w-full max-w-lg px-4 safe-top md:max-w-3xl">
          <RideHeader ride={ride} passengers={data.passengers.filter((p) => p.session_identifier !== ride.driver_id && !p.removed_at).length} live={data.live} />
          <PlayerProvider>
            <RadioProvider>
              {children}
              <RadioMiniBar />
            </RadioProvider>
          </PlayerProvider>
        </div>
      </div>

      <NewRequestToast
        items={incoming}
        rideId={ride.id}
        dismiss={(rid) => setIncoming((prev) => prev.filter((i) => i.id !== rid))}
      />
      <RideTabs rideId={ride.id} />

      <ConfirmDialog
        open={confirming}
        title="End this ride?"
        body={endError ?? "Passengers will no longer be able to add songs."}
        confirmLabel="End Ride"
        onCancel={() => setConfirming(false)}
        onConfirm={doEnd}
        loading={ending}
      />
    </DriverRideProvider>
  );
}

function RideHeader({ ride, passengers, live }: { ride: Ride; passengers: number; live: boolean }) {
  return (
    <header className="flex min-h-16 items-center gap-3 py-2">
      <Link
        href="/"
        aria-label="Taxi DJ home"
        className="-ml-2 grid size-11 place-items-center rounded-full text-mist hover:bg-white/5 hover:text-white"
      >
        <House className="size-6" aria-hidden />
      </Link>
      <div className="flex-1">
        <p className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-go">
          <span className="size-2.5 rounded-full bg-go" aria-hidden /> Ride active
        </p>
        <p className="text-xs text-mist" aria-live="polite">
          {live ? "Live updates on" : "Connecting…"}
        </p>
      </div>
      <div className="flex items-center gap-1.5 rounded-full bg-night-2 px-3 py-2 text-sm font-bold" title="Passengers">
        <Users className="size-4 text-taxi" aria-hidden />
        <span className="sr-only">Passengers:</span> {passengers}
      </div>
      <div className="rounded-full bg-taxi px-3 py-2 font-mono text-sm font-black tracking-widest text-ink">
        <span className="sr-only">Join code </span>
        {ride.join_code}
      </div>
    </header>
  );
}

function RideTabs({ rideId }: { rideId: string }) {
  const pathname = usePathname();
  const base = `/driver/ride/${rideId}`;
  const tabs = [
    { href: base, label: "Ride", icon: House },
    { href: `${base}/queue`, label: "Queue", icon: ListMusic },
    { href: `${base}/player`, label: "Player", icon: Disc3 },
    { href: `${base}/qr`, label: "QR Code", icon: QrCode },
  ];
  return (
    <nav
      aria-label="Ride navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-night/95 backdrop-blur safe-bottom"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-4 px-2 pt-2 md:max-w-3xl">
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-bold ${
                  active ? "text-taxi" : "text-mist hover:text-white"
                }`}
              >
                <Icon className="size-6" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
