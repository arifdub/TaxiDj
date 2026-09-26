import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Add your music",
  description: "Scan to add songs to this taxi's music queue. No app needed.",
  robots: { index: false },
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function CarCodeLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-white text-ink">{children}</div>;
}
