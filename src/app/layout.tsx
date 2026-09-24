import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { OfflineBanner } from "@/components/OfflineBanner";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://taxidj.com";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Taxi DJ — Your Ride. Your Music.", template: "%s · Taxi DJ" },
  description:
    "Taxi DJ lets passengers scan a QR code and add YouTube songs to the driver's music queue. No app install needed.",
  applicationName: "Taxi DJ",
  appleWebApp: { capable: true, title: "Taxi DJ", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  openGraph: {
    title: "Taxi DJ — Your Ride. Your Music.",
    description: "Scan. Search. Add songs. Enjoy the ride.",
    siteName: "Taxi DJ",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09090C",
  colorScheme: "dark light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="bg-ink text-white">
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}
