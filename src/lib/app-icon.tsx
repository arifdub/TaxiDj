import { ImageResponse } from "next/og";
import { TaxiDJMark } from "@/components/Logo";

/** Renders the Taxi DJ app icon (dark tile + taxi/music mark) as a PNG. */
export function appIcon(size: number, { maskable = false } = {}) {
  // Maskable icons need the artwork inside the central 80% safe zone.
  const art = Math.round(size * (maskable ? 0.58 : 0.72));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#09090C",
        }}
      >
        <TaxiDJMark width={art} height={Math.round((art * 64) / 72)} />
      </div>
    ),
    { width: size, height: size },
  );
}
