-- =============================================================================
-- Taxi DJ — audio file links (Google Drive, Dropbox or any https audio file)
--
-- * song_requests.provider gains 'audio': the song is an audio file the
--   driver or a passenger keeps online. audio_url is the file's address; the
--   driver's phone plays it directly in a plain audio player (like the
--   radio). Nothing is uploaded to or stored by Taxi DJ.
-- * add_audio_link_request() / driver_add_audio_link(): same rules as other
--   songs (limits, approval, duplicates, ride open).
-- * song_media_key() also knows audio links ("same song" = same address).
-- =============================================================================

alter table public.song_requests add column if not exists audio_url text;

alter table public.song_requests drop constraint if exists song_requests_provider_check;
alter table public.song_requests add constraint song_requests_provider_check
  check (provider in ('youtube', 'soundcloud', 'audio'));

-- A secure, public web address: https, no spaces, not the phone itself or a
-- home/office network, at most 2000 bytes.
create or replace function public.audio_link_ok(p_url text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(
    octet_length(p_url) <= 2000
    and p_url ~* '^https://[a-z0-9.-]+\.[a-z0-9-]+(:[0-9]{1,5})?/[^[:space:]]*$'
    and p_url !~* '^https://(localhost|0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.)'
    and p_url !~* '^https://[^/]*\.(local|localhost|internal|lan|home|intranet)(:[0-9]+)?/',
    false);
$$;

alter table public.song_requests drop constraint if exists song_requests_media_check;
alter table public.song_requests add constraint song_requests_media_check check (
  (provider = 'youtube' and youtube_video_id is not null and youtube_url is not null)
  or (
    provider = 'soundcloud'
    and youtube_video_id is null
    and soundcloud_track_id ~ '^[0-9]{1,20}$'
    and soundcloud_url ~ '^https://soundcloud\.com/[^[:space:]]+$'
  )
  or (
    provider = 'audio'
    and youtube_video_id is null
    and soundcloud_track_id is null
    and public.audio_link_ok(audio_url)
  )
);

create unique index if not exists song_requests_no_active_audio_duplicates
  on public.song_requests (ride_id, audio_url)
  where status in ('pending', 'queued', 'playing') and audio_url is not null;

create or replace function public.song_media_key(r public.song_requests) returns text
language sql immutable set search_path = '' as $$
  select case r.provider
    when 'soundcloud' then 'sc:' || r.soundcloud_track_id
    when 'audio' then 'au:' || r.audio_url
    else 'yt:' || r.youtube_video_id
  end;
$$;

create or replace function public.add_audio_link_request(
  p_ride_id uuid,
  p_url text,
  p_title text,
  p_artist text default null,
  p_duration_seconds integer default null
) returns public.song_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_ride public.rides;
  v_passenger public.passengers;
  v_used integer;
  v_title text := left(nullif(btrim(regexp_replace(coalesce(p_title, ''), '[[:cntrl:]]', '', 'g')), ''), 200);
  v_artist text := left(nullif(btrim(regexp_replace(coalesce(p_artist, ''), '[[:cntrl:]]', '', 'g')), ''), 120);
  v_req public.song_requests;
begin
  if v_uid is null then perform public.taxidj_error('NOT_AUTHENTICATED'); end if;

  select * into v_ride from public.rides where id = p_ride_id for update;
  if not found then perform public.taxidj_error('RIDE_NOT_FOUND'); end if;

  select * into v_passenger from public.passengers
   where ride_id = v_ride.id and session_identifier = v_uid;
  if not found then perform public.taxidj_error('NOT_A_PASSENGER'); end if;

  if v_ride.status = 'ended' then perform public.taxidj_error('RIDE_ENDED'); end if;
  if v_ride.expires_at <= now() then perform public.taxidj_error('RIDE_EXPIRED'); end if;
  if not public.audio_link_ok(p_url) then perform public.taxidj_error('INVALID_VIDEO'); end if;

  select count(*) into v_used from public.song_requests
   where passenger_id = v_passenger.id and status not in ('rejected', 'removed');
  if v_used >= v_ride.max_requests_per_passenger then
    perform public.taxidj_error('REQUEST_LIMIT_REACHED');
  end if;

  if exists (
    select 1 from public.song_requests
     where ride_id = v_ride.id and audio_url = p_url
       and status in ('pending', 'queued', 'playing')
  ) then
    perform public.taxidj_error('DUPLICATE_REQUEST');
  end if;

  insert into public.song_requests (
    ride_id, passenger_id, title, artist, thumbnail_url, youtube_url, youtube_video_id,
    provider, audio_url, duration_seconds, status, position
  ) values (
    v_ride.id, v_passenger.id, coalesce(v_title, 'Audio file'), v_artist,
    '/icons/512', null, null,
    'audio', p_url, case when p_duration_seconds between 0 and 86400 then p_duration_seconds end,
    case when v_ride.auto_approve then 'queued'::public.request_status else 'pending' end,
    (select coalesce(max(position), 0) + 1 from public.song_requests where ride_id = v_ride.id)
  )
  returning * into v_req;
  return v_req;
end;
$$;

create or replace function public.driver_add_audio_link(
  p_ride_id uuid,
  p_url text,
  p_title text,
  p_artist text default null,
  p_duration_seconds integer default null
) returns public.song_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_ride public.rides;
  v_passenger public.passengers;
  v_title text := left(nullif(btrim(regexp_replace(coalesce(p_title, ''), '[[:cntrl:]]', '', 'g')), ''), 200);
  v_artist text := left(nullif(btrim(regexp_replace(coalesce(p_artist, ''), '[[:cntrl:]]', '', 'g')), ''), 120);
  v_req public.song_requests;
begin
  if v_uid is null then perform public.taxidj_error('NOT_AUTHENTICATED'); end if;

  select * into v_ride from public.rides where id = p_ride_id and driver_id = v_uid for update;
  if not found then perform public.taxidj_error('RIDE_NOT_FOUND'); end if;
  if not public.ride_is_open(v_ride) then perform public.taxidj_error('RIDE_ENDED'); end if;
  if not public.audio_link_ok(p_url) then perform public.taxidj_error('INVALID_VIDEO'); end if;

  if exists (
    select 1 from public.song_requests
     where ride_id = v_ride.id and audio_url = p_url
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

  insert into public.song_requests (
    ride_id, passenger_id, title, artist, thumbnail_url, youtube_url, youtube_video_id,
    provider, audio_url, duration_seconds, status, position
  ) values (
    v_ride.id, v_passenger.id, coalesce(v_title, 'Audio file'), v_artist,
    '/icons/512', null, null,
    'audio', p_url, case when p_duration_seconds between 0 and 86400 then p_duration_seconds end,
    'queued',
    (select coalesce(max(position), 0) + 1 from public.song_requests where ride_id = v_ride.id)
  )
  returning * into v_req;
  return v_req;
end;
$$;

revoke execute on function
  public.add_audio_link_request(uuid, text, text, text, integer),
  public.driver_add_audio_link(uuid, text, text, text, integer)
from public, anon, authenticated;
grant execute on function
  public.add_audio_link_request(uuid, text, text, text, integer),
  public.driver_add_audio_link(uuid, text, text, text, integer)
to authenticated;
