import { ImageResponse } from "next/og";
import { TaxiDJMark } from "@/components/Logo";

// Preview image for Google, WhatsApp, Facebook, X, etc.
export const alt = "Taxi DJ – passengers scan a QR code and add songs to the taxi's music queue";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          gap: 64,
          padding: "0 90px",
          background: "#09090C",
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <TaxiDJMark width={300} height={267} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 104, fontWeight: 900, letterSpacing: -3 }}>
            Taxi<span style={{ color: "#FFC800", marginLeft: 24 }}>DJ</span>
          </div>
          <div style={{ fontSize: 44, color: "#A1A1B0", marginTop: 8 }}>Your Ride. Your Music.</div>
          <div style={{ fontSize: 34, marginTop: 36, lineHeight: 1.35, maxWidth: 640 }}>
            Passengers scan a QR code and add songs to the car&apos;s queue. No app download.
          </div>
        </div>
      </div>
    ),
    size,
  );
}
