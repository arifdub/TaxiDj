import type { Metadata, Viewport } from "next";
import { JoinWithCode } from "@/components/passenger/JoinWithCode";

export const metadata: Metadata = {
  title: "Join a ride – add your music",
  description: "Type the Taxi DJ code shown in the car to add your songs to the music queue. No app needed.",
  alternates: { canonical: "/join" },
};

export const viewport: Viewport = { themeColor: "#ffffff" };

export default function JoinPage() {
  return (
    <div className="min-h-dvh bg-white">
      <JoinWithCode />
    </div>
  );
}
