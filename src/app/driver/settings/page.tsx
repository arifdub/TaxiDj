"use client";

import { DriverGate } from "@/components/driver/DriverGate";
import { DriverShell } from "@/components/driver/DriverShell";
import { SettingsForm } from "@/components/driver/SettingsForm";

export default function SettingsPage() {
  return (
    <DriverGate>
      {(user) => (
        <DriverShell title="Settings" backHref="/">
          <SettingsForm user={user} />
        </DriverShell>
      )}
    </DriverGate>
  );
}
