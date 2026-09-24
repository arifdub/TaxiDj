"use client";

import { useState } from "react";
import { Mail, UserRound } from "lucide-react";
import { Button, Notice } from "@/components/ui";
import { friendlyError } from "@/lib/errors";
import { supabase } from "@/lib/supabase/client";

export function SignInPanel() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<"email" | "guest" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setBusy("email");
    setError(null);
    const { error } = await supabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setBusy(null);
    if (error) setError(friendlyError(error, "We couldn't send the sign-in link. Check the email address."));
    else setSent(true);
  }

  async function guest() {
    setBusy("guest");
    setError(null);
    const { error } = await supabase().auth.signInAnonymously();
    setBusy(null);
    if (error) setError(friendlyError(error));
  }

  if (sent) {
    return (
      <div className="rounded-3xl border border-line bg-night-2 p-6 text-center">
        <Mail className="mx-auto mb-3 size-10 text-taxi" aria-hidden />
        <h2 className="text-xl font-bold">Check your email</h2>
        <p className="mt-2 text-mist">
          We sent a sign-in link to <strong className="text-white">{email}</strong>. Open it on
          this device to start driving with Taxi DJ.
        </p>
        <Button variant="ghost" size="md" className="mt-4 text-mist" onClick={() => setSent(false)}>
          Use a different email
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-line bg-night-2 p-6">
      <h2 className="text-xl font-bold">Driver sign in</h2>
      <p className="mt-1 text-sm text-mist">Sign in to start rides and keep your ride history.</p>
      <form onSubmit={sendLink} className="mt-5 space-y-3">
        <label htmlFor="email" className="sr-only">
          Email address
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-14 w-full rounded-2xl border border-line bg-night-3 px-4 text-lg text-white placeholder:text-mist/60 focus:border-taxi focus:outline-none"
        />
        <Button type="submit" className="w-full" loading={busy === "email"}>
          <Mail className="size-5" aria-hidden /> Email me a sign-in link
        </Button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-mist">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
      <Button variant="dark" className="w-full" onClick={guest} loading={busy === "guest"}>
        <UserRound className="size-5" aria-hidden /> Continue as guest
      </Button>
      <p className="mt-2 text-center text-xs text-mist">
        Guest rides are only saved on this device.
      </p>
      {error && (
        <Notice className="mt-4" tone="error">
          {error}
        </Notice>
      )}
    </div>
  );
}
