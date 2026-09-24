-- =============================================================================
-- Taxi DJ — hand songs to the YouTube / YouTube Music app in batches
--
-- YouTube apps can't be told to "add to queue" by another app, so the driver
-- sends songs as a temporary YouTube playlist. This tracks which songs were
-- already sent, so the next hand-off only sends the new ones.
--
-- driver_send_to_youtube(ride, ids):
--   * songs sent in an earlier batch (or playing) that aren't in this batch
--     are marked played — the driver sends a new batch once the previous one
--     has finished;
--   * every song in this batch gets sent_to_youtube_at = now();
--   * the first song of the batch becomes "playing", the rest stay queued.
-- =============================================================================

alter table public.song_requests add column sent_to_youtube_at timestamptz;

create function public.driver_send_to_youtube(p_ride_id uuid, p_request_ids uuid[])
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

  if v_first is null or exists (
    select 1 from unnest(p_request_ids) as ids(id)
     where not exists (
       select 1 from public.song_requests r
        where r.id = ids.id and r.ride_id = p_ride_id and r.status in ('queued', 'playing')
     )
  ) then
    perform public.taxidj_error('INVALID_TRANSITION');
  end if;

  -- The previous batch has finished playing in YouTube.
  update public.song_requests
     set status = 'played'
   where ride_id = p_ride_id
     and not (id = any (p_request_ids))
     and (status = 'playing' or (status = 'queued' and sent_to_youtube_at is not null));

  update public.song_requests
     set sent_to_youtube_at = now()
   where id = any (p_request_ids);

  update public.song_requests
     set status = 'playing', started_at = now()
   where id = v_first and status <> 'playing';

  return query
    select * from public.song_requests
     where id = any (p_request_ids)
     order by array_position(p_request_ids, id);
end;
$$;

revoke execute on function public.driver_send_to_youtube(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.driver_send_to_youtube(uuid, uuid[]) to authenticated;
