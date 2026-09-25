import type { Metadata } from "next";
import { DriverShell } from "@/components/driver/DriverShell";

export const metadata: Metadata = {
  title: "How Taxi DJ works – Help for drivers",
  description:
    "Step-by-step guide for drivers: start a ride, show the QR code, let passengers add songs, manage the queue and play music through YouTube, Bluetooth or CarPlay.",
  alternates: { canonical: "/driver/help" },
};

const steps = [
  ["Start a ride", "Tap START A RIDE. Taxi DJ creates a unique join code and QR code."],
  ["Show the QR code", "Passengers scan it with their phone camera or visit the link and enter the code. No app install needed."],
  ["Passengers add songs", "They search for music or paste a YouTube, YouTube Music or Spotify link. Each passenger can add a limited number of songs."],
  ["Manage the queue", "New requests appear instantly. Play, reorder, approve or remove songs with large, simple controls."],
  ["Play the music", "Play the queue in Taxi DJ's built-in player, or tap Play all in YouTube playlist to play it in the YouTube app through Bluetooth, CarPlay and your car speakers."],
  ["End the ride", "When the trip is over, tap END RIDE. The QR code stops working and passengers can't add more songs."],
];

export default function HelpPage() {
  return (
    <DriverShell title="Help" backHref="/">
      <div className="space-y-6 pb-10">
        <ol className="space-y-3">
          {steps.map(([title, body], i) => (
            <li key={title} className="flex gap-4 rounded-3xl border border-line bg-night-2 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-taxi text-lg font-black text-ink">
                {i + 1}
              </span>
              <div>
                <h2 className="font-bold">{title}</h2>
                <p className="text-sm text-mist">{body}</p>
              </div>
            </li>
          ))}
        </ol>

        <section className="rounded-3xl border border-line bg-night-2 p-4">
          <h2 className="font-bold text-taxi">Drive safely</h2>
          <p className="mt-1 text-sm text-mist">
            Only use Taxi DJ when it is safe and legal to do so. Set up the queue before driving or
            while stopped, and use your car&apos;s controls for volume.
          </p>
        </section>

        <section className="rounded-3xl border border-line bg-night-2 p-4">
          <h2 className="font-bold text-taxi">About playback &amp; CarPlay</h2>
          <p className="mt-1 text-sm text-mist">
            Taxi DJ manages the queue; the music itself plays in the official YouTube app. Taxi DJ
            never downloads or re-streams YouTube content. A dedicated CarPlay experience is planned
            for a future native iOS app.
          </p>
        </section>
      </div>
    </DriverShell>
  );
}
