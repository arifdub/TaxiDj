-- =============================================================================
-- Taxi DJ — passengers can remove their own songs; 10-song default limit
--
-- * passenger_remove_request(): a passenger removes one of their own songs
--   that hasn't played yet. Removed songs don't count toward the limit, so
--   the passenger can pick something else.
-- * removed_by records who removed a song ('passenger' or 'driver'; NULL for
--   rows removed by the driver before this migration).
-- * Default per-passenger limit raised from 3 to 10 for new drivers/rides.
--   Existing drivers keep their chosen setting (Settings → Max songs).
--
-- Replays need no new function: a passenger re-requests a played song via
-- add_song_request, which already enforces the limit and duplicate rules.
-- =============================================================================

alter table public.song_requests
  add column removed_by text check (removed_by in ('passenger', 'driver'));

alter table public.drivers alter column max_requests_per_passenger set default 10;
alter table public.rides alter column max_requests_per_passenger set default 10;

-- Mark driver removals too, so the passenger UI can tell them apart.
create function public.song_requests_mark_driver_removal() returns trigger
language plpgsql as $$
begin
  if new.status = 'removed' and old.status <> 'removed' and new.removed_by is null then
    new.removed_by := 'driver';
  end if;
  return new;
end;
$$;

create trigger song_requests_mark_driver_removal
  before update of status on public.song_requests
  for each row execute function public.song_requests_mark_driver_removal();

create function public.passenger_remove_request(p_request_id uuid)
returns public.song_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_req public.song_requests;
  v_ride public.rides;
begin
  if v_uid is null then perform public.taxidj_error('NOT_AUTHENTICATED'); end if;

  select r.* into v_req
    from public.song_requests r
    join public.passengers p on p.id = r.passenger_id
   where r.id = p_request_id and p.session_identifier = v_uid;
  if not found then perform public.taxidj_error('REQUEST_NOT_FOUND'); end if;

  -- Same lock as the driver's queue changes, so they can't race.
  select * into v_ride from public.rides where id = v_req.ride_id for update;
  if not public.ride_is_open(v_ride) then perform public.taxidj_error('RIDE_ENDED'); end if;

  select * into v_req from public.song_requests where id = p_request_id;
  if v_req.status not in ('pending', 'queued') then
    perform public.taxidj_error('INVALID_TRANSITION');
  end if;

  update public.song_requests
     set status = 'removed', removed_by = 'passenger'
   where id = v_req.id
  returning * into v_req;

  return v_req;
end;
$$;

revoke execute on function public.passenger_remove_request(uuid) from public, anon, authenticated;
grant execute on function public.passenger_remove_request(uuid) to authenticated;
revoke execute on function public.song_requests_mark_driver_removal() from public, anon, authenticated;
