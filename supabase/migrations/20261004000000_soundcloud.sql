-- =============================================================================
-- Taxi DJ — SoundCloud songs (play like the radio: plain audio, background)
--
-- * song_requests.provider: 'youtube' (default, as before) or 'soundcloud'.
--   SoundCloud songs have soundcloud_track_id + soundcloud_url and no
--   YouTube video; they're streamed in the browser from SoundCloud's own
--   stream URL at play time (nothing stored or downloaded).
-- * add_soundcloud_request() / driver_add_soundcloud_song(): same rules as
--   YouTube songs (limits, approval, duplicates, ride open).
-- * song_media_key(): one identity for "same song" across providers, used
--   by duplicate checks and "previous song".
-- =============================================================================

alter table public.song_requests
  add column provider text not null default 'youtube',
  add column soundcloud_track_id text,
  add column soundcloud_url text;

alter table public.song_requests drop constraint if exists song_requests_provider_check;
alter table public.song_requests add constraint song_requests_provider_check
  check (provider in ('youtube', 'soundcloud'));

alter table public.song_requests alter column youtube_video_id drop not null;
alter table public.song_requests alter column youtube_url drop not null;

alter table public.song_requests drop constraint if exists song_requests_media_check;
alter table public.song_requests add constraint song_requests_media_check check (
  (provider = 'youtube' and youtube_video_id is not null and youtube_url is not null)
  or (
    provider = 'soundcloud'
    and youtube_video_id is null
    and soundcloud_track_id ~ '^[0-9]{1,20}$'
    and soundcloud_url ~ '^https://soundcloud\.com/[^[:space:]]+$'
  )
);

create unique index if not exists song_requests_no_active_sc_duplicates
  on public.song_requests (ride_id, soundcloud_track_id)
  where status in ('pending', 'queued', 'playing') and soundcloud_track_id is not null;

create function public.song_media_key(r public.song_requests) returns text
language sql immutable set search_path = '' as $$
  select case when r.provider = 'soundcloud' then 'sc:' || r.soundcloud_track_id else 'yt:' || r.youtube_video_id end;
$$;

