"use client";

import type { ReactNode } from "react";
import { useAuthUser } from "@/hooks/useAuthUser";

/**
 * Shows its (server-rendered) children to visitors and search engines, and
 * hides them once a driver is signed in, so the app stays uncluttered.
 */
export function HideWhenSignedIn({ children }: { children: ReactNode }) {
  const { user } = useAuthUser();
  return <div hidden={Boolean(user)}>{children}</div>;
}
