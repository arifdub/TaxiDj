import type { Metadata } from "next";
import { AboutTaxiDj } from "@/components/AboutTaxiDj";
import { DriverHome } from "@/components/driver/DriverHome";
import { HideWhenSignedIn } from "@/components/HideWhenSignedIn";

export const metadata: Metadata = { alternates: { canonical: "/" } };

// Home: the driver app on top; below it, a public description of Taxi DJ for
// new visitors and search engines (hidden once a driver is signed in).
export default function HomePage() {
  return (
    <>
      <div id="top" />
      <DriverHome />
      <HideWhenSignedIn>
        <AboutTaxiDj />
      </HideWhenSignedIn>
    </>
  );
}
