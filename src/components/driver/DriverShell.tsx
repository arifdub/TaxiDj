import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronLeft } from "lucide-react";

/** Dark, mobile-first frame for driver screens. */
export function DriverShell({
  children,
  title,
  backHref,
  right,
  wide = false,
}: {
  children: ReactNode;
  title?: string;
  backHref?: string;
  right?: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="min-h-dvh bg-ink text-white">
      <div className={`mx-auto w-full px-4 safe-top safe-bottom ${wide ? "max-w-3xl" : "max-w-lg"}`}>
        {(title || backHref) && (
          <header className="flex min-h-14 items-center gap-2 py-2">
            {backHref && (
              <Link
                href={backHref}
                aria-label="Back"
                className="-ml-2 grid size-11 place-items-center rounded-full text-white hover:bg-white/5"
              >
                <ChevronLeft className="size-7" aria-hidden />
              </Link>
            )}
            {title && <h1 className="flex-1 truncate text-xl font-black tracking-tight">{title}</h1>}
            {right}
          </header>
        )}
        {children}
      </div>
    </div>
  );
}
