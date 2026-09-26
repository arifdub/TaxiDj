"use client";

import Link from "next/link";
import { Copy, Printer, Share2 } from "lucide-react";
import { useDriverRide } from "@/components/driver/RideContext";
import { QrCode } from "@/components/QrCode";
import { Button } from "@/components/ui";
import { useShare } from "@/hooks/useShare";
import { displayUrl, joinUrl } from "@/lib/format";

/** Full-size QR code for passengers to scan. */
export default function RideQrPage() {
  const { ride, confirmEnd } = useDriverRide();
  const url = joinUrl(ride.join_code);
  const { share, copy, copied } = useShare();

  return (
    <div className="flex flex-col items-center pb-6 text-center">
      <p className="mt-2 flex items-center gap-2 text-2xl font-black uppercase tracking-wide">
        <span className="size-3 rounded-full bg-go" aria-hidden /> Ride is active
      </p>

      <div className="mt-5 w-full max-w-sm rounded-[2rem] bg-white p-5 text-ink shadow-[0_20px_60px_-20px_rgba(255,200,0,0.45)]">
        <p className="text-lg font-bold">Scan to join my music queue</p>
        <QrCode value={url} className="mx-auto mt-3 aspect-square w-full max-w-[18rem]" />
        <p className="mt-3 text-lg">
          Join at <span className="font-bold text-queue">{displayUrl(url).replace(/\/join\/.*/, "")}</span>
        </p>
        <p className="text-2xl font-bold">
          Code: <span className="font-mono font-black tracking-widest text-queue">{ride.join_code}</span>
        </p>
        <p className="mt-1 break-all text-sm text-zinc-500">{displayUrl(url)}</p>
      </div>

      <div className="mt-6 grid w-full max-w-sm grid-cols-2 gap-3">
        <Button variant="primary" onClick={() => share(url)}>
          <Share2 className="size-5" aria-hidden /> Share link
        </Button>
        <Button variant="dark" onClick={() => copy(url)}>
          <Copy className="size-5" aria-hidden /> {copied ? "Copied!" : "Copy link"}
        </Button>
        <Link
          href="/driver/car-qr"
          className="col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-line text-sm font-bold text-mist hover:text-white"
        >
          <Printer className="size-4" aria-hidden /> Print a permanent QR card for your car
        </Link>
        <Button variant="danger" className="col-span-2" onClick={confirmEnd}>
          END RIDE
        </Button>
      </div>
    </div>
  );
}
