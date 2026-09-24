import type { SVGProps } from "react";

/**
 * The Taxi DJ mark: a front-facing taxi with a music note.
 * Pure SVG (no external assets) so it is also used for the PWA/app icons.
 */
export function TaxiDJMark({
  noteColor = "#FFC800",
  ...props
}: SVGProps<SVGSVGElement> & { noteColor?: string }) {
  return (
    <svg viewBox="0 0 72 64" fill="none" aria-hidden="true" {...props}>
      {/* music note */}
      <path
        d="M58 3.5v15.2a4.6 4.6 0 1 1-2.6-4.1V6.8l8.6-2.6v4.6L58 10.5"
        fill={noteColor}
      />
      {/* roof sign */}
      <rect x="25" y="9" width="16" height="6.5" rx="2" fill="#FFC800" />
      <rect x="28" y="11.2" width="10" height="2" rx="1" fill="#09090C" />
      {/* cabin */}
      <path d="M17 32 22.4 19.4A4 4 0 0 1 26.1 17h13.8a4 4 0 0 1 3.7 2.4L49 32Z" fill="#FFC800" />
      <path d="M21.6 30.5 25.4 21.6a1.8 1.8 0 0 1 1.7-1.1h11.8c.7 0 1.4.4 1.7 1.1l3.8 8.9Z" fill="#09090C" />
      {/* body */}
      <rect x="8" y="29" width="50" height="19" rx="6" fill="#FFC800" />
      {/* headlights */}
      <circle cx="17" cy="38" r="4.2" fill="#09090C" />
      <circle cx="17" cy="38" r="2.2" fill="#FFF7D1" />
      <circle cx="49" cy="38" r="4.2" fill="#09090C" />
      <circle cx="49" cy="38" r="2.2" fill="#FFF7D1" />
      {/* grille */}
      <rect x="25" y="36" width="16" height="4.5" rx="2.25" fill="#09090C" />
      {/* checker stripe */}
      <path d="M8 43.5h50v1.5a3 3 0 0 1-3 3H11a3 3 0 0 1-3-3Z" fill="#09090C" opacity=".85" />
      {/* wheels */}
      <rect x="12" y="46" width="9" height="9" rx="2.5" fill="#09090C" />
      <rect x="45" y="46" width="9" height="9" rx="2.5" fill="#09090C" />
    </svg>
  );
}

export function Logo({
  size = "md",
  tone = "dark",
  showTagline = false,
  stacked = false,
}: {
  size?: "sm" | "md" | "lg" | "xl";
  /** "dark" = on a dark background (white text); "light" = on light background. */
  tone?: "dark" | "light";
  showTagline?: boolean;
  stacked?: boolean;
}) {
  const mark = { sm: "h-7 w-8", md: "h-9 w-10", lg: "h-16 w-[4.5rem]", xl: "h-24 w-28" }[size];
  const text = { sm: "text-lg", md: "text-2xl", lg: "text-4xl", xl: "text-5xl" }[size];
  const tag = { sm: "text-[11px]", md: "text-xs", lg: "text-sm", xl: "text-base" }[size];
  const taxiColor = tone === "dark" ? "text-white" : "text-ink";

  return (
    <div
      className={`flex ${stacked ? "flex-col items-center text-center gap-2" : "items-center gap-2.5"}`}
    >
      <TaxiDJMark className={`${mark} shrink-0`} />
      <div className={stacked ? "" : "leading-none"}>
        <div className={`font-black tracking-tight leading-none ${text}`}>
          <span className={taxiColor}>Taxi</span> <span className={tone === "dark" ? "text-taxi" : "text-taxi-dark"}>DJ</span>
        </div>
        {showTagline && (
          <p
            className={`${tag} mt-1 font-semibold ${tone === "dark" ? "text-white/70" : "text-ink/60"}`}
          >
            Your Ride. Your Music.
          </p>
        )}
      </div>
    </div>
  );
}