-- Shared checks for a SoundCloud pick.
create function public.soundcloud_args_ok(p_track_id text, p_url text, p_artwork text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(p_track_id ~ '^[0-9]{1,20}$', false)
     and coalesce(p_url ~ '^https://soundcloud\.com/[^[:space:]]{1,250}$', false)
     and (p_artwork is null or p_artwork ~ '^https://[a-z0-9-]+\.sndcdn\.com/[^[:space:]]{1,250}$');
$$;

create function public.add_soundcloud_request(
  p_ride_id uuid,
  p_track_id text,
  p_title text,
  p_artist text default null,
  p_duration_seconds integer default null,
  p_url text default null,
  p_artwork_url text default null
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
  if not public.soundcloud_args_ok(p_track_id, p_url, p_artwork_url) then
    perform public.taxidj_error('INVALID_VIDEO');
  end if;

  select count(*) into v_used from public.song_requests
   where passenger_id = v_passenger.id and status not in ('rejected', 'removed');
  if v_used >= v_ride.max_requests_per_passenger then
    perform public.taxidj_error('REQUEST_LIMIT_REACHED');
  end if;

  if exists (
    select 1 from public.song_requests
     where ride_id = v_ride.id and soundcloud_track_id = p_track_id
       and status in ('pending', 'queued', 'playing')
  ) then
    perform public.taxidj_error('DUPLICATE_REQUEST');
  end if;

  insert into public.song_requests (
    ride_id, passenger_id, title, artist, thumbnail_url, youtube_url, youtube_video_id,
    provider, soundcloud_track_id, soundcloud_url, duration_seconds, status, position
  ) values (
    v_ride.id, v_passenger.id, coalesce(v_title, 'SoundCloud track'), v_artist,
    coalesce(p_artwork_url, '/icons/512'), null, null,
    'soundcloud', p_track_id, p_url,
    case when p_duration_seconds between 0 and 86400 then p_duration_seconds end,
    case when v_ride.auto_approve then 'queued'::public.request_status else 'pending' end,
    (select coalesce(max(position), 0) + 1 from public.song_requests where ride_id = v_ride.id)
  )
  returning * into v_req;
  return v_req;
end;
$$;

create function public.driver_add_soundcloud_song(
  p_ride_id uuid,
  p_track_id text,
  p_title text,
  p_artist text default null,
  p_duration_seconds integer default null,
  p_url text default null,
  p_artwork_url text default null
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
  if not public.soundcloud_args_ok(p_track_id, p_url, p_artwork_url) then
    perform public.taxidj_error('INVALID_VIDEO');
  end if;

  if exists (
    select 1 from public.song_requests
     where ride_id = v_ride.id and soundcloud_track_id = p_track_id
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
    provider, soundcloud_track_id, soundcloud_url, duration_seconds, status, position
  ) values (
    v_ride.id, v_passenger.id, coalesce(v_title, 'SoundCloud track'), v_artist,
    coalesce(p_artwork_url, '/icons/512'), null, null,
    'soundcloud', p_track_id, p_url,
    case when p_duration_seconds between 0 and 86400 then p_duration_seconds end,
    'queued',
    (select coalesce(max(position), 0) + 1 from public.song_requests where ride_id = v_ride.id)
  )
  returning * into v_req;
  return v_req;
end;
$$;

-- "Previous song" and the replay duplicate check now compare songs across
-- providers (otherwise unchanged).
create or replace function public.driver_skip(p_ride_id uuid, p_direction text)
returns public.song_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_ride public.rides;
  v_current public.song_requests;
  v_target public.song_requests;
  v_min_pos integer;
begin
  select * into v_ride from public.rides
   where id = p_ride_id and driver_id = auth.uid()
   for update;
  if not found then perform public.taxidj_error('RIDE_NOT_FOUND'); end if;
  if not public.ride_is_open(v_ride) then perform public.taxidj_error('RIDE_ENDED'); end if;

  select * into v_current from public.song_requests
   where ride_id = p_ride_id and status = 'playing';

  if p_direction = 'next' then
    if v_current.id is not null then
      update public.song_requests set status = 'played' where id = v_current.id;
    end if;
    select * into v_target from public.song_requests
     where ride_id = p_ride_id and status = 'queued'
     order by position asc limit 1;

  elsif p_direction = 'previous' then
    select * into v_target from public.song_requests
     where ride_id = p_ride_id and status = 'played'
       and public.song_media_key(song_requests) is distinct from public.song_media_key(v_current)
       and not exists (
         select 1 from public.song_requests d
          where d.ride_id = p_ride_id
            and public.song_media_key(d) = public.song_media_key(song_requests)
            and d.status in ('pending', 'queued')
       )
     order by coalesce(started_at, updated_at) desc limit 1;
    if v_target.id is null then
      return v_current; -- nothing to go back to
    end if;
    if v_current.id is not null then
      select coalesce(min(position), 0) into v_min_pos from public.song_requests
       where ride_id = p_ride_id and status in ('pending', 'queued');
      update public.song_requests
         set status = 'queued', started_at = null, position = least(v_min_pos, v_current.position) - 1
       where id = v_current.id;
    end if;

  else
    perform public.taxidj_error('INVALID_ACTION');
  end if;

  if v_target.id is null then
    return null;
  end if;

  update public.song_requests set status = 'playing', started_at = now()
   where id = v_target.id returning * into v_target;
  return v_target;
end;
$$;

create or replace function public.driver_update_request(p_request_id uuid, p_action text)
returns public.song_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_req public.song_requests;
  v_ride public.rides;
  v_other public.song_requests;
  v_pos integer;
begin
  select * into v_req from public.song_requests where id = p_request_id;
  if not found then perform public.taxidj_error('REQUEST_NOT_FOUND'); end if;

  -- Lock the ride: serialises all queue changes for this ride.
  select * into v_ride from public.rides
   where id = v_req.ride_id and driver_id = auth.uid()
   for update;
  if not found then perform public.taxidj_error('REQUEST_NOT_FOUND'); end if;
  if not public.ride_is_open(v_ride) then perform public.taxidj_error('RIDE_ENDED'); end if;

  -- Re-read under the ride lock.
  select * into v_req from public.song_requests where id = p_request_id;

  case p_action
    when 'approve' then
      if v_req.status <> 'pending' then perform public.taxidj_error('INVALID_TRANSITION'); end if;
      update public.song_requests set status = 'queued' where id = v_req.id returning * into v_req;

    when 'reject' then
      if v_req.status <> 'pending' then perform public.taxidj_error('INVALID_TRANSITION'); end if;
      update public.song_requests set status = 'rejected' where id = v_req.id returning * into v_req;

    when 'remove' then
      -- Drivers can remove any song from the ride's list, including played ones.
      if v_req.status not in ('pending', 'queued', 'playing', 'played') then
        perform public.taxidj_error('INVALID_TRANSITION');
      end if;
      update public.song_requests set status = 'removed' where id = v_req.id returning * into v_req;

    when 'play' then
      if v_req.status not in ('pending', 'queued', 'played') then
        perform public.taxidj_error('INVALID_TRANSITION');
      end if;
      if v_req.status = 'played' and exists (
        select 1 from public.song_requests
         where ride_id = v_req.ride_id and public.song_media_key(song_requests) = public.song_media_key(v_req)
           and status in ('pending', 'queued') and id <> v_req.id
      ) then
        perform public.taxidj_error('DUPLICATE_REQUEST');
      end if;
      update public.song_requests set status = 'played'
       where ride_id = v_req.ride_id and status = 'playing';
      update public.song_requests set status = 'playing', started_at = now()
       where id = v_req.id returning * into v_req;

    when 'finish' then
      if v_req.status <> 'playing' then perform public.taxidj_error('INVALID_TRANSITION'); end if;
      update public.song_requests set status = 'played' where id = v_req.id returning * into v_req;

    when 'move_up', 'move_down' then
      if v_req.status not in ('pending', 'queued') then perform public.taxidj_error('INVALID_TRANSITION'); end if;
      if p_action = 'move_up' then
        select * into v_other from public.song_requests
         where ride_id = v_req.ride_id and status in ('pending', 'queued')
           and position < v_req.position
         order by position desc limit 1;
      else
        select * into v_other from public.song_requests
         where ride_id = v_req.ride_id and status in ('pending', 'queued')
           and position > v_req.position
         order by position asc limit 1;
      end if;
      if found then
        v_pos := v_req.position;
        update public.song_requests set position = v_other.position where id = v_req.id
          returning * into v_req;
        update public.song_requests set position = v_pos where id = v_other.id;
      end if;

    else
      perform public.taxidj_error('INVALID_ACTION');
  end case;

  return v_req;
end;
$$;

revoke execute on function
  public.add_soundcloud_request(uuid, text, text, text, integer, text, text),
  public.driver_add_soundcloud_song(uuid, text, text, text, integer, text, text),
  public.soundcloud_args_ok(text, text, text),
  public.song_media_key(public.song_requests)
from public, anon, authenticated;
grant execute on function
  public.add_soundcloud_request(uuid, text, text, text, integer, text, text),
  public.driver_add_soundcloud_song(uuid, text, text, text, integer, text, text)
to authenticated;
