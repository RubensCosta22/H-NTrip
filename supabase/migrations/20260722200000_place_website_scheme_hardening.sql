-- H&NTrip: allow only browser-safe web schemes for saved place websites.

alter table public.trip_places
  add constraint trip_places_website_http_scheme
  check (
    website is null
    or website ~* '^https?://'
  ) not valid;

create or replace function public.add_trip_place(
  target_trip_id uuid, place_name text, place_category text, place_address text,
  place_phone text, place_website text, place_reservation_code text,
  place_starts_on date, place_ends_on date, place_planned_cost numeric,
  place_actual_cost numeric, place_rating smallint, place_notes text
) returns public.trip_places
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  trip_record public.trips;
  place_record public.trip_places;
  normalized_website text := nullif(btrim(place_website), '');
begin
  select * into trip_record from public.trips where id = target_trip_id and status <> 'archived';
  if actor_id is null or trip_record.id is null or not private.has_workspace_role(trip_record.workspace_id) then
    raise exception 'place_access_denied' using errcode = '42501';
  end if;

  if normalized_website is not null and normalized_website !~* '^https?://' then
    raise exception 'invalid_place_website_scheme' using errcode = '22023';
  end if;

  insert into public.trip_places (
    workspace_id, trip_id, name, category, address, phone, website, reservation_code,
    starts_on, ends_on, planned_cost, actual_cost, rating, notes, created_by, updated_by
  ) values (
    trip_record.workspace_id, target_trip_id, nullif(btrim(place_name), ''), place_category,
    nullif(btrim(place_address), ''), nullif(btrim(place_phone), ''), normalized_website,
    nullif(btrim(place_reservation_code), ''), place_starts_on, place_ends_on, place_planned_cost,
    place_actual_cost, place_rating, nullif(btrim(place_notes), ''), actor_id, actor_id
  ) returning * into place_record;

  insert into public.audit_logs (workspace_id, actor_id, action, resource_type, resource_id, metadata)
  values (trip_record.workspace_id, actor_id, 'place.created', 'trip_place', place_record.id,
    jsonb_build_object('trip_id', target_trip_id, 'category', place_category));

  return place_record;
end;
$$;

revoke all on function public.add_trip_place(uuid, text, text, text, text, text, text, date, date, numeric, numeric, smallint, text) from public, anon;
grant execute on function public.add_trip_place(uuid, text, text, text, text, text, text, date, date, numeric, numeric, smallint, text) to authenticated;
