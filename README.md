# 🚕🎵 Taxi DJ — Your Ride. Your Music.

Taxi DJ lets a taxi or private-hire driver start a ride and show a QR code. Passengers scan it with their phone camera, land on a mobile web page (**no app install, no account**), search YouTube or paste a YouTube / YouTube Music link, and add songs to the driver's queue. The driver sees the queue live, manages it with large, simple controls, and plays each song in the official YouTube app, which then plays through CarPlay and the car speakers.

```
Driver:     Start Ride → Show QR → Passenger joins → Song appears in queue → Manage → Play on YouTube
Passenger:  Scan QR → Join → Search YouTube OR paste link → Add song → See request status
```

---

## 1. What's in the box

| Area | Routes |
| --- | --- |
| Driver home | `/` |
| Start ride | `/driver/ride/new` |
| Active ride dashboard (or summary if ended) | `/driver/ride/[id]` |
| QR code | `/driver/ride/[id]/qr` |
| Now playing | `/driver/ride/[id]/player` |
| Queue | `/driver/ride/[id]/queue` |
| Ride history | `/driver/history` |
| Settings / Help | `/driver/settings`, `/driver/help` |
| Passenger join | `/join/[code]` |
| Passenger add music | `/join/[code]/music` |
| Passenger requests | `/join/[code]/requests` |
| YouTube search proxy (server) | `/api/youtube/search?q=` |
| YouTube link metadata (server) | `/api/youtube/video?id=` |

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, Realtime) · Vercel.

## 2. Architecture

```
Passenger phone (web)          Driver iPhone (web / PWA)            Future native iOS + CarPlay app
        │                               │                                      │
        └──────── supabase-js (anon key + user JWT) ───────────────────────────┘
                                        │
                           ┌────────────▼─────────────┐
                           │         Supabase          │
                           │  Postgres + RLS           │  ← all rules live here
                           │  SECURITY DEFINER RPCs    │
                           │  Realtime (row changes)   │
                           │  Auth (email + anonymous) │
                           └────────────┬─────────────┘
                                        │ queue: YouTube video IDs + metadata only
                                        ▼
                     Driver taps Play → official YouTube / YouTube Music app
                                        → iPhone audio → CarPlay → car speakers

Next.js server (Vercel): /api/youtube/* → YouTube Data API v3 / oEmbed (key stays server-side)
```

Key design decisions:

- **The queue is separate from the media.** Supabase holds the queue. Playback goes through a `PlaybackProvider` interface (`src/lib/playback`). The MVP provider opens the song's official YouTube link. A future native provider can report real play/pause, progress and volume, and the existing player UI will use them without a redesign.
- **The backend is the source of truth.** Clients can only `SELECT`, and RLS limits what they see. Every write goes through a Postgres function that checks the caller and the ride state. Any client (web, native iOS, CarPlay) gets the same guarantees.
- **The YouTube code lives in one module.** `src/lib/youtube/` (`parse.ts` is pure URL validation; `service.ts` is server-only API access). No scraping and no downloading.

### Source layout

```
src/app/                 routes (driver, passenger, api, manifest, icons)
src/components/          UI (ui.tsx primitives, Logo, QrCode, driver/, passenger/)
src/hooks/useRide.ts     live ride/queue data (Realtime + refetch)
src/lib/api.ts           typed data service over Supabase tables/RPCs
src/lib/playback/        playback provider abstraction
src/lib/youtube/         URL parsing + server-side YouTube API
supabase/migrations/     database schema, RLS, functions, realtime publication
supabase/tests/          SQL test suite (runs against plain PostgreSQL)
```

## 3. Create the Supabase project

