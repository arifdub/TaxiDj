-- =============================================================================
-- Taxi DJ — driver settings saved to the account and applied immediately
--
-- * Songs per passenger can now be set from 1 to 50 (was 1–10).
-- * playback_mode ('embedded' = Taxi DJ player, 'external' = YouTube app) is
--   stored on the driver so it follows the account across devices/sessions.
-- * update_driver_settings() also applies the car name, approval mode and
--   song limit to the driver's active ride, so changes take effect now
--   instead of only on the next ride.
-- =============================================================================

alter table public.drivers drop constraint drivers_max_requests_per_passenger_check;
alter table public.drivers add constraint drivers_max_requests_per_passenger_check
  check (max_requests_per_passenger between 1 and 50);

alter table public.rides drop constraint rides_max_requests_per_passenger_check;
alter table public.rides add constraint rides_max_requests_per_passenger_check
  check (max_requests_per_passenger between 1 and 50);

alter table public.drivers
  add column playback_mode text not null default 'embedded'
    check (playback_mode in ('embedded', 'external'));

drop function public.update_driver_settings(text, boolean, integer);

create function public.update_driver_settings(
  p_display_name text,
  p_auto_approve boolean,
  p_max_requests_per_passenger integer,
  p_playback_mode text default null
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
     or p_max_requests_per_passenger not between 1 and 50 then
    perform public.taxidj_error('INVALID_REQUEST_LIMIT');
  end if;
  if p_playback_mode is not null and p_playback_mode not in ('embedded', 'external') then
    perform public.taxidj_error('INVALID_ACTION');
  end if;

  update public.drivers
     set display_name = v_name,
         auto_approve = coalesce(p_auto_approve, auto_approve),
         max_requests_per_passenger = p_max_requests_per_passenger,
         playback_mode = coalesce(p_playback_mode, playback_mode)
   where id = auth.uid()
  returning * into v_driver;

  -- Apply to the ride in progress too.
  update public.rides
     set name = v_driver.display_name,
         auto_approve = v_driver.auto_approve,
         max_requests_per_passenger = v_driver.max_requests_per_passenger
   where driver_id = v_driver.id and status = 'active';

  return v_driver;
end;
$$;

create function public.set_playback_mode(p_mode text) returns public.drivers
language plpgsql security definer set search_path = '' as $$
declare
  v_driver public.drivers;
begin
  perform public.ensure_driver();
  if p_mode is null or p_mode not in ('embedded', 'external') then
    perform public.taxidj_error('INVALID_ACTION');
  end if;
  update public.drivers set playback_mode = p_mode
   where id = auth.uid()
  returning * into v_driver;
  return v_driver;
end;
$$;

revoke execute on function
  public.update_driver_settings(text, boolean, integer, text),
  public.set_playback_mode(text)
from public, anon, authenticated;
grant execute on function
  public.update_driver_settings(text, boolean, integer, text),
  public.set_playback_mode(text)
to authenticated;
