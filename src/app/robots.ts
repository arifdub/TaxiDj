import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// Public pages can be indexed. Ride, account and passenger pages are private
// (and change every ride), so crawlers are kept out of them.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/driver/help"],
      disallow: [
        "/api/",
        "/join/",
        "/c/",
        "/driver/ride/",
        "/driver/history",
        "/driver/settings",
        "/reset-password",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
