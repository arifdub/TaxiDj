"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/Logo";
import { Button, Notice } from "@/components/ui";
import { usePassenger } from "@/components/passenger/PassengerContext";
import { joinRide } from "@/lib/api";
import { friendlyError } from "@/lib/errors";

/** Step 1 for passengers: optional nickname, then JOIN RIDE. */
export default function JoinPage() {
  const router = useRouter();
  const { code, publicRide, passenger, setPassenger } = usePassenger();
  const [nickname, setNickname] = useState(passenger?.nickname ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const p = await joinRide(code, nickname.trim());
      setPassenger(p);
      router.push(`/join/${code}/music`);
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col py-8">
      <div className="flex justify-center">
        <Logo tone="light" size="xl" stacked showTagline />
      </div>

      <div className="mt-10 text-center">
        <p className="text-lg text-zinc-600">{passenger ? "Welcome back to" : "You're joining"}</p>
        <p className="mt-1 text-3xl font-black">🚕 {publicRide?.name}</p>
      </div>

      <form onSubmit={join} className="mt-10 space-y-4">
        <div>
          <label htmlFor="nickname" className="text-sm font-bold text-zinc-700">
            Enter a nickname <span className="font-normal text-zinc-500">(optional)</span>
          </label>
          <input
            id="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            maxLength={30}
            autoComplete="nickname"
            enterKeyHint="go"
            placeholder="e.g. Sam"
            className="mt-2 h-14 w-full rounded-2xl border-2 border-zinc-200 bg-zinc-50 px-4 text-lg focus:border-taxi-dark focus:bg-white focus:outline-none"
          />
        </div>
        <Button type="submit" size="xl" className="w-full" loading={busy}>
          {passenger ? "CONTINUE" : "JOIN RIDE"}
        </Button>
        {error && <Notice tone="error">{error}</Notice>}
      </form>

      <p className="mt-auto pt-10 text-center text-xs text-zinc-500">
        No app or account needed. Songs play from YouTube in the driver&apos;s car.
      </p>
    </main>
  );
}
