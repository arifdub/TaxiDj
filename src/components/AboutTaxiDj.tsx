import { Car, ListMusic, QrCode, Search, ShieldCheck, Smartphone } from "lucide-react";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

// Public "what is Taxi DJ" section on the home page. Server-rendered so
// search engines and link previews can read it; signed-in drivers don't see
// it (see HideWhenSignedIn).

const STEPS = [
  {
    icon: QrCode,
    title: "1. The driver starts a ride",
    body: "Tap Start a ride and Taxi DJ shows a QR code and a short join code for this trip.",
  },
  {
    icon: Search,
    title: "2. Passengers add songs",
    body: "Riders scan the QR code with their phone camera. A web page opens – no app, no account. They search for music or paste a YouTube, YouTube Music or Spotify link and tap Add.",
  },
  {
    icon: ListMusic,
    title: "3. The music plays in the car",
    body: "Requests appear live on the driver's phone. The driver plays the queue in Taxi DJ, or sends it to the YouTube app to play through Bluetooth or Apple CarPlay.",
  },
];

const FEATURES = [
  "QR code and join code for every ride – passengers join in seconds",
  "No app download or sign-up for passengers",
  "Music search built for songs, plus YouTube, YouTube Music and Spotify links",
  "Live shared queue: reorder, remove, replay and approve requests",
  "Song limit per passenger (1–50) and optional approval of every request",
  "Built-in player with auto-play, or one tap to play the whole queue in the YouTube app",
  "Big, simple controls designed for use while parked",
  "Ride ends, code stops working – nothing carries over to the next passenger",
  "Works on iPhone and Android; add it to your Home Screen like an app",
];

export const FAQ = [
  {
    q: "What is Taxi DJ?",
    a: "Taxi DJ is a web app that lets passengers choose the music in a taxi or private-hire car. The driver shows a QR code, passengers add songs from their own phones, and the songs play in the car from a shared queue the driver controls.",
  },
  {
    q: "Do passengers need to download an app?",
    a: "No. Passengers scan the QR code with their phone camera and add songs on a web page. There's nothing to install and no account to create.",
  },
  {
    q: "Who is Taxi DJ for?",
    a: "Taxi drivers, Uber, Bolt, Lyft and FREENOW drivers, private-hire and chauffeur services, limousines and party buses – and anyone who wants friends in the car to share the music on a road trip.",
  },
  {
    q: "Where does the music come from?",
    a: "Songs play from YouTube using YouTube's official player and apps. Passengers can search for music or paste YouTube, YouTube Music or Spotify song links. Taxi DJ never downloads or copies music.",
  },
  {
    q: "Does it work with Apple CarPlay and Bluetooth?",
    a: "Yes. The driver can send the whole queue to the YouTube app as a playlist, which plays through the car's Bluetooth or CarPlay. With YouTube Premium it keeps playing with the phone screen locked.",
  },
  {
    q: "Can the driver control what gets played?",
    a: "Yes. The driver can set how many songs each passenger may add, approve requests before they play, skip, reorder or remove songs, and end the ride at any time.",
  },
  {
    q: "Is it safe to use while driving?",
    a: "Taxi DJ is designed to be set up before a trip or while stopped. Passengers do the searching on their own phones, so the driver doesn't need to type anything. Always follow local driving laws.",
  },
];

export function AboutTaxiDj() {
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: SITE_NAME,
      alternateName: "TaxiDJ",
      url: `${SITE_URL}/`,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: SITE_NAME,
      url: `${SITE_URL}/`,
      description: SITE_DESCRIPTION,
      applicationCategory: "MultimediaApplication",
      applicationSubCategory: "Music",
      operatingSystem: "Any (web browser on iPhone, Android or computer)",
      browserRequirements: "Requires a modern web browser with JavaScript.",
      image: `${SITE_URL}/opengraph-image`,
      featureList: FEATURES,
      audience: { "@type": "Audience", audienceType: "Taxi, rideshare and private-hire drivers and their passengers" },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ.map(({ q, a }) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  ];

  return (
    <section aria-labelledby="about-taxi-dj" className="border-t border-line bg-night">
      <script
        type="application/ld+json"
        // Structured data for search engines (static text from this file).
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <div className="mx-auto max-w-2xl px-4 py-14 safe-bottom">
        <h1 id="about-taxi-dj" className="text-3xl font-black leading-tight tracking-tight sm:text-4xl">
          Let passengers choose the music in your <span className="text-taxi">taxi</span>
        </h1>
        <p className="mt-4 text-lg text-mist">
          Taxi DJ turns your car into a jukebox. Passengers scan a QR code and add songs to your car&apos;s
          music queue from their own phones – no app download. You stay in control of what plays.
        </p>

        <h2 className="mt-12 text-xl font-black">How Taxi DJ works</h2>
        <ol className="mt-4 space-y-3">
          {STEPS.map(({ icon: Icon, title, body }) => (
            <li key={title} className="flex gap-4 rounded-3xl border border-line bg-night-2 p-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-taxi text-ink">
                <Icon className="size-6" aria-hidden />
              </span>
              <div>
                <h3 className="font-bold">{title}</h3>
                <p className="mt-0.5 text-sm text-mist">{body}</p>
              </div>
            </li>
          ))}
        </ol>

        <h2 className="mt-12 text-xl font-black">Made for taxi and rideshare drivers</h2>
        <p className="mt-2 text-mist">
          For taxi drivers, Uber, Bolt, Lyft and FREENOW drivers, private hire, chauffeurs, limousines and
          party buses – or friends sharing the music on a road trip. Happier passengers, better ratings,
          and no more handing over your phone or arguing over the aux cable.
        </p>
        <ul className="mt-5 grid gap-2 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <li key={f} className="flex gap-2 rounded-2xl bg-night-2 p-3 text-sm">
              <ShieldCheck className="mt-0.5 size-4 shrink-0 text-go" aria-hidden />
              {f}
            </li>
          ))}
        </ul>

        <div className="mt-8 grid grid-cols-3 gap-2 text-center text-xs font-bold text-mist">
          <p className="rounded-2xl border border-line p-3">
            <Smartphone className="mx-auto mb-1 size-6 text-taxi" aria-hidden />
            iPhone &amp; Android
          </p>
          <p className="rounded-2xl border border-line p-3">
            <QrCode className="mx-auto mb-1 size-6 text-taxi" aria-hidden />
            Scan to join
          </p>
          <p className="rounded-2xl border border-line p-3">
            <Car className="mx-auto mb-1 size-6 text-taxi" aria-hidden />
            CarPlay &amp; Bluetooth
          </p>
        </div>

        <h2 className="mt-12 text-xl font-black">Frequently asked questions</h2>
        <div className="mt-4 space-y-2">
          {FAQ.map(({ q, a }) => (
            <details key={q} className="group rounded-2xl border border-line bg-night-2 p-4 open:bg-night-3">
              <summary className="cursor-pointer list-none font-bold marker:hidden">
                {q}
              </summary>
              <p className="mt-2 text-sm text-mist">{a}</p>
            </details>
          ))}
        </div>

        <a
          href="#top"
          className="mt-10 flex min-h-14 items-center justify-center rounded-2xl bg-taxi text-lg font-black text-ink hover:bg-taxi-light"
        >
          Start using Taxi DJ
        </a>
        <p className="mt-8 text-center text-xs text-mist">
          Taxi DJ is an independent app. It isn&apos;t affiliated with or endorsed by YouTube, Google, Spotify,
          Apple, Uber, Bolt, Lyft or FREENOW.
        </p>
      </div>
    </section>
  );
}
