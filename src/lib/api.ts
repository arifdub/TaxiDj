"use client";

// Taxi DJ data service. Thin, typed wrappers over the Supabase tables and
// Postgres functions. The UI only talks to the backend through this module,
// and a future native iOS/CarPlay client can call the same functions.

import type {
  Driver,
  DriverRequestAction,
  Passenger,
  PublicRide,
  QueueItem,
  RequestSource,
  Ride,
  RideHistoryEntry,
  SongRequest,
} from "@/lib/types";
import { supabase } from "@/lib/supabase/client";

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase().rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

// ---------------------------------------------------------------- auth ----

export async function getSessionUserId(): Promise<string | null> {
  const { data } = await supabase().auth.getSession();
  return data.session?.user.id ?? null;
}

/** Ensures the browser has a Supabase session, signing in anonymously if needed. */
export async function ensureAnonymousSession(): Promise<string> {
  const existing = await getSessionUserId();
  if (existing) return existing;
  const { data, error } = await supabase().auth.signInAnonymously();
  if (error || !data.user) throw new Error(error?.message ?? "NOT_AUTHENTICATED");
  return data.user.id;
}

// -------------------------------------------------------------- driver ----

export const ensureDriver = () => rpc<Driver>("ensure_driver");

export const updateDriverSettings = (s: {
  displayName: string;
  autoApprove: boolean;
  maxRequestsPerPassenger: number;
}) =>
  rpc<Driver>("update_driver_settings", {
    p_display_name: s.displayName,
    p_auto_approve: s.autoApprove,
    p_max_requests_per_passenger: s.maxRequestsPerPassenger,
  });

export const startRide = () => rpc<Ride>("start_ride");

export const endRide = (rideId: string) => rpc<Ride>("end_ride", { p_ride_id: rideId });

export const updateRequest = (requestId: string, action: DriverRequestAction) =>
  rpc<SongRequest>("driver_update_request", { p_request_id: requestId, p_action: action });

/** Returns the request now playing, or null if the queue is empty. */
export async function skip(rideId: string, direction: "next" | "previous") {
  const row = await rpc<SongRequest | null>("driver_skip", {
    p_ride_id: rideId,
    p_direction: direction,
  });
  return row && row.id ? row : null;
}

export const rideHistory = () => rpc<RideHistoryEntry[]>("driver_ride_history", { p_limit: 100 });

export async function getActiveRide(): Promise<Ride | null> {
  const uid = await getSessionUserId();
  if (!uid) return null;
  const { data, error } = await supabase()
    .from("rides")
    .select("*")
    .eq("driver_id", uid)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Ride | null;
}

// --------------------------------------------------------- ride & queue ----

/** Reads a ride the caller is allowed to see (their own, or one they joined). */
export async function getRide(rideId: string): Promise<Ride | null> {
  const { data, error } = await supabase().from("rides").select("*").eq("id", rideId).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Ride | null;
}

export async function getQueue(rideId: string): Promise<QueueItem[]> {
  const { data, error } = await supabase()
    .from("song_requests")
    .select("*, passenger:passengers(nickname)")
    .eq("ride_id", rideId)
    .order("position", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as QueueItem[];
}

export async function getPassengers(rideId: string): Promise<Passenger[]> {
  const { data, error } = await supabase()
    .from("passengers")
    .select("*")
    .eq("ride_id", rideId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Passenger[];
}

// ----------------------------------------------------------- passenger ----

export async function getRideByCode(code: string): Promise<PublicRide | null> {
  const rows = await rpc<PublicRide[]>("get_ride_by_code", { p_code: code });
  return rows?.[0] ?? null;
}

/** The current session's passenger record for a ride, if they've joined. */
export async function getMyPassenger(rideId: string): Promise<Passenger | null> {
  const uid = await getSessionUserId();
  if (!uid) return null;
  const { data, error } = await supabase()
    .from("passengers")
    .select("*")
    .eq("ride_id", rideId)
    .eq("session_identifier", uid)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Passenger | null;
}

export async function joinRide(code: string, nickname: string): Promise<Passenger> {
  await ensureAnonymousSession();
  return rpc<Passenger>("join_ride", { p_code: code, p_nickname: nickname || null });
}

/** Passenger removes one of their own songs that hasn't played yet. */
export const removeMyRequest = (requestId: string) =>
  rpc<SongRequest>("passenger_remove_request", { p_request_id: requestId });

export const addSongRequest = (req: {
  rideId: string;
  videoId: string;
  title: string;
  artist: string | null;
  durationSeconds: number | null;
  source: RequestSource;
}) =>
  rpc<SongRequest>("add_song_request", {
    p_ride_id: req.rideId,
    p_video_id: req.videoId,
    p_title: req.title,
    p_artist: req.artist,
    p_duration_seconds: req.durationSeconds,
    p_source: req.source,
  });
