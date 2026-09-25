-- =============================================================================
-- Taxi DJ — songs picked from Spotify
--
-- Riders/drivers can search Spotify. A Spotify pick is stored with its
-- Spotify track (so the driver can open it in the Spotify app) AND the
-- matching YouTube video (so it plays in the in-app player and the YouTube
-- playlist like every other song).
-- =============================================================================

alter table public.song_requests
  add column spotify_track_id text check (spotify_track_id ~ '^[A-Za-z0-9]{22}$'),
  add column spotify_url text;

drop function public.add_song_request(uuid, text, text, text, integer, text);
drop function public.driver_add_song(uuid, text, text, text, integer, text);

create function public.add_song_request(
  p_ride_id uuid,
  p_video_id text,
  p_title text,
  p_artist text default null,
  p_duration_seconds integer default null,
  p_source text default 'youtube',
  p_spotify_track_id text default null
) returns public.song_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_ride public.rides;
  v_passenger public.passengers;
  v_used integer;
  v_source public.request_source;
  v_title text := left(nullif(btrim(regexp_replace(coalesce(p_title, ''), '[[:cntrl:]]', '', 'g')), ''), 200);
  v_artist text := left(nullif(btrim(regexp_replace(coalesce(p_artist, ''), '[[:cntrl:]]', '', 'g')), ''), 120);
  v_req public.song_requests;
begin
  if v_uid is null then perform public.taxidj_error('NOT_AUTHENTICATED'); end if;

  -- Lock the ride so limit/duplicate/position checks are race-free.
  select * into v_ride from public.rides where id = p_ride_id for update;
  if not found then perform public.taxidj_error('RIDE_NOT_FOUND'); end if;

  select * into v_passenger from public.passengers
   where ride_id = v_ride.id and session_identifier = v_uid;
  if not found then perform public.taxidj_error('NOT_A_PASSENGER'); end if;

  if v_ride.status = 'ended' then perform public.taxidj_error('RIDE_ENDED'); end if;
  if v_ride.expires_at <= now() then perform public.taxidj_error('RIDE_EXPIRED'); end if;

  if p_video_id is null or p_video_id !~ '^[A-Za-z0-9_-]{11}$' then
    perform public.taxidj_error('INVALID_VIDEO');
  end if;

  if p_spotify_track_id is not null and p_spotify_track_id !~ '^[A-Za-z0-9]{22}$' then
    perform public.taxidj_error('INVALID_VIDEO');
  end if;

  v_source := case when p_source = 'youtube_music' then 'youtube_music' else 'youtube' end;

  -- Rejected/removed requests don't count toward the limit.
  select count(*) into v_used from public.song_requests
   where passenger_id = v_passenger.id and status not in ('rejected', 'removed');
  if v_used >= v_ride.max_requests_per_passenger then
    perform public.taxidj_error('REQUEST_LIMIT_REACHED');
  end if;

  if exists (
    select 1 from public.song_requests
     where ride_id = v_ride.id and youtube_video_id = p_video_id
       and status in ('pending', 'queued', 'playing')
  ) then
    perform public.taxidj_error('DUPLICATE_REQUEST');
  end if;

  insert into public.song_requests (
    ride_id, passenger_id, title, artist, thumbnail_url, youtube_url,
    youtube_video_id, source, duration_seconds, status, position,
    spotify_track_id, spotify_url
  ) values (
    v_ride.id,
    v_passenger.id,
    coalesce(v_title, 'YouTube video'),
    v_artist,
    'https://i.ytimg.com/vi/' || p_video_id || '/hqdefault.jpg',
    case v_source
      when 'youtube_music' then 'https://music.youtube.com/watch?v=' || p_video_id
      else 'https://www.youtube.com/watch?v=' || p_video_id
    end,
    p_video_id,
    v_source,
    case when p_duration_seconds between 0 and 86400 then p_duration_seconds end,
    case when v_ride.auto_approve then 'queued'::public.request_status else 'pending' end,
    (select coalesce(max(position), 0) + 1 from public.song_requests where ride_id = v_ride.id),
    p_spotify_track_id,
    case when p_spotify_track_id is not null then 'https://open.spotify.com/track/' || p_spotify_track_id end
  )
  returning * into v_req;

  return v_req;
