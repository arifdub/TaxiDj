-- =============================================================================
-- Taxi DJ — database schema
--
-- Design notes
-- * Every table has Row Level Security enabled. Clients (browser, future
--   native iOS/CarPlay app) get SELECT access only; every write goes through
--   the SECURITY DEFINER functions below, which validate ride state,
--   membership, request limits, YouTube IDs and status transitions.
-- * Drivers and passengers are both Supabase Auth users. Passengers use
--   anonymous sign-in, so no account is ever required to join a ride.
-- * Only YouTube video IDs + display metadata are stored. The canonical
--   YouTube URL and thumbnail URL are derived server-side from the validated
--   video ID, never taken from the client.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.ride_status as enum ('active', 'ended');

create type public.request_status as enum (
  'pending',   -- waiting for the driver to approve
  'queued',    -- approved, waiting to play
  'playing',   -- currently playing
  'played',    -- finished
  'rejected',  -- declined by the driver
  'removed'    -- removed from the queue by the driver
);

create type public.request_source as enum ('youtube', 'youtube_music');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.drivers (
  id                          uuid primary key references auth.users (id) on delete cascade,
  email                       text,
  display_name                text not null default 'My Taxi'
                                check (char_length(display_name) between 1 and 40),
  auto_approve                boolean not null default true,
  max_requests_per_passenger  integer not null default 3
                                check (max_requests_per_passenger between 1 and 10),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

create table public.rides (
  id                          uuid primary key default gen_random_uuid(),
  driver_id                   uuid not null references public.drivers (id) on delete cascade,
  join_code                   text not null unique
                                check (join_code ~ '^[A-HJ-NP-Z2-9]{5}$'),
  name                        text not null,
  status                      public.ride_status not null default 'active',
  -- Snapshot of the driver's settings when the ride started.
  max_requests_per_passenger  integer not null default 3
                                check (max_requests_per_passenger between 1 and 10),
  auto_approve                boolean not null default true,
  created_at                  timestamptz not null default now(),
  expires_at                  timestamptz not null default now() + interval '12 hours',
  ended_at                    timestamptz,
  check ((status = 'ended') = (ended_at is not null))
);

-- A driver can only have one active ride at a time.
create unique index rides_one_active_per_driver
  on public.rides (driver_id) where status = 'active';
create index rides_driver_created_idx on public.rides (driver_id, created_at desc);
create index rides_status_idx on public.rides (status);

create table public.passengers (
  id                  uuid primary key default gen_random_uuid(),
  ride_id             uuid not null references public.rides (id) on delete cascade,
  -- auth.uid() of the passenger's (anonymous) Supabase session.
  session_identifier  uuid not null references auth.users (id) on delete cascade,
  nickname            text not null check (char_length(nickname) between 1 and 30),
  created_at          timestamptz not null default now(),
  unique (ride_id, session_identifier)
);

create index passengers_ride_id_idx on public.passengers (ride_id);
create index passengers_session_idx on public.passengers (session_identifier);

create table public.song_requests (
  id                uuid primary key default gen_random_uuid(),
  ride_id           uuid not null references public.rides (id) on delete cascade,
  passenger_id      uuid not null references public.passengers (id) on delete cascade,
  title             text not null check (char_length(title) between 1 and 200),
  artist            text check (char_length(artist) <= 120),
  thumbnail_url     text not null,
  youtube_url       text not null,
  youtube_video_id  text not null check (youtube_video_id ~ '^[A-Za-z0-9_-]{11}$'),
  source            public.request_source not null default 'youtube',
  duration_seconds  integer check (duration_seconds is null or duration_seconds between 0 and 86400),
  status            public.request_status not null default 'pending',
  position          integer not null,
  started_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index song_requests_ride_id_idx on public.song_requests (ride_id);
create index song_requests_status_idx on public.song_requests (status);
create index song_requests_ride_position_idx on public.song_requests (ride_id, position);
create index song_requests_created_at_idx on public.song_requests (created_at);
create index song_requests_passenger_idx on public.song_requests (passenger_id);

-- Only one song can be playing per ride.
create unique index song_requests_one_playing_per_ride
  on public.song_requests (ride_id) where status = 'playing';

-- The same video cannot be waiting/playing twice in the same ride.
create unique index song_requests_no_active_duplicates
  on public.song_requests (ride_id, youtube_video_id)
  where status in ('pending', 'queued', 'playing');

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger drivers_set_updated_at before update on public.drivers
  for each row execute function public.set_updated_at();
create trigger song_requests_set_updated_at before update on public.song_requests
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Membership helpers (used by RLS policies)
-- SECURITY DEFINER so policies don't recurse through each other's RLS.
-- ---------------------------------------------------------------------------
create function public.is_ride_driver(p_ride_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.rides r
    where r.id = p_ride_id and r.driver_id = auth.uid()
  );
$$;

create function public.is_ride_passenger(p_ride_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.passengers p
    where p.ride_id = p_ride_id and p.session_identifier = auth.uid()
  );
$$;

create function public.ride_is_open(r public.rides) returns boolean
language sql stable set search_path = '' as $$
  select r.status = 'active' and r.expires_at > now();
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.drivers enable row level security;
alter table public.rides enable row level security;
alter table public.passengers enable row level security;
alter table public.song_requests enable row level security;

-- Clients may only read. All writes go through the functions below.
revoke all on public.drivers, public.rides, public.passengers, public.song_requests
  from anon, authenticated;
grant select on public.drivers, public.rides, public.passengers, public.song_requests
  to authenticated;

create policy "Drivers read their own profile"
  on public.drivers for select to authenticated
  using (id = auth.uid());

create policy "Drivers read own rides; passengers read joined ride"
  on public.rides for select to authenticated
  using (driver_id = auth.uid() or public.is_ride_passenger(id));

create policy "Passengers read themselves; drivers read their riders"
  on public.passengers for select to authenticated
  using (session_identifier = auth.uid() or public.is_ride_driver(ride_id));

create policy "Ride members read the ride's queue"
  on public.song_requests for select to authenticated
  using (public.is_ride_driver(ride_id) or public.is_ride_passenger(ride_id));

-- ---------------------------------------------------------------------------
-- Error helper: raise a stable, machine-readable error code the client maps
-- to a friendly message.
-- ---------------------------------------------------------------------------
create function public.taxidj_error(p_code text) returns void
language plpgsql as $$
begin
  raise exception using errcode = 'P0001', message = p_code;
end;
$$;

-- ---------------------------------------------------------------------------
-- DRIVER functions
-- ---------------------------------------------------------------------------

-- Creates (or returns) the driver profile for the signed-in user.
create function public.ensure_driver() returns public.drivers
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_driver public.drivers;
begin
  if v_uid is null then perform public.taxidj_error('NOT_AUTHENTICATED'); end if;

  insert into public.drivers (id, email)
  values (v_uid, nullif(auth.jwt() ->> 'email', ''))
  on conflict (id) do update
    set email = coalesce(excluded.email, public.drivers.email)
  returning * into v_driver;

  return v_driver;
end;
$$;

create function public.update_driver_settings(
  p_display_name text,
  p_auto_approve boolean,
  p_max_requests_per_passenger integer
) returns public.drivers
language plpgsql security definer set search_path = '' as $$
declare
  v_driver public.drivers;
  v_name text := btrim(coalesce(p_display_name, ''));
begin
  perform public.ensure_driver();

  if char_length(v_name) < 1 or char_length(v_name) > 40 then
    perform public.taxidj_error('INVALID_DISPLAY_NAME');
  end if;
  if p_max_requests_per_passenger is null
     or p_max_requests_per_passenger not between 1 and 10 then
    perform public.taxidj_error('INVALID_REQUEST_LIMIT');
  end if;

  update public.drivers
     set display_name = v_name,
         auto_approve = coalesce(p_auto_approve, auto_approve),
         max_requests_per_passenger = p_max_requests_per_passenger
   where id = auth.uid()
  returning * into v_driver;

  return v_driver;
end;
$$;

-- Starts a ride, or returns the driver's ride that is already active.
create function public.start_ride() returns public.rides
language plpgsql security definer set search_path = '' as $$
declare
  v_driver public.drivers;
  v_ride public.rides;
  v_code text;
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_attempt integer := 0;
begin
  v_driver := public.ensure_driver();

  -- Serialise concurrent "start ride" taps for the same driver.
  perform 1 from public.drivers where id = v_driver.id for update;

  select * into v_ride from public.rides
   where driver_id = v_driver.id and status = 'active';

  if found then
    if v_ride.expires_at > now() then
      return v_ride;
    end if;
    update public.rides set status = 'ended', ended_at = now() where id = v_ride.id;
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := '';
    for i in 1..5 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;

    begin
      insert into public.rides (driver_id, join_code, name, max_requests_per_passenger, auto_approve)
      values (v_driver.id, v_code, v_driver.display_name,
              v_driver.max_requests_per_passenger, v_driver.auto_approve)
      returning * into v_ride;
      return v_ride;
    exception when unique_violation then
      if v_attempt >= 20 then perform public.taxidj_error('CODE_GENERATION_FAILED'); end if;
    end;
  end loop;
end;
$$;

create function public.end_ride(p_ride_id uuid) returns public.rides
language plpgsql security definer set search_path = '' as $$
declare
  v_ride public.rides;
begin
  select * into v_ride from public.rides
   where id = p_ride_id and driver_id = auth.uid()
   for update;
  if not found then perform public.taxidj_error('RIDE_NOT_FOUND'); end if;

  if v_ride.status = 'active' then
    update public.song_requests set status = 'played'
     where ride_id = p_ride_id and status = 'playing';
    update public.rides set status = 'ended', ended_at = now()
     where id = p_ride_id
    returning * into v_ride;
  end if;

  return v_ride;
end;
$$;

-- Applies a driver action to a single request, enforcing valid transitions.
--   approve   pending            -> queued
--   reject    pending            -> rejected
--   remove    pending|queued     -> removed
--   play      pending|queued|played -> playing (current song -> played)
--   finish    playing            -> played
--   move_up / move_down          swap position with the neighbouring
--                                waiting (pending|queued) request
create function public.driver_update_request(p_request_id uuid, p_action text)
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
      if v_req.status not in ('pending', 'queued') then perform public.taxidj_error('INVALID_TRANSITION'); end if;
      update public.song_requests set status = 'removed' where id = v_req.id returning * into v_req;

    when 'play' then
      if v_req.status not in ('pending', 'queued', 'played') then
        perform public.taxidj_error('INVALID_TRANSITION');
      end if;
      if v_req.status = 'played' and exists (
        select 1 from public.song_requests
         where ride_id = v_req.ride_id and youtube_video_id = v_req.youtube_video_id
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

-- Skips to the next/previous song in the ride.
--   next:     playing -> played, first queued song -> playing
--   previous: playing -> queued (back to the top of the queue),
--             most recently played song -> playing
-- Returns the song now playing, or NULL when nothing is left.
create function public.driver_skip(p_ride_id uuid, p_direction text)
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
       and youtube_video_id is distinct from v_current.youtube_video_id
       and not exists (
         select 1 from public.song_requests d
          where d.ride_id = p_ride_id and d.youtube_video_id = song_requests.youtube_video_id
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

-- Ride history with aggregate counts for the signed-in driver.
create function public.driver_ride_history(p_limit integer default 50)
returns table (
  id uuid,
  join_code text,
  name text,
  status public.ride_status,
  created_at timestamptz,
  ended_at timestamptz,
  expires_at timestamptz,
  passenger_count bigint,
  song_count bigint,
  played_count bigint
)
language sql stable security definer set search_path = '' as $$
  select r.id, r.join_code, r.name, r.status, r.created_at, r.ended_at, r.expires_at,
         (select count(*) from public.passengers p where p.ride_id = r.id),
         (select count(*) from public.song_requests s where s.ride_id = r.id),
         (select count(*) from public.song_requests s where s.ride_id = r.id and s.status = 'played')
    from public.rides r
   where r.driver_id = auth.uid()
   order by r.created_at desc
   limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

-- ---------------------------------------------------------------------------
-- PASSENGER functions
-- ---------------------------------------------------------------------------

-- Public lookup used by the join page before the passenger has joined.
-- Exposes only what the join screen needs.
create function public.get_ride_by_code(p_code text)
returns table (
  id uuid,
  join_code text,
  name text,
  state text  -- 'active' | 'ended' | 'expired'
)
language sql stable security definer set search_path = '' as $$
  select r.id, r.join_code, r.name,
         case
           when r.status = 'ended' then 'ended'
           when r.expires_at <= now() then 'expired'
           else 'active'
         end
    from public.rides r
   where r.join_code = upper(btrim(p_code));
$$;

create function public.join_ride(p_code text, p_nickname text default null)
returns public.passengers
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_ride public.rides;
  v_passenger public.passengers;
  v_nickname text := nullif(btrim(coalesce(p_nickname, '')), '');
begin
  if v_uid is null then perform public.taxidj_error('NOT_AUTHENTICATED'); end if;

  select * into v_ride from public.rides where join_code = upper(btrim(p_code)) for update;
  if not found then perform public.taxidj_error('RIDE_NOT_FOUND'); end if;
  if v_ride.status = 'ended' then perform public.taxidj_error('RIDE_ENDED'); end if;
  if v_ride.expires_at <= now() then perform public.taxidj_error('RIDE_EXPIRED'); end if;

  if v_nickname is not null and char_length(v_nickname) > 30 then
    v_nickname := left(v_nickname, 30);
  end if;

  select * into v_passenger from public.passengers
   where ride_id = v_ride.id and session_identifier = v_uid;

  if found then
    if v_nickname is not null and v_nickname <> v_passenger.nickname then
      update public.passengers set nickname = v_nickname
       where id = v_passenger.id returning * into v_passenger;
    end if;
    return v_passenger;
  end if;

  if v_nickname is null then
    select 'Passenger ' || (count(*) + 1) into v_nickname
      from public.passengers where ride_id = v_ride.id;
  end if;

  insert into public.passengers (ride_id, session_identifier, nickname)
  values (v_ride.id, v_uid, v_nickname)
  returning * into v_passenger;

  return v_passenger;
end;
$$;

-- Adds a YouTube video to the ride's queue for the calling passenger.
create function public.add_song_request(
  p_ride_id uuid,
  p_video_id text,
  p_title text,
  p_artist text default null,
  p_duration_seconds integer default null,
  p_source text default 'youtube'
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
    youtube_video_id, source, duration_seconds, status, position
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
    (select coalesce(max(position), 0) + 1 from public.song_requests where ride_id = v_ride.id)
  )
  returning * into v_req;

  return v_req;
end;
$$;

-- ---------------------------------------------------------------------------
-- Function privileges: nothing is executable unless granted here.
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.get_ride_by_code(text) to anon, authenticated;

grant execute on function
  public.is_ride_driver(uuid),
  public.is_ride_passenger(uuid),
  public.ensure_driver(),
  public.update_driver_settings(text, boolean, integer),
  public.start_ride(),
  public.end_ride(uuid),
  public.driver_update_request(uuid, text),
  public.driver_skip(uuid, text),
  public.driver_ride_history(integer),
  public.join_ride(text, text),
  public.add_song_request(uuid, text, text, text, integer, text)
to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: broadcast row changes (RLS is applied per subscriber).
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.rides, public.passengers, public.song_requests;
  end if;
end;
$$;
