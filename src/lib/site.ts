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

export const SITE_TITLE = "Taxi DJ – Let Passengers Choose the Music in Your Taxi";

export const SITE_DESCRIPTION =
  "Taxi DJ is a web app for taxi, Uber, Bolt and private-hire drivers. Passengers scan a QR code and add songs to the car's music queue from their phone – no app download. The driver controls the queue and plays it through YouTube, Bluetooth or CarPlay.";

export const SITE_KEYWORDS = [
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
