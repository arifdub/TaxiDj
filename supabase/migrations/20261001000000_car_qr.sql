-- =============================================================================
-- Taxi DJ — permanent car QR code + removing passengers
--
-- Car QR code
-- * Each driver gets a permanent car_code (8 characters). A printed QR code
--   for /c/<car_code> always leads to the driver's ride that is running now.
-- * resolve_car_code() is public: it returns the current ride's join code,
--   or "no_ride" when the driver has no ride running. Every ride still has
--   its own join code, and an ended ride can't be joined or added to.
-- * reset_car_code() gives the driver a new code; old printed cards stop
--   working.
--
-- Removing passengers
-- * driver_remove_passenger() removes someone from the ride (e.g. a former
--   passenger who kept the car QR code): their waiting songs are removed and
--   they can't add songs, see the ride, or join it again.
-- =============================================================================

alter table public.drivers
  add column car_code text unique check (car_code ~ '^[A-HJ-NP-Z2-9]{8}$');

alter table public.passengers add column removed_at timestamptz;

-- ---------------------------------------------------------------------------
-- Car code
-- ---------------------------------------------------------------------------

create function public.new_car_code() returns text
language plpgsql volatile set search_path = '' as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text := '';
begin
  for i in 1..8 loop
    v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
  end loop;
  return v_code;
end;
$$;

-- Returns the driver's car code, creating it on first use (or always a new
-- one when p_reset is true).
create function public.driver_car_code(p_reset boolean default false) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_driver public.drivers;
  v_attempt integer := 0;
begin
  v_driver := public.ensure_driver();
  if v_driver.car_code is not null and not coalesce(p_reset, false) then
    return v_driver.car_code;
  end if;
  loop
    v_attempt := v_attempt + 1;
    begin
      update public.drivers set car_code = public.new_car_code()
       where id = v_driver.id
      returning * into v_driver;
      return v_driver.car_code;
    exception when unique_violation then
      if v_attempt >= 20 then perform public.taxidj_error('CODE_GENERATION_FAILED'); end if;
    end;
  end loop;
end;
$$;

-- Public: where does this car's QR code lead right now?
--   state 'active'  → join_code of the ride running now
--   state 'no_ride' → the driver has no ride running
--   no row          → unknown / replaced code
create function public.resolve_car_code(p_code text)
returns table (state text, join_code text, name text)
language sql stable security definer set search_path = '' as $$
  select case when r.id is null then 'no_ride' else 'active' end,
         r.join_code,
         coalesce(r.name, d.display_name)
    from public.drivers d
    left join public.rides r
      on r.driver_id = d.id and r.status = 'active' and r.expires_at > now()
   where d.car_code = upper(btrim(p_code))
   limit 1;
$$;

-- ---------------------------------------------------------------------------
-- Removing passengers
-- ---------------------------------------------------------------------------

-- Removed passengers no longer count as ride members (reading the ride and
-- its queue).
create or replace function public.is_ride_passenger(p_ride_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.passengers p
    where p.ride_id = p_ride_id and p.session_identifier = auth.uid() and p.removed_at is null
  );
$$;

-- Removed passengers can't add songs (covers every insert path).
create function public.song_requests_block_removed() returns trigger
language plpgsql set search_path = '' as $$
begin
  if exists (select 1 from public.passengers where id = new.passenger_id and removed_at is not null) then
    perform public.taxidj_error('PASSENGER_REMOVED');
  end if;
  return new;
end;
$$;

create trigger song_requests_block_removed
  before insert on public.song_requests
  for each row execute function public.song_requests_block_removed();

create function public.driver_remove_passenger(p_passenger_id uuid) returns public.passengers
language plpgsql security definer set search_path = '' as $$
declare
  v_passenger public.passengers;
  v_ride public.rides;
begin
  select * into v_passenger from public.passengers where id = p_passenger_id;
  if not found then perform public.taxidj_error('PASSENGER_NOT_FOUND'); end if;

  select * into v_ride from public.rides
   where id = v_passenger.ride_id and driver_id = auth.uid()
   for update;
  if not found then perform public.taxidj_error('PASSENGER_NOT_FOUND'); end if;
  -- The driver's own row (songs the driver added) can't be removed.
  if v_passenger.session_identifier = v_ride.driver_id then
    perform public.taxidj_error('INVALID_ACTION');
  end if;

  update public.passengers set removed_at = coalesce(removed_at, now())
   where id = v_passenger.id
  returning * into v_passenger;

  -- Their songs that haven't played yet leave the queue.
  update public.song_requests set status = 'removed'
   where passenger_id = v_passenger.id and status in ('pending', 'queued');

  return v_passenger;
end;
$$;

-- join_ride: unchanged, except a removed passenger can't join again.
create or replace function public.join_ride(p_code text, p_nickname text default null)
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
    if v_passenger.removed_at is not null then
      perform public.taxidj_error('PASSENGER_REMOVED');
    end if;
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

revoke execute on function
  public.new_car_code(),
  public.driver_car_code(boolean),
  public.resolve_car_code(text),
  public.driver_remove_passenger(uuid),
  public.song_requests_block_removed()
from public, anon, authenticated;

grant execute on function public.driver_car_code(boolean), public.driver_remove_passenger(uuid) to authenticated;
-- Anyone who scans the car QR code (before signing in) can resolve it.
grant execute on function public.resolve_car_code(text) to anon, authenticated;
