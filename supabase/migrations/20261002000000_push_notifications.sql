-- =============================================================================
-- Taxi DJ — push notifications for drivers
--
-- * push_subscriptions: a driver's devices that should get a notification
--   when a passenger adds a song (Web Push; one row per browser/device).
--   Drivers manage their own rows through the functions below; the server
--   (service role) reads them to send notifications.
-- * song_requests.push_sent_at: set once a notification has been sent for
--   a request, so it's never sent twice.
-- =============================================================================

create table public.push_subscriptions (
  id          uuid primary key default gen_random_uuid(),
  driver_id   uuid not null references public.drivers (id) on delete cascade,
  endpoint    text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh      text not null check (char_length(p256dh) between 20 and 200),
  auth        text not null check (char_length(auth) between 8 and 100),
  created_at  timestamptz not null default now()
);

create index push_subscriptions_driver_idx on public.push_subscriptions (driver_id);

alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select on public.push_subscriptions to authenticated;

create policy "Drivers read their own push subscriptions"
  on public.push_subscriptions for select to authenticated
  using (driver_id = auth.uid());

alter table public.song_requests add column push_sent_at timestamptz;

-- Saves this device's subscription for the signed-in driver (moves it over
-- if the device was used by another account before).
create function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_driver public.drivers;
begin
  v_driver := public.ensure_driver();
  insert into public.push_subscriptions (driver_id, endpoint, p256dh, auth)
  values (v_driver.id, p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set driver_id = excluded.driver_id, p256dh = excluded.p256dh, auth = excluded.auth;
end;
$$;

create function public.delete_push_subscription(p_endpoint text)
returns void
language sql security definer set search_path = '' as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and driver_id = auth.uid();
$$;

revoke execute on function
  public.save_push_subscription(text, text, text),
  public.delete_push_subscription(text)
from public, anon, authenticated;
grant execute on function
  public.save_push_subscription(text, text, text),
  public.delete_push_subscription(text)
to authenticated;
