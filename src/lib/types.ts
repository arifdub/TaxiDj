// Row types mirroring supabase/migrations/*_taxi_dj_schema.sql.
// Kept framework-free so a future native iOS/CarPlay client can mirror them.

export type RideStatus = "active" | "ended";

export type RequestStatus =
  | "pending"
  | "queued"
  | "playing"
  | "played"
  | "rejected"
  | "removed";

export type RequestSource = "youtube" | "youtube_music";

export interface Driver {
  id: string;
  email: string | null;
  display_name: string;
  auto_approve: boolean;
  max_requests_per_passenger: number;
  playback_mode: "embedded" | "external";
  created_at: string;
  updated_at: string;
}

export interface Ride {
  id: string;
  driver_id: string;
  join_code: string;
  name: string;
  status: RideStatus;
  max_requests_per_passenger: number;
  auto_approve: boolean;
  created_at: string;
  expires_at: string;
  ended_at: string | null;
}

export interface Passenger {
  id: string;
  ride_id: string;
  session_identifier: string;
  nickname: string;
  created_at: string;
}

export interface SongRequest {
  id: string;
  ride_id: string;
  passenger_id: string;
  title: string;
  artist: string | null;
  thumbnail_url: string;
  youtube_url: string;
  youtube_video_id: string;
  source: RequestSource;
  duration_seconds: number | null;
  status: RequestStatus;
  position: number;
  started_at: string | null;
  /** Who removed it, when status is 'removed'. */
  removed_by: "passenger" | "driver" | null;
  /** When the driver handed this song to the YouTube / YouTube Music app. */
  sent_to_youtube_at: string | null;
  /** Set when the song was picked from Spotify (it plays via its YouTube match). */
  spotify_track_id: string | null;
  spotify_url: string | null;
  created_at: string;
  updated_at: string;
}

/** A song request joined with the requesting passenger's nickname. */
export interface QueueItem extends SongRequest {
  passenger: { nickname: string } | null;
}

/** Public ride info shown on the join page before a passenger joins. */
export interface PublicRide {
  id: string;
  join_code: string;
  name: string;
  state: "active" | "ended" | "expired";
}

export interface RideHistoryEntry {
  id: string;
  join_code: string;
  name: string;
  status: RideStatus;
  created_at: string;
  ended_at: string | null;
  expires_at: string;
  passenger_count: number;
  song_count: number;
  played_count: number;
}

export type DriverRequestAction =
  | "approve"
  | "reject"
  | "remove"
  | "play"
  | "finish"
  | "move_up"
  | "move_down";

/** Normalised YouTube video metadata returned by /api/youtube/*. */
export interface VideoResult {
  videoId: string;
  title: string;
  channel: string | null;
  thumbnailUrl: string;
  durationSeconds: number | null;
}

/** A Spotify search result (from /api/spotify/*). */
export interface SpotifyTrack {
  spotifyId: string;
  title: string;
  artist: string;
  album: string | null;
  imageUrl: string | null;
  durationSeconds: number;
  spotifyUrl: string;
}

/** Requests still waiting to be played, in queue order. */
export const WAITING_STATUSES: RequestStatus[] = ["pending", "queued"];

/** Requests that count toward a passenger's limit. */
export const COUNTED_STATUSES: RequestStatus[] = [
  "pending",
  "queued",
  "playing",
  "played",
];
