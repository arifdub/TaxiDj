import type { Metadata } from "next";
import { GuidePage, type GuideFaq } from "@/components/guides/GuidePage";
import { SITE_URL } from "@/lib/site";

const JOIN_URL = `${new URL(SITE_URL).host}/join`;

const TITLE = "How to play your own music in a taxi or Uber";
const DESCRIPTION =
  "Want your own music in a taxi, Uber or Bolt? With Taxi DJ you scan the QR code in the car, search for a song and add it to the car's music queue from your phone – no app download, no aux cable, no Bluetooth pairing.";

export const metadata: Metadata = {
  title: { absolute: `${TITLE} | Taxi DJ` },
  description: DESCRIPTION,
  alternates: { canonical: "/play-music-in-a-taxi" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: "/play-music-in-a-taxi", type: "article" },
};

const FAQ: GuideFaq[] = [
  {
    q: "Can I play my own music in a taxi?",
    a: "Yes, if your driver uses Taxi DJ. Scan the QR code in the car (or ask the driver for the join code), search for a song and tap Add. It goes into the car's music queue and plays through the car speakers.",
  },
  {
    q: "Do I need to download an app or pair Bluetooth?",
    a: "No. Taxi DJ opens as a web page in your phone's browser. There's nothing to install, no account to create, and no Bluetooth pairing or aux cable – the driver's phone plays the music.",
  },
  {
    q: "Can I use Spotify or YouTube Music?",
    a: "You can search for any song in Taxi DJ, or paste a song link from YouTube, YouTube Music or Spotify. The song plays from YouTube in the car.",
  },
  {
    q: "How many songs can I add?",
    a: "The driver decides – usually between 3 and 10 songs per passenger, and up to 50. You can see how many you've used and remove your own songs before they play.",
  },
  {
    q: "What if the music isn't on when I scan the code?",
    a: "If the driver hasn't started a Taxi DJ ride yet, the page says so and shows a button to ask the driver to turn on the music. The page opens the queue by itself as soon as the ride starts.",
  },
  {
    q: "Does it work in an Uber, Bolt or Lyft?",
    a: "Taxi DJ works in any car whose driver uses it – taxis, Uber, Bolt, Lyft, FREENOW and private-hire cars. Look for a Taxi DJ QR code in the car or ask your driver.",
  },
];

export default function PlayMusicInATaxiPage() {
  return (
    <GuidePage
      path="/play-music-in-a-taxi"
      title={TITLE}
      intro="Long ride, and the radio isn't your thing? With Taxi DJ you can choose the music in the taxi from your own phone – no app, no account, no cables."
      faq={FAQ}
    >
      <h2>Play your music in 3 steps</h2>
      <ol>
        <li>
          <strong>Scan the QR code</strong> in the car with your phone camera (it may be on the back of a seat or on the
          driver&apos;s phone). Or go to <strong>{JOIN_URL}</strong> and type the code shown in the car.
        </li>
        <li>
          <strong>Search for a song</strong> – any song or artist – or paste a YouTube, YouTube Music or Spotify link.
        </li>
        <li>
          <strong>Tap Add.</strong> Your song joins the car&apos;s music queue and plays through the car speakers. You can
          see what&apos;s playing and what&apos;s next on your phone.
        </li>
      </ol>

      <h2>Why passengers like it</h2>
      <ul>
        <li>No app to download and no sign-up: it&apos;s a web page.</li>
        <li>No handing over your phone, no aux cable, no Bluetooth pairing.</li>
        <li>Friends in the car can all add songs from their own phones.</li>
        <li>Works on iPhone and Android.</li>
      </ul>

      <h2>Is the music on?</h2>
      <p>
        If you scan the code before the driver has started a ride, Taxi DJ tells you, and you can tap a button to ask
        the driver to turn the music on – no need to ask out loud. As soon as the ride starts, the page opens the queue
        for you.
      </p>

      <h2>Your driver doesn&apos;t use Taxi DJ yet?</h2>
      <p>
        Tell them about it: Taxi DJ is made for taxi, Uber, Bolt and private-hire drivers, and it takes a minute to set
        up. Drivers keep control of what plays and how many songs each passenger can add.
      </p>
    </GuidePage>
  );
}
