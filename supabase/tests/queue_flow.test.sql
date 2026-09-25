-- End-to-end checks for rides, joining, requests, limits, RLS and transitions.
-- Run with ./supabase/tests/run.sh (plain PostgreSQL + auth_stub.sql).
\set ON_ERROR_STOP on

insert into auth.users values
  ('00000000-0000-0000-0000-00000000000d'),  -- driver
  ('00000000-0000-0000-0000-00000000000e'),  -- other driver
  ('00000000-0000-0000-0000-0000000000a1'),  -- passenger 1
  ('00000000-0000-0000-0000-0000000000a2'),  -- passenger 2
  ('00000000-0000-0000-0000-0000000000a3');  -- stranger

create function pg_temp.as_user(p_uid text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'email', 'driver@example.com')::text, false);
$$;

create function pg_temp.expect_error(p_sql text, p_code text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'expected error % but statement succeeded: %', p_code, p_sql;
exception when others then
  if sqlerrm <> p_code then
    raise exception 'expected error % but got "%" for: %', p_code, sqlerrm, p_sql;
  end if;
end;
$$;
grant execute on function pg_temp.as_user(text), pg_temp.expect_error(text, text) to authenticated, anon;

create temp table ctx (k text primary key, v text);
grant all on ctx to authenticated, anon;

-- Driver starts a ride ------------------------------------------------------
set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.update_driver_settings('My Taxi', true, 3);
insert into ctx select 'ride', id::text from public.start_ride();
insert into ctx select 'code', join_code from public.rides where id = (select v::uuid from ctx where k = 'ride');

do $$
declare r public.rides;
begin
  select * into r from public.rides where id = (select v::uuid from ctx where k='ride');
  assert r.status = 'active', 'ride active';
  assert r.join_code ~ '^[A-HJ-NP-Z2-9]{5}$', 'join code format';
  -- Starting again returns the same active ride.
  assert (public.start_ride()).id = r.id, 'start_ride is idempotent while active';
end $$;

-- Public lookup works for anon ------------------------------------------------
reset role; set role anon;
select pg_temp.as_user('');
do $$
declare s text;
begin
  select state into s from public.get_ride_by_code(lower((select v from ctx where k='code')));
  assert s = 'active', 'anon can look up ride by code (case-insensitive)';
end $$;
-- anon cannot join or read tables
select pg_temp.expect_error($q$select public.join_ride('ABCDE', null)$q$, 'permission denied for function join_ride');
select pg_temp.expect_error($q$select * from public.rides$q$, 'permission denied for table rides');

-- Passengers join ------------------------------------------------------------
reset role; set role authenticated;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into ctx select 'p1', id::text from public.join_ride((select v from ctx where k='code'), '  Sam  ');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
insert into ctx select 'p2', id::text from public.join_ride((select v from ctx where k='code'), null);

do $$
begin
  assert (select nickname from public.passengers where id = (select v::uuid from ctx where k='p2')) = 'Passenger 2',
    'default nickname numbered';
  -- rejoin returns same passenger
  assert (public.join_ride((select v from ctx where k='code'), null)).id = (select v::uuid from ctx where k='p2'),
    'rejoin is idempotent';
  -- passenger 2 cannot see passenger 1's row
  assert (select count(*) from public.passengers) = 1, 'passengers only see themselves';
end $$;

select pg_temp.expect_error($q$select public.join_ride('ZZZZZ', null)$q$, 'RIDE_NOT_FOUND');

-- Direct writes are blocked ---------------------------------------------------
select pg_temp.expect_error($q$update public.song_requests set status = 'playing'$q$, 'permission denied for table song_requests');
select pg_temp.expect_error($q$insert into public.rides (driver_id, join_code, name) values ('00000000-0000-0000-0000-0000000000a2', 'AAAAA', 'x')$q$, 'permission denied for table rides');

-- Song requests ---------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into ctx select 'r1', id::text from public.add_song_request((select v::uuid from ctx where k='ride'), 'fHI8X4OXluQ', 'Blinding Lights', 'The Weeknd', 200, 'youtube');
insert into ctx select 'r2', id::text from public.add_song_request((select v::uuid from ctx where k='ride'), 'JGwWNGJdvx8', 'Shape of You', 'Ed Sheeran', 263, 'youtube_music');
insert into ctx select 'r3', id::text from public.add_song_request((select v::uuid from ctx where k='ride'), '7wtfhZwyrcc', 'Believer', 'Imagine Dragons', 204, 'youtube');

do $$
declare r public.song_requests;
begin
  select * into r from public.song_requests where id = (select v::uuid from ctx where k='r2');
  assert r.youtube_url = 'https://music.youtube.com/watch?v=JGwWNGJdvx8', 'music url derived from id';
  assert r.thumbnail_url = 'https://i.ytimg.com/vi/JGwWNGJdvx8/hqdefault.jpg', 'thumbnail derived from id';
  assert r.status = 'queued', 'auto-approve queues requests';
  assert r.position = 2, 'positions increment';
end $$;

select pg_temp.expect_error($q$select public.add_song_request((select v::uuid from ctx where k='ride'), 'kJQP7kiw5Fk', 'Despacito')$q$, 'REQUEST_LIMIT_REACHED');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.expect_error($q$select public.add_song_request((select v::uuid from ctx where k='ride'), 'fHI8X4OXluQ', 'Blinding Lights')$q$, 'DUPLICATE_REQUEST');
select pg_temp.expect_error($q$select public.add_song_request((select v::uuid from ctx where k='ride'), 'not-a-valid-id', 'Bad')$q$, 'INVALID_VIDEO');
select pg_temp.expect_error($q$select public.add_song_request((select v::uuid from ctx where k='ride'), 'bad''id$$$$$', 'Bad')$q$, 'INVALID_VIDEO');
insert into ctx select 'r4', id::text from public.add_song_request((select v::uuid from ctx where k='ride'), 'kJQP7kiw5Fk', E'Despacito\u0007', null, null, 'evil');

do $$
begin
  assert (select count(*) from public.song_requests) = 4, 'passenger sees whole ride queue';
  assert (select title from public.song_requests where id = (select v::uuid from ctx where k='r4')) = 'Despacito', 'control chars stripped';
  assert (select source from public.song_requests where id = (select v::uuid from ctx where k='r4')) = 'youtube', 'unknown source falls back';
end $$;

-- Passenger cannot manage queue
select pg_temp.expect_error($q$select public.driver_update_request((select v::uuid from ctx where k='r4'), 'remove')$q$, 'REQUEST_NOT_FOUND');
select pg_temp.expect_error($q$select public.end_ride((select v::uuid from ctx where k='ride'))$q$, 'RIDE_NOT_FOUND');

-- Stranger (not joined) sees nothing and cannot add --------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3');
do $$
begin
  assert (select count(*) from public.song_requests) = 0, 'stranger sees no requests';
  assert (select count(*) from public.rides) = 0, 'stranger sees no rides';
end $$;
select pg_temp.expect_error($q$select public.add_song_request((select v::uuid from ctx where k='ride'), 'dQw4w9WgXcQ', 'x')$q$, 'NOT_A_PASSENGER');

-- Other driver cannot touch this ride -------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
select pg_temp.expect_error($q$select public.driver_update_request((select v::uuid from ctx where k='r1'), 'play')$q$, 'REQUEST_NOT_FOUND');
select pg_temp.expect_error($q$select public.driver_skip((select v::uuid from ctx where k='ride'), 'next')$q$, 'RIDE_NOT_FOUND');

-- Driver manages the queue ----------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$
declare
  r public.song_requests;
  v_ride uuid := (select v::uuid from ctx where k='ride');
begin
  assert (select count(*) from public.passengers) = 2, 'driver sees ride passengers';

  -- next starts first queued song
  r := public.driver_skip(v_ride, 'next');
  assert r.id = (select v::uuid from ctx where k='r1') and r.status = 'playing', 'next plays first';

  -- move r4 up above r3
  perform public.driver_update_request((select v::uuid from ctx where k='r4'), 'move_up');
  assert (select position from public.song_requests where id = (select v::uuid from ctx where k='r4'))
       < (select position from public.song_requests where id = (select v::uuid from ctx where k='r3')), 'move_up swaps';

  -- play now r3: r1 becomes played
  r := public.driver_update_request((select v::uuid from ctx where k='r3'), 'play');
  assert r.status = 'playing', 'play now';
  assert (select status from public.song_requests where id = (select v::uuid from ctx where k='r1')) = 'played', 'previous current played';

  -- previous: r3 back to queue top, r1 playing again
  r := public.driver_skip(v_ride, 'previous');
  assert r.id = (select v::uuid from ctx where k='r1'), 'previous replays last played';
  assert (select status from public.song_requests where id = (select v::uuid from ctx where k='r3')) = 'queued', 'current requeued';

  -- next goes to r3 (now top of queue)
  r := public.driver_skip(v_ride, 'next');
  assert r.id = (select v::uuid from ctx where k='r3'), 'requeued song is next';

  -- remove r2
  r := public.driver_update_request((select v::uuid from ctx where k='r2'), 'remove');
  assert r.status = 'removed', 'remove';
end $$;
select pg_temp.expect_error($q$select public.driver_update_request((select v::uuid from ctx where k='r2'), 'approve')$q$, 'INVALID_TRANSITION');
select pg_temp.expect_error($q$select public.driver_update_request((select v::uuid from ctx where k='r2'), 'launch_rockets')$q$, 'INVALID_ACTION');

-- Removal frees a slot for passenger 1
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into ctx select 'r5', id::text from public.add_song_request((select v::uuid from ctx where k='ride'), 'dQw4w9WgXcQ', 'Never Gonna Give You Up', 'Rick Astley');

-- Approval mode ----------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.update_driver_settings('Arif''s Car', false, 2);
select pg_temp.expect_error($q$select public.update_driver_settings('', false, 2)$q$, 'INVALID_DISPLAY_NAME');
select pg_temp.expect_error($q$select public.update_driver_settings('ok', false, 51)$q$, 'INVALID_REQUEST_LIMIT');
select pg_temp.expect_error($q$select public.update_driver_settings('ok', false, 5, 'vinyl')$q$, 'INVALID_ACTION');
do $$ begin
  -- settings apply to the ride in progress immediately
  assert (select max_requests_per_passenger from public.rides where id = (select v::uuid from ctx where k='ride')) = 2, 'limit applied to active ride';
  assert (select name from public.rides where id = (select v::uuid from ctx where k='ride')) = 'Arif''s Car', 'name applied to active ride';
  assert (public.update_driver_settings('Arif''s Car', false, 20)).max_requests_per_passenger = 20, 'limit up to 50 allowed';
  assert (public.set_playback_mode('external')).playback_mode = 'external', 'playback mode saved to account';
  assert (public.update_driver_settings('Arif''s Car', false, 2, 'embedded')).playback_mode = 'embedded', 'playback mode via settings';
end $$;

do $$
begin
  assert (select count(*) from public.driver_ride_history()) = 1, 'history lists ride';
  assert (select played_count from public.driver_ride_history()) = 1, 'history counts played';
end $$;

-- End ride ------------------------------------------------------------------------
do $$
declare r public.rides;
begin
  r := public.end_ride((select v::uuid from ctx where k='ride'));
  assert r.status = 'ended' and r.ended_at is not null, 'ride ended';
  assert not exists (select 1 from public.song_requests where status = 'playing'), 'playing song finished on end';
end $$;
select pg_temp.expect_error($q$select public.driver_skip((select v::uuid from ctx where k='ride'), 'next')$q$, 'RIDE_ENDED');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.expect_error($q$select public.add_song_request((select v::uuid from ctx where k='ride'), 'OPf0YbXqDm0', 'Uptown Funk')$q$, 'RIDE_ENDED');
select pg_temp.expect_error($q$select public.join_ride((select v from ctx where k='code'), null)$q$, 'RIDE_ENDED');
do $$ begin
  assert (select state from public.get_ride_by_code((select v from ctx where k='code'))) = 'ended', 'lookup reports ended';
end $$;

-- New ride uses updated settings (approval required, limit 2) ------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$
declare r public.rides;
begin
  r := public.start_ride();
  assert r.id <> (select v::uuid from ctx where k='ride'), 'new ride after ending';
  assert r.name = 'Arif''s Car' and r.max_requests_per_passenger = 2 and not r.auto_approve, 'settings snapshot';
  update ctx set v = r.id::text where k = 'ride';
  update ctx set v = r.join_code where k = 'code';
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select public.join_ride((select v from ctx where k='code'), 'Sam');
do $$
declare r public.song_requests;
begin
  r := public.add_song_request((select v::uuid from ctx where k='ride'), 'fHI8X4OXluQ', 'Blinding Lights');
  assert r.status = 'pending', 'approval required -> pending';
  update ctx set v = r.id::text where k = 'r1';
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$
declare r public.song_requests;
begin
  r := public.driver_skip((select v::uuid from ctx where k='ride'), 'next');
  assert r is null or r.id is null, 'next ignores pending';
  r := public.driver_update_request((select v::uuid from ctx where k='r1'), 'approve');
  assert r.status = 'queued', 'approve';
end $$;

-- Passenger removes / re-requests their own songs -------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select public.join_ride((select v from ctx where k='code'), 'Alex');
select pg_temp.expect_error($q$select public.passenger_remove_request((select v::uuid from ctx where k='r1'))$q$, 'REQUEST_NOT_FOUND');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$
declare r public.song_requests;
begin
  r := public.passenger_remove_request((select v::uuid from ctx where k='r1'));
  assert r.status = 'removed' and r.removed_by = 'passenger', 'passenger removes own queued song';
  -- slot + duplicate freed: same song can be requested again
  r := public.add_song_request((select v::uuid from ctx where k='ride'), 'fHI8X4OXluQ', 'Blinding Lights');
  assert r.status = 'pending', 'removed song can be re-requested';
  update ctx set v = r.id::text where k = 'r1';
end $$;
select pg_temp.expect_error($q$select public.passenger_remove_request((select v::uuid from ctx where k='r2'))$q$, 'RIDE_ENDED');

select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.driver_update_request((select v::uuid from ctx where k='r1'), 'play');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_error($q$select public.passenger_remove_request((select v::uuid from ctx where k='r1'))$q$, 'INVALID_TRANSITION');

-- Replay: once played, the passenger can request the same song again
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.driver_update_request((select v::uuid from ctx where k='r1'), 'finish');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
do $$
declare r public.song_requests;
begin
  r := public.add_song_request((select v::uuid from ctx where k='ride'), 'fHI8X4OXluQ', 'Blinding Lights');
  assert r.id <> (select v::uuid from ctx where k='r1'), 'played song can be requested again (replay)';
  update ctx set v = r.id::text where k = 'r5';
end $$;
-- limit is 2 on this ride: played + replay = 2 → full
select pg_temp.expect_error($q$select public.add_song_request((select v::uuid from ctx where k='ride'), 'kJQP7kiw5Fk', 'Despacito')$q$, 'REQUEST_LIMIT_REACHED');

-- Driver removal is tagged
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$
declare r public.song_requests;
begin
  r := public.driver_update_request((select v::uuid from ctx where k='r5'), 'remove');
  assert r.removed_by = 'driver', 'driver removal tagged';
end $$;

-- Hand-off to YouTube in batches ----------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.update_driver_settings('Arif''s Car', true, 20);
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into ctx select 'h1', id::text from public.add_song_request((select v::uuid from ctx where k='ride'), 'OPf0YbXqDm0', 'Uptown Funk');
insert into ctx select 'h2', id::text from public.add_song_request((select v::uuid from ctx where k='ride'), 'kJQP7kiw5Fk', 'Despacito');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
select pg_temp.expect_error($q$select public.driver_send_to_youtube((select v::uuid from ctx where k='ride'), array[(select v::uuid from ctx where k='h1')])$q$, 'RIDE_NOT_FOUND');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$
declare n int;
begin
  select count(*) into n from public.driver_send_to_youtube((select v::uuid from ctx where k='ride'),
    array[(select v::uuid from ctx where k='h1'), (select v::uuid from ctx where k='h2')]);
  assert n = 2, 'batch sent';
  assert (select status from public.song_requests where id = (select v::uuid from ctx where k='h1')) = 'playing', 'first of batch playing';
  assert (select status from public.song_requests where id = (select v::uuid from ctx where k='h2')) = 'queued', 'rest queued';
  assert (select sent_to_youtube_at is not null from public.song_requests where id = (select v::uuid from ctx where k='h2')), 'marked sent';
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2');
insert into ctx select 'h3', id::text from public.add_song_request((select v::uuid from ctx where k='ride'), 'dQw4w9WgXcQ', 'Never Gonna Give You Up');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
do $$
begin
  perform public.driver_send_to_youtube((select v::uuid from ctx where k='ride'), array[(select v::uuid from ctx where k='h3')]);
  assert (select status from public.song_requests where id = (select v::uuid from ctx where k='h1')) = 'played', 'previous playing song → played (one playing at a time)';
  assert (select status from public.song_requests where id = (select v::uuid from ctx where k='h2')) = 'queued', 'sent songs stay in the queue (not finished)';
  assert (select status from public.song_requests where id = (select v::uuid from ctx where k='h3')) = 'playing', 'new batch playing';
end $$;
do $$
begin
  -- whole ride playlist: played songs can be resent
  perform public.driver_send_to_youtube((select v::uuid from ctx where k='ride'),
    array[(select v::uuid from ctx where k='h1'), (select v::uuid from ctx where k='h2'), (select v::uuid from ctx where k='h3')]);
  assert (select status from public.song_requests where id = (select v::uuid from ctx where k='h1')) = 'playing', 'resend whole playlist starts from first song';
  -- driver can remove a played song
  assert (public.driver_update_request((select v::uuid from ctx where k='h3'), 'remove')).status = 'removed', 'driver removes a played song';
end $$;
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_error($q$select public.passenger_remove_request((select v::uuid from ctx where k='h1'))$q$, 'INVALID_TRANSITION');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select pg_temp.expect_error($q$select public.driver_send_to_youtube((select v::uuid from ctx where k='ride'), array[]::uuid[])$q$, 'INVALID_TRANSITION');

-- Driver adds songs ---------------------------------------------------------------
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.update_driver_settings('Arif''s Car', false, 1);  -- approval on, limit 1: driver bypasses both
do $$
declare r public.song_requests;
begin
  r := public.driver_add_song((select v::uuid from ctx where k='ride'), '9bZkp7q19f0', 'Gangnam Style', 'PSY');
  assert r.status = 'queued', 'driver songs are queued without approval';
  r := public.driver_add_song((select v::uuid from ctx where k='ride'), 'CevxZvSJLk8', 'Roar', 'Katy Perry');
  assert (select nickname from public.passengers where id = r.passenger_id) = 'Driver', 'attributed to Driver';
  assert (select count(*) from public.passengers where session_identifier = '00000000-0000-0000-0000-00000000000d'::uuid
          and ride_id = (select v::uuid from ctx where k='ride')) = 1, 'one Driver row per ride';
end $$;
select pg_temp.expect_error($q$select public.driver_add_song((select v::uuid from ctx where k='ride'), '9bZkp7q19f0', 'dup')$q$, 'DUPLICATE_REQUEST');
select pg_temp.expect_error($q$select public.driver_add_song((select v::uuid from ctx where k='ride'), 'bad', 'x')$q$, 'INVALID_VIDEO');
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
select pg_temp.expect_error($q$select public.driver_add_song((select v::uuid from ctx where k='ride'), 'y6120QOlsfU', 'x')$q$, 'RIDE_NOT_FOUND');
select pg_temp.as_user('00000000-0000-0000-0000-00000000000d');
select public.update_driver_settings('Arif''s Car', true, 20);

-- New drivers default to 10 songs per passenger
select pg_temp.as_user('00000000-0000-0000-0000-00000000000e');
do $$ begin
  assert (public.start_ride()).max_requests_per_passenger = 10, 'default limit is 10';
end $$;

reset role;
\echo 'ALL TAXI DJ SQL TESTS PASSED'
