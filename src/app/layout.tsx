import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { InstallPrompt } from "@/components/InstallPrompt";
import { OfflineBanner } from "@/components/OfflineBanner";
import { SITE_DESCRIPTION, SITE_KEYWORDS, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_TITLE, template: "%s · Taxi DJ" },
  description: SITE_DESCRIPTION,
  keywords: SITE_KEYWORDS,
  applicationName: SITE_NAME,
  category: "music",
  robots: { index: true, follow: true },
  // Google Search Console "HTML tag" verification (optional).
  verification: process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : undefined,
  appleWebApp: { capable: true, title: "Taxi DJ", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  openGraph: {
    title: SITE_TITLE,
    description: "Passengers scan a QR code and add songs to your car's music queue. No app download.",
    url: "/",
    siteName: SITE_NAME,
    type: "website",
    locale: "en_IE",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: "Passengers scan a QR code and add songs to your car's music queue. No app download.",
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
        <InstallPrompt />
      </body>
    </html>
  );
}
