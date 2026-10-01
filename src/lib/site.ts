// Public site address and search-engine text, shared by metadata, the
// sitemap, robots.txt and structured data.

/**
 * The site's canonical address, e.g. https://taxidj.app.
 * Set NEXT_PUBLIC_SITE_URL in Vercel; otherwise Vercel's production domain
 * is used.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "https://taxidj.app")
).replace(/\/+$/, "");

export const SITE_NAME = "Taxi DJ";

export const SITE_TITLE = "Taxi DJ – Play Your Own Music in a Taxi or Uber";

export const SITE_DESCRIPTION =
  "Taxi DJ lets passengers play their own music in a taxi, Uber, Bolt or private-hire car. Scan the QR code, search for a song and add it to the car's music queue from your phone – no app download. Drivers control the queue, get notified of new songs, and play it through YouTube, Bluetooth or CarPlay.";

export const SITE_KEYWORDS = [
  "Taxi DJ",
  "taxi DJ app",
  "play music in taxi",
  "play my music in an Uber",
  "request songs in a taxi",
  "taxi music app",
  "passenger song requests",
  "let passengers choose music",
  "rideshare music app",
  "Uber driver music",
  "car jukebox",
  "taxi jukebox",
  "QR code song request",
  "shared music queue",
  "private hire driver app",
  "CarPlay music queue",
  "YouTube music queue",
];
