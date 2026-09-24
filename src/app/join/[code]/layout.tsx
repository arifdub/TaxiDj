import type { Metadata, Viewport } from "next";
import { PassengerFrame } from "@/components/passenger/PassengerFrame";

export const metadata: Metadata = {
  title: "Join the ride",
  description: "Add your music to this Taxi DJ ride. No app needed.",
  robots: { index: false },
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default async function JoinLayout({ children, params }: LayoutProps<"/join/[code]">) {
  const { code } = await params;
  return <PassengerFrame code={code}>{children}</PassengerFrame>;
}
