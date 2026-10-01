"use client";

import { SettingsForm } from "@/components/driver/SettingsForm";
import { Skeleton } from "@/components/ui";
import { useAuthUser } from "@/hooks/useAuthUser";

/** Settings during a ride (in the ride's tab bar, so music keeps playing). */
export default function RideSettingsPage() {
  const { user } = useAuthUser();
  return (
    <div className="pb-6">
      <h1 className="mb-4 mt-1 text-3xl font-black tracking-tight">Settings</h1>
      {user ? <SettingsForm user={user} /> : <Skeleton className="h-40 w-full" />}
    </div>
  );
}
