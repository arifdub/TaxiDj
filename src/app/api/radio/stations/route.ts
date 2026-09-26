import { NextResponse } from "next/server";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { findStations } from "@/lib/radio/service";

// GET /api/radio/stations?lat=&lng=&q=&country=
// Local radio stations (Radio Browser). Country comes from ?country= or the
// visitor's country as detected by Vercel; lat/lng (optional) from the
// driver's GPS for nearby stations.
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim().slice(0, 60) || undefined;
  const lat = Number(sp.get("lat"));
  const lng = Number(sp.get("lng"));
  const hasGeo = sp.has("lat") && sp.has("lng") && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
  const country = (sp.get("country") || req.headers.get("x-vercel-ip-country") || "").toUpperCase() || null;

  if (!rateLimit(`radio:${clientKey(req)}`, 30)) {
    return NextResponse.json({ error: "RATE_LIMITED" }, { status: 429 });
  }
  try {
    const stations = await findStations({
      query: q,
      // Rounded: ~1 km is plenty and keeps the cache shared.
      lat: hasGeo ? Math.round(lat * 100) / 100 : undefined,
      lng: hasGeo ? Math.round(lng * 100) / 100 : undefined,
      countryCode: country,
    });
    return NextResponse.json(
      { stations, country },
      {
        headers: {
          // Answers based on the visitor's detected country mustn't be shared
          // through the CDN with visitors from other countries.
          "Cache-Control": sp.has("country")
            ? "public, s-maxage=600, stale-while-revalidate=3600"
            : "private, max-age=300",
        },
      },
    );
  } catch (err) {
    console.error("Radio search failed", err);
    return NextResponse.json({ error: "UPSTREAM" }, { status: 502 });
  }
}
