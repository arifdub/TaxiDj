import type { Ride } from "@/lib/types";

/** A ride accepts requests while active and not past its expiry time. */
export function isRideOpen(ride: Pick<Ride, "status" | "expires_at">, now = Date.now()) {
  return ride.status === "active" && new Date(ride.expires_at).getTime() > now;
}
