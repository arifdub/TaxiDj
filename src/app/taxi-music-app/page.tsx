import type { Metadata } from "next";
import { GuidePage, type GuideFaq } from "@/components/guides/GuidePage";

const TITLE = "Taxi DJ: the music app for taxi and Uber drivers";
const DESCRIPTION =
  "Taxi DJ is a music app for taxi, Uber, Bolt and private-hire drivers. Passengers scan a QR code and request songs from their phones; you get notified, control the queue and play it through YouTube, Bluetooth or CarPlay. Local radio when the queue is empty.";

export const metadata: Metadata = {
  title: { absolute: `${TITLE}` },
  description: DESCRIPTION,
  alternates: { canonical: "/taxi-music-app" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/taxi-music-app", type: "article" },
};

const FAQ: GuideFaq[] = [
  {
    q: "What does Taxi DJ do for drivers?",
    a: "It turns your car into a jukebox your passengers control from their phones, while you stay in charge: you choose how many songs each passenger can add, approve or remove songs, and end the ride when the trip is over.",
  },
  {
    q: "How do passengers join?",
    a: "Start a ride in Taxi DJ and show the QR code on your phone, or print a permanent QR card for your car once. Passengers scan it with their camera – no app or account needed.",
  },
  {
    q: "Will I know when someone adds a song?",
    a: "Yes. Taxi DJ shows a 'New song request' card in the app and can send a notification to your phone, even when the app is closed. If nothing is playing, the new song can start by itself.",
  },
  {
    q: "How does the music play in the car?",
    a: "Play the queue in Taxi DJ's built-in player, or send the whole queue to the YouTube app with one tap to play it through Bluetooth or Apple CarPlay.",
  },
  {
    q: "What plays when no one has added a song?",
    a: "Taxi DJ has local radio built in: pick a station near you (or a favourite) and it plays until a passenger's song starts, then comes back when the queue is finished.",
  },
  {
    q: "Is it safe to use while driving?",
    a: "Taxi DJ is designed to be set up before a trip or while stopped, with big simple controls. Passengers do the searching on their own phones. Always follow local driving laws.",
  },
];

export default function TaxiMusicAppPage() {
  return (
    <GuidePage
      path="/taxi-music-app"
      title={TITLE}
      intro="Happier passengers, better ratings, and no more handing over your phone or arguing over the aux cable. Taxi DJ lets riders choose the music – and keeps you in control."
      faq={FAQ}
    >
      <h2>How it works</h2>
      <ol>
        <li>
          <strong>Start a ride</strong> in Taxi DJ. You get a QR code and a short join code for that trip.
        </li>
        <li>
          <strong>Passengers scan and add songs</strong> from their own phones – search, or paste a YouTube or Spotify
          link.
        </li>
        <li>
          <strong>You get notified</strong> and the songs play from a shared queue through YouTube, Bluetooth or
          CarPlay.
        </li>
        <li>
          <strong>End the ride</strong> when the trip is over. The code stops working and the next ride starts fresh.
        </li>
      </ol>

      <h2>Made for drivers</h2>
      <ul>
        <li>Big, simple controls designed for use while parked.</li>
        <li>Song limit per passenger (1–50) and optional approval of every song.</li>
        <li>Notifications and an in-app alert when a passenger adds a song; auto-play when nothing is playing.</li>
        <li>A permanent QR card for the back of your seats – print it once, it always opens the current ride.</li>
        <li>Remove anyone who isn&apos;t in the car; get a new card code any time.</li>
        <li>Local radio stations (with favourites) for when the queue is empty.</li>
        <li>Works on iPhone and Android – add it to your Home Screen like an app.</li>
      </ul>

      <h2>For every kind of driver</h2>
      <p>
        Taxi drivers, Uber, Bolt, Lyft and FREENOW drivers, private hire and chauffeurs, limousines and party buses – and
        anyone who wants friends in the car to share the music on a road trip.
      </p>

      <h2>Getting started</h2>
      <p>
        Open Taxi DJ, sign in (or continue as a guest), and tap <strong>Start a ride</strong>. Add Taxi DJ to your Home
        Screen so it opens like an app, and turn on notifications in Settings.
      </p>
    </GuidePage>
  );
}
