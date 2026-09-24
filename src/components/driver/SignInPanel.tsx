"use client";

import { useState } from "react";
import { KeyRound, LogIn, Mail, UserPlus, UserRound } from "lucide-react";
import { Button, Notice } from "@/components/ui";
import { friendlyError } from "@/lib/errors";
import { supabase } from "@/lib/supabase/client";

/**
 * Driver sign-in.
 *
 * On iPhone, an app added to the Home Screen has its own storage, separate
 * from Safari, so an emailed *link* signs in Safari rather than the app.
 * Email + password (the default) and the emailed one-time code are both
 * completed inside Taxi DJ, so they work in the installed app.
 *
 * The one-time code needs {{ .Token }} in the Supabase email templates; the
 * password flow works with Supabase's default templates.
 */
type Mode = "signin" | "signup" | "code" | "verify" | "check-email" | "reset-sent";

const inputClass =
  "h-14 w-full rounded-2xl border border-line bg-night-3 px-4 text-lg text-white placeholder:text-mist/60 focus:border-taxi focus:outline-none";

function authMessage(message: string, fallback?: string) {
  if (/invalid login credentials/i.test(message)) return "Wrong email or password.";
  if (/email not confirmed/i.test(message))
    return "Please confirm your email first: open the email we sent and tap the link, then sign in here.";
  if (/already registered|already been registered|already exists/i.test(message))
    return "That email already has an account. Sign in instead, or use “Forgot password?”.";
  if (/password should be at least|weak password/i.test(message))
    return "Choose a stronger password (at least 6 characters).";
  if (/rate limit|security purposes/i.test(message))
    return "Too many emails were sent recently. Please wait a few minutes and try again.";
  if (/expired|invalid/i.test(message)) return "That code is incorrect or has expired.";
  return friendlyError(message, fallback);
}

export function SignInPanel() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = (next: Mode) => {
    setMode(next);
    setError(null);
  };

  async function attempt(key: string, fn: () => Promise<{ error: { message: string } | null }>, onOk?: () => void) {
    setBusy(key);
    setError(null);
    const { error } = await fn();
    setBusy(null);
    if (error) setError(authMessage(error.message));
    else onOk?.();
  }

  const signIn = (e: React.FormEvent) => {
    e.preventDefault();
    // On success the auth listener re-renders the app as signed in.
    attempt("signin", () => supabase().auth.signInWithPassword({ email: email.trim(), password }));
  };

  const signUp = (e: React.FormEvent) => {
    e.preventDefault();
    attempt("signup", async () => {
      const { data, error } = await supabase().auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      // No session means Supabase wants the email confirmed first.
      if (!error && !data.session) go("check-email");
      return { error };
    });
  };

  const forgot = () => {
    if (!email.trim()) return setError("Enter your email above first.");
    attempt(
      "reset",
      () =>
        supabase().auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        }),
      () => go("reset-sent"),
    );
  };

  const sendCode = (e?: React.FormEvent) => {
    e?.preventDefault();
    attempt(
      "code",
      () => supabase().auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${window.location.origin}/` } }),
      () => go("verify"),
    );
  };

  const verify = (e: React.FormEvent) => {
    e.preventDefault();
    attempt("verify", () => supabase().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" }));
  };

  const guest = () => attempt("guest", () => supabase().auth.signInAnonymously());

  const emailField = (
    <>
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
    </>
  );

  const errorBox = error && (
    <Notice className="mt-4" tone="error">
      {error}
    </Notice>
  );

  if (mode === "check-email" || mode === "reset-sent") {
    return (
      <div className="rounded-3xl border border-line bg-night-2 p-6 text-center">
        <Mail className="mx-auto mb-3 size-10 text-taxi" aria-hidden />
        <h2 className="text-xl font-bold">Check your email</h2>
        <p className="mt-2 text-mist">
          {mode === "check-email" ? (
            <>
              We sent a confirmation link to <strong className="text-white">{email}</strong>. Tap it
              (it&apos;s fine if it opens in Safari), then come back here and sign in with your
              password.
            </>
          ) : (
            <>
              We sent a password reset link to <strong className="text-white">{email}</strong>. Set a
              new password on the page it opens, then come back here and sign in.
            </>
          )}
        </p>
        <Button className="mt-5 w-full" onClick={() => go("signin")}>
          <LogIn className="size-5" aria-hidden /> Back to sign in
        </Button>
      </div>
    );
  }

  if (mode === "code" || mode === "verify") {
    return (
      <div className="rounded-3xl border border-line bg-night-2 p-6">
        <KeyRound className="mb-3 size-9 text-taxi" aria-hidden />
        <h2 className="text-xl font-bold">{mode === "code" ? "Sign in with a code" : "Enter your code"}</h2>
        {mode === "code" ? (
          <form onSubmit={sendCode} className="mt-5 space-y-3">
            {emailField}
            <Button type="submit" className="w-full" loading={busy === "code"}>
              <Mail className="size-5" aria-hidden /> Email me a code
            </Button>
          </form>
        ) : (
          <>
            <p className="mt-1 text-sm text-mist">
              Type the code from the email sent to <strong className="text-white">{email}</strong>. If the
              email only has a link, use your password instead.
            </p>
            <form onSubmit={verify} className="mt-5 space-y-3">
              <label htmlFor="code" className="sr-only">
                Sign-in code
              </label>
              <input
                id="code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 10))}
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                autoFocus
                placeholder="123456"
                className={`${inputClass} text-center font-mono text-2xl tracking-[0.4em]`}
              />
              <Button type="submit" className="w-full" loading={busy === "verify"} disabled={code.length < 6}>
                Sign in
              </Button>
            </form>
          </>
        )}
        {errorBox}
        <Button variant="ghost" size="md" className="mt-3 w-full text-mist" onClick={() => go("signin")}>
          Use email and password instead
        </Button>
      </div>
    );
  }

  const isSignUp = mode === "signup";

  return (
    <div className="rounded-3xl border border-line bg-night-2 p-6">
      <div role="tablist" aria-label="Account" className="grid grid-cols-2 gap-1 rounded-2xl bg-night-3 p-1">
        {(["signin", "signup"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => go(m)}
            className={`min-h-11 rounded-xl text-sm font-bold ${mode === m ? "bg-taxi text-ink" : "text-mist"}`}
          >
            {m === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form onSubmit={isSignUp ? signUp : signIn} className="mt-5 space-y-3">
        {emailField}
        <label htmlFor="password" className="sr-only">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          autoComplete={isSignUp ? "new-password" : "current-password"}
          placeholder={isSignUp ? "Choose a password (6+ characters)" : "Password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
        />
        <Button type="submit" className="w-full" loading={busy === "signin" || busy === "signup"}>
          {isSignUp ? <UserPlus className="size-5" aria-hidden /> : <LogIn className="size-5" aria-hidden />}
          {isSignUp ? "Create driver account" : "Sign in"}
        </Button>
      </form>

      {!isSignUp && (
        <div className="mt-2 flex justify-between">
          <Button variant="ghost" size="md" className="px-2 text-mist" onClick={forgot} loading={busy === "reset"}>
            Forgot password?
          </Button>
          <Button variant="ghost" size="md" className="px-2 text-mist" onClick={() => go("code")}>
            Email me a code
          </Button>
        </div>
      )}
      {errorBox}

      <div className="my-5 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-mist">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
      <Button variant="dark" className="w-full" onClick={guest} loading={busy === "guest"}>
        <UserRound className="size-5" aria-hidden /> Continue as guest
      </Button>
      <p className="mt-2 text-center text-xs text-mist">Guest rides and settings stay on this device only.</p>
    </div>
  );
}
