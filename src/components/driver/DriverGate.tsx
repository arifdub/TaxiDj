"use client";

import type { ReactNode } from "react";
import { ConfigNotice } from "@/components/ConfigNotice";
import { Logo } from "@/components/Logo";
import { Skeleton } from "@/components/ui";
import { SignInPanel } from "@/components/driver/SignInPanel";
import { useAuthUser } from "@/hooks/useAuthUser";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

/** Renders children only for a signed-in driver; otherwise config/sign-in UI. */
export function DriverGate({ children }: { children: (user: User) => ReactNode }) {
  const { user, loading } = useAuthUser();

  if (!isSupabaseConfigured) {
    return (
      <GateFrame>
        <ConfigNotice />
      </GateFrame>
    );
  }
  if (loading) {
    return (
      <GateFrame>
        <Skeleton className="h-16 w-full" />
        <Skeleton className="mt-3 h-12 w-full" />
      </GateFrame>
    );
  }
  if (!user) {
    return (
      <GateFrame>
        <SignInPanel />
      </GateFrame>
    );
  }
  return <>{children(user)}</>;
}

function GateFrame({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-10 px-4 py-10 safe-bottom">
      <div className="flex justify-center">
        <Logo size="xl" stacked showTagline />
      </div>
      <div>{children}</div>
    </main>
  );
}