1. Create a project at [supabase.com](https://supabase.com/dashboard).
2. **Enable anonymous sign-ins** (passengers use them, and drivers can use them for "Continue as guest"): **Authentication → Sign In / Providers → Allow anonymous sign-ins → On**.
   - Recommended: turn on CAPTCHA (Authentication → Attack Protection) or keep the default anonymous rate limit (30 per hour per IP) to prevent abuse.
3. **Email sign-in** for drivers is on by default (magic link). Under **Authentication → URL Configuration**, set:
   - Site URL: `https://your-domain` (e.g. `https://taxidj.com`)
   - Redirect URLs: add `https://your-domain/` and `http://localhost:3000/`
   - For production, configure a custom SMTP provider. Supabase's built-in email service is heavily rate limited.

## 4. Run the database migrations

The whole schema is in `supabase/migrations/20260924000000_taxi_dj_schema.sql`:

- Tables: `drivers`, `rides`, `passengers`, `song_requests`. All use UUID primary keys, foreign keys, and indexes on `ride_id`, `status`, `position` and `created_at`. `join_code` is unique.
- RLS policies, plus RPC functions: `start_ride`, `end_ride`, `join_ride`, `add_song_request`, `driver_update_request`, `driver_skip`, `driver_ride_history`, `get_ride_by_code`, `update_driver_settings`, `ensure_driver`.
- Adds `rides`, `passengers` and `song_requests` to the `supabase_realtime` publication.

**Option A: Supabase CLI (recommended)**

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

**Option B: Dashboard.** Open **SQL Editor**, paste the migration file, and run it.

**Local Supabase:** `npx supabase start` (Docker required). This uses `supabase/config.toml`, which already enables anonymous sign-ins, and applies the migration automatically.

### Database tests

`supabase/tests/queue_flow.test.sql` covers the full flow: joining, limits, duplicates, invalid IDs, RLS isolation between passengers, strangers and other drivers, blocked direct writes, reordering, next/previous, approval mode, ending a ride, and history. It runs against any local PostgreSQL (with a small Supabase `auth` stub):

```bash
PGHOST=localhost PGUSER=postgres npm run test:db
```

## 5. Environment variables

Copy `.env.example` to `.env.local`:

| Variable | Where it's used | Required |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server. Supabase project URL (Settings → API). | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server. Anon/publishable key. Safe to expose because RLS protects the data. | ✅ |
| `YOUTUBE_API_KEY` | **Server only**, in `/api/youtube/*`. Enables search. | Optional |
| `NEXT_PUBLIC_SITE_URL` | Browser. Base URL encoded in QR codes (e.g. `https://taxidj.com`). Defaults to the current origin. | Optional |

The app **never uses a service-role key**. Don't add one.

If the Supabase variables are missing, the app shows a friendly "Taxi DJ isn't connected yet" screen instead of crashing.

## 6. YouTube API access

1. In [Google Cloud Console](https://console.cloud.google.com/), create or select a project.
2. **APIs & Services → Library → YouTube Data API v3 → Enable**.
3. **APIs & Services → Credentials → Create credentials → API key**.
4. Restrict the key: **API restrictions → YouTube Data API v3**. It is only called from the server, so don't add HTTP-referrer restrictions.
5. Set `YOUTUBE_API_KEY` in `.env.local` and in Vercel.

Quota notes: a search costs about 101 units (`search.list` plus one `videos.list` for durations). The default quota is 10,000 units per day. Identical searches are cached on Vercel's CDN for an hour, and each IP is limited to 30 searches per minute (best effort, per server instance).

**Without a key:** search shows "YouTube search isn't set up on this Taxi DJ yet" and switches to paste-link mode. Pasted links still work: their metadata comes from YouTube's official keyless **oEmbed** endpoint.

Accepted links: `youtube.com/watch?v=…`, `m.youtube.com`, `youtu.be/…`, `/shorts/…`, `/embed/…`, `/live/…`, and `music.youtube.com/watch?v=…`. Links on any other domain are rejected. Playlist-only links are politely declined.

## 7. Run locally

```bash
npm install
cp .env.example .env.local     # fill in values
npm run dev                    # http://localhost:3000
```

To test with a real phone on the same Wi-Fi, run `npm run dev -- -H 0.0.0.0`, set `NEXT_PUBLIC_SITE_URL=http://<your-LAN-IP>:3000` so the QR code points to your machine, and add that URL to Supabase's redirect URLs.

Checks:

```bash
npm run lint        # ESLint
npm run typecheck   # TypeScript
npm test            # unit tests (YouTube URL parsing)
npm run test:db     # SQL tests (needs local PostgreSQL)
npm run build       # production build
```

## 8. Deploy to Vercel

1. Push the repository to GitHub.
2. In Vercel, choose **Add New → Project** and import the repo. The framework (Next.js) is detected automatically.
3. Add the environment variables from section 5 for **Production** and **Preview**.
   - You can use the **Supabase Vercel integration** to fill in the Supabase variables automatically.
4. Deploy, then add your production domain (e.g. `taxidj.com`) and set `NEXT_PUBLIC_SITE_URL` to it.
5. In Supabase **Authentication → URL Configuration**, set the Site URL and redirect URL to that domain.

## 9. How the passenger QR system works

1. `start_ride()` creates a ride with a random 5-character code. The alphabet leaves out look-alike characters such as `0/O` and `1/I`. Codes are unique, and each driver can have only one active ride.
2. The QR code encodes `NEXT_PUBLIC_SITE_URL/join/<CODE>` and is rendered in the browser as a crisp SVG. The driver can also share or copy the link.
3. The join page calls `get_ride_by_code` (callable without an account). It exposes only the ride's display name and whether it is active, ended or expired.
4. On **JOIN RIDE**, the browser signs in anonymously with Supabase Auth and calls `join_ride(code, nickname)`. The passenger row is tied to that anonymous user ID (`session_identifier`), so refreshing or scanning again resumes the same passenger. The nickname defaults to "Passenger N".
5. `add_song_request` locks the ride row and then checks that the ride is active and not expired, the caller is a passenger of this ride, the video ID is valid, the per-passenger limit (default 3) isn't reached, and the song isn't already waiting or playing. The canonical YouTube URL and thumbnail are built on the server from the validated video ID and never taken from the client.
6. Rides expire automatically after 12 hours if the driver never ends them. Once a ride is ended or expired, the passenger link shows "This Taxi DJ ride has ended." and no more requests are accepted.

## 10. How real-time queue updates work

- The migration adds `rides`, `passengers` and `song_requests` to Supabase's `supabase_realtime` publication.
- `useRide()` subscribes to `postgres_changes` filtered by `ride_id`. Realtime applies RLS to each subscriber, so passengers only receive events for the ride they joined.
- On any change the hook refetches the ride's queue. This keeps ordering and nickname joins consistent. The driver gets a calm **NEW SONG REQUEST** card for newly arrived songs, and passengers see their status badge change (Pending → Queued #N → Playing → Played / Removed).
- Mobile browsers drop WebSockets in the background, so the hook also refetches when the page becomes visible or the network comes back, and runs a 30-second safety poll.

## 11. YouTube playback limitations (important)

- Taxi DJ **never downloads, extracts, proxies, re-streams or stores YouTube audio or video**. It stores only the video ID, the link, and display metadata.
- A web app cannot control the YouTube iOS app: it can't start, pause, skip or read the playback position. So in the MVP:
  - **Play** marks the song as playing in the queue and opens its official link in the YouTube or YouTube Music app (or youtube.com if the app isn't installed).
  - **Next / Previous** move through the Taxi DJ queue and open the chosen song.
  - The progress bar is an *estimate* based on when the song started and how long it is, and the UI labels it that way. Volume stays with the phone or car controls.
- Autoplay of the next song after one finishes isn't possible from the web. The driver taps Next.

## 12. Future native iOS / CarPlay architecture

A native iOS client can reuse this backend without changes:

- **Auth:** Supabase Swift SDK, signing in with email or anonymously just like the web app.
- **Data:** call the same RPCs (`start_ride`, `driver_update_request`, `driver_skip`, `end_ride`, …) and subscribe to the same Realtime channels. All validation and security already lives in Postgres.
- **Playback:** implement a native `PlaybackProvider` that uses only an officially permitted playback integration, reporting `remoteControl`, `progress` and `volume` capabilities. The web player UI already switches on those capabilities.
- **CarPlay:** an audio-app CarPlay template (`CPListTemplate` for Up Next and `CPNowPlayingTemplate`) backed by the same queue. This needs Apple's CarPlay audio entitlement and a playback source that is allowed to run in the background and on CarPlay. Plain web apps can't become CarPlay apps, so this stays a native-only phase.

## PWA

The site includes a web app manifest (`/manifest.webmanifest`), generated PNG icons (including a maskable icon), an Apple touch icon, theme colours and a mobile viewport. Drivers can "Add to Home Screen" for a full-screen app feel. Passengers never need to install anything.

## Safety

The driver UI uses big touch targets, high contrast, minimal text and no flashing animation, and it respects reduced-motion settings. Only interact with the app when it's safe and legal to do so.
