import { Database } from "lucide-react";

/** Shown instead of the app when Supabase env vars are missing. */
export function ConfigNotice({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const dark = tone === "dark";
  return (
    <div
      className={`rounded-3xl border p-6 ${dark ? "border-line bg-night-2 text-white" : "border-zinc-200 bg-white text-ink"}`}
    >
      <div className="mb-3 flex items-center gap-2 text-lg font-bold">
        <Database className="size-5 text-taxi" aria-hidden /> Taxi DJ isn&apos;t connected yet
      </div>
      <p className={`text-sm ${dark ? "text-mist" : "text-zinc-600"}`}>
        This Taxi DJ server hasn&apos;t been connected to its Supabase database. If you&apos;re the
        owner, set <code className="font-mono text-taxi">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="font-mono text-taxi">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (see the README),
        then redeploy.
      </p>
    </div>
  );
}
