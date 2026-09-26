"use client";

import { useEffect, useState } from "react";
import { Copy, Printer, RefreshCw, Share2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DriverGate } from "@/components/driver/DriverGate";
import { DriverShell } from "@/components/driver/DriverShell";
import { Logo } from "@/components/Logo";
import { QrCode } from "@/components/QrCode";
import { Button, Notice, Skeleton } from "@/components/ui";
import { useShare } from "@/hooks/useShare";
import { getCarCode } from "@/lib/api";
import { friendlyError } from "@/lib/errors";
import { carUrl, displayUrl } from "@/lib/format";

/** Permanent QR code to print and keep in the car. */
export default function CarQrPage() {
  return <DriverGate>{() => <CarQr />}</DriverGate>;
}

function CarQr() {
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { share, copy, copied } = useShare();

  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    getCarCode()
      .then((c) => {
        setCode(c);
        setError(null);
      })
      .catch((err) => setError(friendlyError(err)));
  }, [attempt]);

  const url = code ? carUrl(code) : null;

  async function reset() {
    setResetting(true);
    try {
      setCode(await getCarCode(true));
      setConfirmReset(false);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setResetting(false);
    }
  }

  return (
    <DriverShell title="Car QR card" backHref="/">
      <div className="space-y-5 pb-10">
        <p className="text-mist print:hidden">
          Print this QR code once and keep it in the car (on the back of a seat or the dashboard). It always opens
          the ride you have running, so you don&apos;t need to show your phone.
        </p>

        {error && (
          <Notice tone="error" className="print:hidden">
            {error}
            <button type="button" onClick={() => setAttempt((n) => n + 1)} className="ml-2 font-bold underline">
              Try again
            </button>
          </Notice>
        )}

        {/* The printable card. */}
        <div
          id="car-qr-card"
          className="mx-auto w-full max-w-sm rounded-[2rem] bg-white p-6 text-center text-ink shadow-[0_20px_60px_-20px_rgba(255,200,0,0.45)] print:max-w-[10cm] print:border-2 print:border-zinc-300 print:shadow-none"
        >
          <div className="flex justify-center">
            <Logo tone="light" size="lg" />
          </div>
          <p className="mt-3 text-2xl font-black leading-tight">Scan to add your music</p>
          <p className="text-zinc-600">Choose the songs for this ride · No app needed</p>
          {url ? (
            <QrCode value={url} className="mx-auto mt-4 aspect-square w-full max-w-[16rem]" />
          ) : (
            <Skeleton tone="light" className="mx-auto mt-4 aspect-square w-full max-w-[16rem]" />
          )}
          <p className="mt-3 break-all font-mono text-sm font-bold text-zinc-600">{url ? displayUrl(url) : " "}</p>
        </div>

        <div className="grid grid-cols-2 gap-3 print:hidden">
          <Button className="col-span-2" disabled={!url} onClick={() => window.print()}>
            <Printer className="size-5" aria-hidden /> Print card
          </Button>
          <Button variant="dark" disabled={!url} onClick={() => url && share(url)}>
            <Share2 className="size-5" aria-hidden /> Share
          </Button>
          <Button variant="dark" disabled={!url} onClick={() => url && copy(url)}>
            <Copy className="size-5" aria-hidden /> {copied ? "Copied!" : "Copy link"}
          </Button>
        </div>

        <section className="space-y-3 rounded-3xl border border-line bg-night-2 p-4 text-sm print:hidden">
          <h2 className="font-black text-taxi">How it works</h2>
          <ul className="list-disc space-y-2 pl-5 text-mist">
            <li>
              <strong className="text-white">Ride running:</strong> scanning opens that ride, and passengers add songs as
              usual.
            </li>
            <li>
              <strong className="text-white">No ride running:</strong> passengers see &ldquo;No ride is running right
              now&rdquo;. Nobody can add songs.
            </li>
            <li>
              <strong className="text-white">Ride ended:</strong> nobody can add songs to it any more, even with the
              link still open. Every new ride starts with an empty queue and no passengers.
            </li>
            <li>
              <strong className="text-white">Someone who isn&apos;t in the car?</strong> Anyone with a photo of the card
              could join the ride you&apos;re on. Open the ride, find them under <em>Passengers</em> and tap Remove:
              their waiting songs go and they can&apos;t add or rejoin. For more control, turn on approving each song
              in Settings.
            </li>
            <li>
              <strong className="text-white">Card lost or shared online?</strong> Get a new code. The old card stops
              working straight away; print the new one.
            </li>
          </ul>
          <Button variant="dark" size="md" className="w-full" disabled={!code} onClick={() => setConfirmReset(true)}>
            <RefreshCw className="size-4" aria-hidden /> Get a new code
          </Button>
        </section>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Get a new car QR code?"
        body="Your printed card will stop working straight away. You'll need to print the new one."
        confirmLabel="Get new code"
        onConfirm={reset}
        onCancel={() => setConfirmReset(false)}
        loading={resetting}
      />
    </DriverShell>
  );
}
