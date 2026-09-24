import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import type { RequestStatus } from "@/lib/types";

// ------------------------------------------------------------------ Button --

type Variant = "primary" | "dark" | "danger" | "ghost" | "light" | "outline";
type Size = "md" | "lg" | "xl";

const variants: Record<Variant, string> = {
  primary:
    "bg-taxi text-ink hover:bg-taxi-light active:bg-taxi-dark shadow-[0_6px_24px_-8px_rgba(255,200,0,0.6)]",
  dark: "bg-night-3 text-white hover:bg-[#2c2c38] active:bg-night-2 border border-line",
  danger: "bg-stop text-white hover:bg-red-400 active:bg-red-600",
  ghost: "bg-transparent text-current hover:bg-white/5",
  light: "bg-zinc-100 text-ink hover:bg-zinc-200 active:bg-zinc-300",
  outline: "bg-white text-ink border-2 border-zinc-200 hover:border-zinc-300",
};

const sizes: Record<Size, string> = {
  md: "min-h-11 px-4 text-sm rounded-xl",
  lg: "min-h-14 px-5 text-base rounded-2xl",
  xl: "min-h-16 px-6 text-lg rounded-2xl tracking-wide",
};

export function buttonClass(variant: Variant = "primary", size: Size = "lg", extra = "") {
  return [
    "inline-flex items-center justify-center gap-2 font-bold select-none",
    "transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none",
    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-taxi",
    variants[variant],
    sizes[size],
    extra,
  ].join(" ");
}

export function Button({
  variant = "primary",
  size = "lg",
  loading = false,
  className = "",
  children,
  disabled,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      type="button"
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <LoaderCircle className="size-5 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  size = "lg",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

// ---------------------------------------------------------------- Skeleton --

export function Skeleton({ className = "", tone = "dark" }: { className?: string; tone?: "dark" | "light" }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-xl ${tone === "dark" ? "bg-night-3" : "bg-zinc-200"} ${className}`}
    />
  );
}

export function SongSkeleton({ tone = "dark", count = 3 }: { tone?: "dark" | "light"; count?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton tone={tone} className="size-16 shrink-0" />
          <div className="flex-1 space-y-2">
            <Skeleton tone={tone} className="h-4 w-3/4" />
            <Skeleton tone={tone} className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ------------------------------------------------------------ StatusBadge --

const statusStyles: Record<RequestStatus, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-400/15 text-amber-500 ring-amber-400/30" },
  queued: { label: "Queued", className: "bg-queue/15 text-queue ring-queue/30" },
  playing: { label: "Playing", className: "bg-go/15 text-go ring-go/30" },
  played: { label: "Played", className: "bg-zinc-400/15 text-zinc-500 ring-zinc-400/30" },
  rejected: { label: "Declined", className: "bg-stop/10 text-stop ring-stop/25" },
  removed: { label: "Removed", className: "bg-stop/10 text-stop ring-stop/25" },
};

export function StatusBadge({ status, rank }: { status: RequestStatus; rank?: number }) {
  const s = statusStyles[status];
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold uppercase tracking-wide ring-1 ${s.className}`}
    >
      {status === "playing" && <span className="size-1.5 rounded-full bg-go" aria-hidden />}
      {s.label}
      {rank != null && (status === "queued" || status === "pending") ? ` #${rank}` : ""}
    </span>
  );
}

// --------------------------------------------------------------- Thumbnail --

export function Thumbnail({
  src,
  alt = "",
  className = "size-16",
  rounded = "rounded-xl",
}: {
  src: string | null | undefined;
  alt?: string;
  className?: string;
  rounded?: string;
}) {
  return (
    <div className={`relative shrink-0 overflow-hidden bg-night-3 ${rounded} ${className}`}>
      {src ? (
        // Plain <img>: YouTube thumbnails are already optimised and served by i.ytimg.com.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          className="absolute inset-0 size-full object-cover"
        />
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------- YouTubeIcon --

export function YouTubeIcon({ className = "h-4 w-auto" }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 20" className={className} role="img" aria-label="YouTube">
      <path
        d="M27.4 3.1A3.5 3.5 0 0 0 25 .6C22.8 0 14 0 14 0S5.2 0 3 .6A3.5 3.5 0 0 0 .6 3.1C0 5.3 0 10 0 10s0 4.7.6 6.9A3.5 3.5 0 0 0 3 19.4c2.2.6 11 .6 11 .6s8.8 0 11-.6a3.5 3.5 0 0 0 2.4-2.5c.6-2.2.6-6.9.6-6.9s0-4.7-.6-6.9Z"
        fill="#FF0000"
      />
      <path d="m11.2 14.3 7.3-4.3-7.3-4.3v8.6Z" fill="#fff" />
    </svg>
  );
}

// -------------------------------------------------------------- EmptyState --

export function EmptyState({
  icon,
  title,
  children,
  tone = "dark",
  action,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  tone?: "dark" | "light";
  action?: ReactNode;
}) {
  return (
    <div
      className={`flex flex-col items-center rounded-3xl border border-dashed px-6 py-10 text-center ${
        tone === "dark" ? "border-line bg-night-2/60" : "border-zinc-300 bg-zinc-50"
      }`}
    >
      <div
        className={`mb-4 grid size-14 place-items-center rounded-2xl ${
          tone === "dark" ? "bg-taxi/10 text-taxi" : "bg-taxi/20 text-ink"
        }`}
      >
        {icon}
      </div>
      <h3 className="text-lg font-bold">{title}</h3>
      {children && (
        <p className={`mt-1 max-w-xs text-sm ${tone === "dark" ? "text-mist" : "text-zinc-600"}`}>
          {children}
        </p>
      )}
      {action && <div className="mt-5 w-full max-w-xs">{action}</div>}
    </div>
  );
}

// ------------------------------------------------------------------ Notice --

export function Notice({
  tone = "error",
  children,
  className = "",
}: {
  tone?: "error" | "info" | "success";
  children: ReactNode;
  className?: string;
}) {
  const styles = {
    error: "bg-red-50 text-red-800 border-red-200",
    info: "bg-blue-50 text-blue-900 border-blue-200",
    success: "bg-green-50 text-green-900 border-green-200",
  }[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-2xl border px-4 py-3 text-sm font-medium ${styles} ${className}`}
    >
      {children}
    </div>
  );
}

export function Spinner({ className = "size-6" }: { className?: string }) {
  return <LoaderCircle className={`animate-spin ${className}`} aria-label="Loading" />;
}
