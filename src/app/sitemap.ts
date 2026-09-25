import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Public pages for search engines. Ride and passenger pages are private.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/driver/help`, changeFrequency: "monthly", priority: 0.6 },
  ];
}
