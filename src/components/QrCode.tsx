"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Skeleton } from "@/components/ui";

/** Renders a high-contrast QR code for `value` as an accessible image. */
export function QrCode({ value, className = "size-64" }: { value: string; className?: string }) {
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(value, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      color: { dark: "#09090c", light: "#ffffff" },
    }).then((s) => {
      if (!cancelled) setSvg(s);
    });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (!svg) return <Skeleton tone="light" className={className} />;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`}
      alt={`QR code linking to ${value}`}
      className={`${className} [image-rendering:pixelated]`}
    />
  );
}
