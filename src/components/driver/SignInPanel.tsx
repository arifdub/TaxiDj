"use client";

import { useState } from "react";
import { KeyRound, Mail, UserRound } from "lucide-react";
import { Button, Notice } from "@/components/ui";
import { friendlyError } from "@/lib/errors";
import { supabase } from "@/lib/supabase/client";

/**
 * Driver sign-in by email.
 *
 * The email contains both a link and a one-time code. On iPhone, an app added
 * to the Home Screen has its own storage, separate from Safari: tapping the
 * link signs in Safari, not the installed app. Typing the code signs in
 * wherever Taxi DJ is open, so the code is the primary path.
 */
export function SignInPanel() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState<"email" | "code" | "guest" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setBusy("email");
    setError(null);
    setNotice(null);
    const { error } = await supabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/` },
    });
    setBusy(null);
    if (error) {
      setError(
        /rate limit|security purposes/i.test(error.message)
          ? "Please wait a minute before requesting another code."
          : friendlyError(error, "We couldn't send the email. Check the address and try again."),
      );
    } else {
      setSent(true);
      if (e === undefined) setNotice("We sent you a new code.");
    }
  }

  async function verifyCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy("code");
    setError(null);
    const { error } = await supabase().auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: "email",
    });
    setBusy(null);
    // On success the auth listener re-renders the app as signed in.
    if (error) {
      setError(
        /expired|invalid/i.test(error.message)
          ? "That code is incorrect or has expired. Check the latest email or send a new code."
          : friendlyError(error),
      );
    }
  }

  async function guest() {
    setBusy("guest");
    setError(null);
    const { error } = await supabase().auth.signInAnonymously();
    setBusy(null);
    if (error) setError(friendlyError(error));
  }

  const inputClass =
    "h-14 w-full rounded-2xl border border-line bg-night-3 px-4 text-lg text-white placeholder:text-mist/60 focus:border-taxi focus:outline-none";

  if (sent) {
    return (
      <div className="rounded-3xl border border-line bg-night-2 p-6">
        <KeyRound className="mb-3 size-9 text-taxi" aria-hidden />
        <h2 className="text-xl font-bold">Enter your code</h2>
        <p className="mt-1 text-sm text-mist">
          We emailed a sign-in code to <strong className="text-white">{email}</strong>. Type it here —
          no need to leave Taxi DJ.
        </p>
        <form onSubmit={verifyCode} className="mt-5 space-y-3">
          <label htmlFor="code" className="sr-only">
            Sign-in code
          </label>
          <input
            id="code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6,10}"
            required
            autoFocus
            placeholder="123456"
            className={`${inputClass} text-center font-mono text-2xl tracking-[0.4em]`}
          />
          <Button type="submit" className="w-full" loading={busy === "code"} disabled={code.length < 6}>
            Sign in
          </Button>
        </form>
        {error && (
          <Notice className="mt-4" tone="error">
            {error}
          </Notice>
        )}
        {notice && !error && (
          <Notice className="mt-4" tone="success">
            {notice}
          </Notice>
        )}
        <div className="mt-4 flex justify-between gap-2">
          <Button variant="ghost" size="md" className="text-mist" onClick={() => sendCode()} loading={busy === "email"}>
            Send a new code
          </Button>
          <Button
            variant="ghost"
            size="md"
            className="text-mist"
            onClick={() => {
              setSent(false);
              setCode("");
              setError(null);
            }}
          >
            Change email
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-line bg-night-2 p-6">
      <h2 className="text-xl font-bold">Driver sign in</h2>
      <p className="mt-1 text-sm text-mist">We&apos;ll email you a code to sign in and keep your ride history.</p>
      <form onSubmit={sendCode} className="mt-5 space-y-3">
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
          className={inputClass}
        />
        <Button type="submit" className="w-full" loading={busy === "email"}>
          <Mail className="size-5" aria-hidden /> Email me a sign-in code
        </Button>
      </form>
      <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-mist">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
      <Button variant="dark" className="w-full" onClick={guest} loading={busy === "guest"}>
        <UserRound className="size-5" aria-hidden /> Continue as guest
      </Button>
      <p className="mt-2 text-center text-xs text-mist">Guest rides are only saved on this device.</p>
      {error && (
        <Notice className="mt-4" tone="error">
          {error}
        </Notice>
      )}
    </div>
  );
}
