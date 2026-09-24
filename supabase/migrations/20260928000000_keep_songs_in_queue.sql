-- =============================================================================
-- Taxi DJ — songs stay in the ride's queue until removed or the ride ends
--
-- * Sending songs to YouTube no longer marks earlier songs as played; every
--   song stays in the list (with its status) for the whole ride.
-- * Drivers can remove any song (waiting, playing or played) from the list.
--   Passengers can still remove their own songs that haven't played yet.
-- =============================================================================

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

create or replace function public.driver_send_to_youtube(p_ride_id uuid, p_request_ids uuid[])
returns setof public.song_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_ride public.rides;
  v_first uuid := p_request_ids[1];
begin
  select * into v_ride from public.rides
   where id = p_ride_id and driver_id = auth.uid()
   for update;
  if not found then perform public.taxidj_error('RIDE_NOT_FOUND'); end if;
  if not public.ride_is_open(v_ride) then perform public.taxidj_error('RIDE_ENDED'); end if;

  -- Any song still in the ride's list can be sent (including played ones,
  -- for "play the whole ride playlist").
  if v_first is null or exists (
    select 1 from unnest(p_request_ids) as ids(id)
     where not exists (
       select 1 from public.song_requests r
        where r.id = ids.id and r.ride_id = p_ride_id
          and r.status in ('pending', 'queued', 'playing', 'played')
     )
  ) then
    perform public.taxidj_error('INVALID_TRANSITION');
  end if;

  update public.song_requests
     set sent_to_youtube_at = now()
   where id = any (p_request_ids);

  -- The first song of the batch is now playing (only one can play at once).
  if (select status from public.song_requests where id = v_first) <> 'playing' then
    update public.song_requests set status = 'played'
     where ride_id = p_ride_id and status = 'playing';
    update public.song_requests set status = 'playing', started_at = now()
     where id = v_first;
  end if;

  return query
    select * from public.song_requests
     where id = any (p_request_ids)
     order by array_position(p_request_ids, id);
end;
$$;
