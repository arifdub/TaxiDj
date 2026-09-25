-- =============================================================================
-- Taxi DJ — the driver can add songs to their own ride's queue
--
-- driver_add_song(): like add_song_request, but for the ride's driver.
-- * No per-passenger limit and no approval step (driver songs are queued).
-- * Duplicate and video-ID checks still apply.
-- * Songs are attributed to a "Driver" passenger row for this ride (created
--   on first use), so every request keeps a requester. The UI hides this row
--   from the passenger count.
-- =============================================================================

create function public.driver_add_song(
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
    'queued',
    (select coalesce(max(position), 0) + 1 from public.song_requests where ride_id = v_ride.id)
  )
  returning * into v_req;

  return v_req;
end;
$$;

revoke execute on function public.driver_add_song(uuid, text, text, text, integer, text) from public, anon, authenticated;
grant execute on function public.driver_add_song(uuid, text, text, text, integer, text) to authenticated;

-- Ride history: don't count the driver's own "Driver" row as a passenger.
create or replace function public.driver_ride_history(p_limit integer default 50)
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
         (select count(*) from public.passengers p where p.ride_id = r.id and p.session_identifier <> r.driver_id),
         (select count(*) from public.song_requests s where s.ride_id = r.id),
         (select count(*) from public.song_requests s where s.ride_id = r.id and s.status = 'played')
    from public.rides r
   where r.driver_id = auth.uid()
   order by r.created_at desc
   limit least(greatest(coalesce(p_limit, 50), 1), 200);
$$;

