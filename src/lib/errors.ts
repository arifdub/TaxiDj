// Maps backend error codes (raised by the Postgres functions via
// taxidj_error) and network failures to friendly, non-technical messages.

const MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "Your session expired. Please refresh the page and try again.",
  RIDE_NOT_FOUND: "We couldn't find that Taxi DJ ride. Check the code and try again.",
  RIDE_ENDED: "This Taxi DJ ride has ended.",
  RIDE_EXPIRED: "This Taxi DJ ride has expired.",
  NOT_A_PASSENGER: "Please join the ride before adding songs.",
  INVALID_VIDEO: "That doesn't look like a valid YouTube video.",
  REQUEST_LIMIT_REACHED: "You've reached your song limit for this ride.",
  DUPLICATE_REQUEST: "That song is already in the queue.",
  REQUEST_NOT_FOUND: "That song is no longer in the queue.",
  INVALID_TRANSITION: "That song has already been updated. The queue has been refreshed.",
  INVALID_ACTION: "That action isn't available.",
  INVALID_DISPLAY_NAME: "Please enter a name between 1 and 40 characters.",
  INVALID_REQUEST_LIMIT: "Choose a song limit between 1 and 50.",
  PASSENGER_REMOVED: "The driver removed you from this ride, so you can't add songs.",
  PASSENGER_NOT_FOUND: "That passenger has already left the ride.",
  CODE_GENERATION_FAILED: "We couldn't start a ride just now. Please try again.",
  SUPABASE_NOT_CONFIGURED: "Taxi DJ isn't connected to its database yet.",
  ANONYMOUS_DISABLED:
    "Guest access isn't enabled for this Taxi DJ server yet. Please ask the driver to try again later.",
  DB_UPDATE_NEEDED:
    "Taxi DJ's database needs an update for this feature. Run “npx supabase db push” (see README), then try again.",
  OFFLINE: "You're offline. Check your connection and try again.",
  NO_YOUTUBE_MATCH: "We couldn't find that song on YouTube. Try another version or search YouTube directly.",
  MATCH_FAILED: "We couldn't add that Spotify song right now. Please try again.",
};

const GENERIC = "Something went wrong. Please try again.";

export function errorCode(err: unknown): string | null {
  if (!err) return null;
  const message =
    typeof err === "string"
      ? err
      : err instanceof Error
        ? err.message
        : typeof err === "object" && "message" in err
          ? String((err as { message: unknown }).message)
          : "";
  if (Object.hasOwn(MESSAGES, message)) return message;
  if (/anonymous sign-ins are disabled/i.test(message)) return "ANONYMOUS_DISABLED";
  // A database function or column the app expects doesn't exist yet: a
  // migration hasn't been applied.
  if (/could not find the function|schema cache|does not exist/i.test(message)) return "DB_UPDATE_NEEDED";
  if (typeof navigator !== "undefined" && !navigator.onLine) return "OFFLINE";
  if (/failed to fetch|network|load failed/i.test(message)) return "OFFLINE";
  return null;
}

export function friendlyError(err: unknown, fallback = GENERIC): string {
  const code = errorCode(err);
  return code ? MESSAGES[code] : fallback;
}
