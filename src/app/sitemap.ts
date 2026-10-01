import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Public pages for search engines. Ride and passenger pages are private.
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/play-music-in-a-taxi`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/taxi-music-app`, lastModified, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/join`, lastModified, changeFrequency: "yearly", priority: 0.5 },
    { url: `${SITE_URL}/driver/help`, lastModified, changeFrequency: "monthly", priority: 0.6 },
  ];
}
