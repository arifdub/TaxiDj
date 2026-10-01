"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui";

/** Passengers who have a join code (not a QR code) type it here. */
export function JoinWithCode() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  const valid = /^[A-HJ-NP-Z2-9]{5}$/.test(clean) || /^[A-HJ-NP-Z2-9]{8}$/.test(clean);

  function go(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    // 5 letters: a ride's join code. 8: a permanent car card code.
    router.push(clean.length === 5 ? `/join/${clean}` : `/c/${clean}`);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-8 bg-white px-6 py-10 text-ink">
      <div className="flex justify-center">
        <Logo tone="light" size="xl" stacked showTagline />
      </div>
      <form onSubmit={go} className="space-y-4">
        <h1 className="text-center text-2xl font-black">Join a ride and add your music</h1>
        <p className="text-center text-zinc-600">
          Type the code shown in the car (on the driver&apos;s phone or the Taxi DJ card). No app needed.
        </p>
        <label htmlFor="join-code" className="sr-only">
          Join code
        </label>
        <input
          id="join-code"
          value={clean}
          onChange={(e) => setCode(e.target.value)}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          placeholder="ABCDE"
          className="h-16 w-full rounded-2xl border-2 border-zinc-200 bg-zinc-50 text-center font-mono text-3xl font-black uppercase tracking-[0.4em] focus:border-taxi-dark focus:bg-white focus:outline-none"
        />
        <Button type="submit" size="xl" className="w-full" disabled={!valid}>
          JOIN RIDE
        </Button>
      </form>
      <p className="text-center text-sm text-zinc-500">
        Have a QR code? Just scan it with your phone camera.{" "}
        <Link href="/play-music-in-a-taxi" className="font-bold underline">
          How it works
        </Link>
      </p>
    </main>
  );
}
