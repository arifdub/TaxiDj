"use client";

import { useEffect, useState } from "react";
import { CircleCheck } from "lucide-react";
import { ConfigNotice } from "@/components/ConfigNotice";
import { Logo } from "@/components/Logo";
import { Button, ButtonLink, Notice, Skeleton } from "@/components/ui";
import { friendlyError } from "@/lib/errors";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

/**
 * Landing page for the "Forgot password?" email link. Supabase signs the
 * browser in from the link, then the driver chooses a new password. On
 * iPhone this usually opens in Safari; afterwards the driver signs in with
 * the new password inside the Home Screen app.
 */
export default function ResetPasswordPage() {
  const [state, setState] = useState<"loading" | "ready" | "invalid" | "done">(
    isSupabaseConfigured ? "loading" : "invalid",
  );
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const client = getSupabase();
    if (!client) return;
    const { data } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || session) setState((s) => (s === "done" ? s : "ready"));
    });
    // Give the client a moment to read the link's token from the URL.
    const t = setTimeout(async () => {
      const { data: s } = await client.auth.getSession();
      setState((cur) => (cur === "loading" ? (s.session ? "ready" : "invalid") : cur));
    }, 1500);
    return () => {
      clearTimeout(t);
      data.subscription.unsubscribe();
    };
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabase()!.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setError(
        /at least|weak/i.test(error.message)
          ? "Choose a stronger password (at least 6 characters)."
          : friendlyError(error),
      );
    } else setState("done");
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-8 px-4 py-10">
      <div className="flex justify-center">
        <Logo size="lg" stacked showTagline />
      </div>
      {!isSupabaseConfigured ? (
        <ConfigNotice />
      ) : state === "loading" ? (
        <Skeleton className="h-40 w-full" />
      ) : state === "invalid" ? (
        <div className="space-y-4">
          <Notice tone="error">This reset link has expired or was already used. Request a new one from the sign-in screen.</Notice>
          <ButtonLink href="/" className="w-full">
            Back to Taxi DJ
          </ButtonLink>
        </div>
      ) : state === "done" ? (
        <div className="rounded-3xl border border-line bg-night-2 p-6 text-center">
          <CircleCheck className="mx-auto mb-3 size-10 text-go" aria-hidden />
          <h1 className="text-xl font-bold">Password updated</h1>
          <p className="mt-2 text-mist">
            Open Taxi DJ from your Home Screen and sign in with your email and new password.
          </p>
          <ButtonLink href="/" className="mt-5 w-full">
            Continue here
          </ButtonLink>
        </div>
      ) : (
        <form onSubmit={save} className="space-y-3 rounded-3xl border border-line bg-night-2 p-6">
          <h1 className="text-xl font-bold">Choose a new password</h1>
          <label htmlFor="new-password" className="sr-only">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            placeholder="New password (6+ characters)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-14 w-full rounded-2xl border border-line bg-night-3 px-4 text-lg text-white placeholder:text-mist/60 focus:border-taxi focus:outline-none"
          />
          <Button type="submit" className="w-full" loading={busy}>
            Save password
          </Button>
          {error && <Notice tone="error">{error}</Notice>}
        </form>
      )}
    </main>
  );
}
