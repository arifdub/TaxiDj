"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { usePassenger } from "@/components/passenger/PassengerContext";

/** Sends passengers who haven't joined yet back to the join screen. */
export function RequireJoined({ children }: { children: ReactNode }) {
  const { passenger, code } = usePassenger();
  const router = useRouter();
  useEffect(() => {
    if (!passenger) router.replace(`/join/${code}`);
  }, [passenger, code, router]);
  if (!passenger) return null;
  return <>{children}</>;
}