end;
$$;

create function public.driver_add_song(
  p_ride_id uuid,
  p_video_id text,
  p_title text,
  p_artist text default null,
  p_duration_seconds integer default null,
  p_source text default 'youtube',
  p_spotify_track_id text default null
) returns public.song_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_ride public.rides;
  v_passenger public.passengers;
  v_source public.request_source;
  v_title text := left(nullif(btrim(regexp_replace(coalesce(p_title, ''), '[[:cntrl:]]', '', 'g')), ''), 200);
  v_artist text := left(nullif(btrim(regexp_replace(coalesce(p_artist, ''), '[[:cntrl:]]', '', 'g')), ''), 120);
  v_req public.song_requests;
begin
  if v_uid is null then perform public.taxidj_error('NOT_AUTHENTICATED'); end if;

  select * into v_ride from public.rides
   where id = p_ride_id and driver_id = v_uid
   for update;
  if not found then perform public.taxidj_error('RIDE_NOT_FOUND'); end if;
  if not public.ride_is_open(v_ride) then perform public.taxidj_error('RIDE_ENDED'); end if;

  if p_video_id is null or p_video_id !~ '^[A-Za-z0-9_-]{11}$' then
    perform public.taxidj_error('INVALID_VIDEO');
  end if;

  if p_spotify_track_id is not null and p_spotify_track_id !~ '^[A-Za-z0-9]{22}$' then
    perform public.taxidj_error('INVALID_VIDEO');
  end if;

  if exists (
    select 1 from public.song_requests
     where ride_id = v_ride.id and youtube_video_id = p_video_id
       and status in ('pending', 'queued', 'playing')
  ) then
    perform public.taxidj_error('DUPLICATE_REQUEST');
  end if;

  select * into v_passenger from public.passengers
   where ride_id = v_ride.id and session_identifier = v_uid;
  if not found then
    insert into public.passengers (ride_id, session_identifier, nickname)
    values (v_ride.id, v_uid, 'Driver')
    returning * into v_passenger;
  end if;

  v_source := case when p_source = 'youtube_music' then 'youtube_music' else 'youtube' end;

  insert into public.song_requests (
    ride_id, passenger_id, title, artist, thumbnail_url, youtube_url,
    youtube_video_id, source, duration_seconds, status, position,
    spotify_track_id, spotify_url
  ) values (
    v_ride.id,
    v_passenger.id,
    coalesce(v_title, 'YouTube video'),
    v_artist,
    'https://i.ytimg.com/vi/' || p_video_id || '/hqdefault.jpg',
    case v_source
      when 'youtube_music' then 'https://music.youtube.com/watch?v=' || p_video_id
      else 'https://www.youtube.com/watch?v=' || p_video_id
    end,
    p_video_id,
    v_source,
    case when p_duration_seconds between 0 and 86400 then p_duration_seconds end,
    'queued',
    (select coalesce(max(position), 0) + 1 from public.song_requests where ride_id = v_ride.id),
    p_spotify_track_id,
    case when p_spotify_track_id is not null then 'https://open.spotify.com/track/' || p_spotify_track_id end
  )
  returning * into v_req;

  return v_req;
end;
$$;

revoke execute on function
  public.add_song_request(uuid, text, text, text, integer, text, text),
  public.driver_add_song(uuid, text, text, text, integer, text, text)
from public, anon, authenticated;
grant execute on function
  public.add_song_request(uuid, text, text, text, integer, text, text),
  public.driver_add_song(uuid, text, text, text, integer, text, text)
to authenticated;
