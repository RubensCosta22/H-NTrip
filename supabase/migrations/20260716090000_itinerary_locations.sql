-- H&NTrip: optional, validated activity coordinates for provider-free maps.

alter table public.itinerary_activities
  add column location_latitude numeric(9, 6),
  add column location_longitude numeric(9, 6),
  add constraint itinerary_activity_coordinates_paired check (
    (location_latitude is null and location_longitude is null)
    or (location_latitude is not null and location_longitude is not null)
  ),
  add constraint itinerary_activity_latitude_range check (
    location_latitude is null or location_latitude between -90 and 90
  ),
  add constraint itinerary_activity_longitude_range check (
    location_longitude is null or location_longitude between -180 and 180
  );

drop function public.add_itinerary_activity(uuid, text, text, text, time, time, boolean);

create function public.add_itinerary_activity(
  target_day_id uuid,
  activity_title text,
  activity_description text,
  activity_location text,
  activity_latitude numeric,
  activity_longitude numeric,
  activity_start_time time,
  activity_end_time time,
  activity_ends_next_day boolean
)
returns public.itinerary_activities
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  day_record public.itinerary_days;
  trip_timezone text;
  next_position numeric(20, 10);
  created_activity public.itinerary_activities;
begin
  select * into day_record from public.itinerary_days where id = target_day_id;
  if actor_id is null or day_record.id is null
    or not private.has_workspace_role(day_record.workspace_id) then
    raise exception 'itinerary_access_denied' using errcode = '42501';
  end if;
  if (activity_latitude is null) <> (activity_longitude is null) then
    raise exception 'coordinates_must_be_paired' using errcode = '22023';
  end if;

  select timezone into trip_timezone from public.trips where id = day_record.trip_id;
  select coalesce(max(position), 0) + 1024 into next_position
  from public.itinerary_activities where itinerary_day_id = target_day_id;

  insert into public.itinerary_activities (
    workspace_id, trip_id, itinerary_day_id, title, description, location_name,
    location_latitude, location_longitude, start_time, end_time, ends_next_day,
    timezone, position, created_by, updated_by
  ) values (
    day_record.workspace_id, day_record.trip_id, target_day_id, trim(activity_title),
    nullif(trim(activity_description), ''), nullif(trim(activity_location), ''),
    activity_latitude, activity_longitude, activity_start_time, activity_end_time,
    activity_ends_next_day, trip_timezone, next_position, actor_id, actor_id
  ) returning * into created_activity;

  insert into public.audit_logs (
    workspace_id, actor_id, action, resource_type, resource_id, metadata
  ) values (
    day_record.workspace_id, actor_id, 'itinerary.activity_added', 'itinerary_activity',
    created_activity.id,
    jsonb_build_object(
      'trip_id', day_record.trip_id,
      'day_id', target_day_id,
      'has_coordinates', activity_latitude is not null
    )
  );
  return created_activity;
end;
$$;

revoke all on function public.add_itinerary_activity(
  uuid, text, text, text, numeric, numeric, time, time, boolean
) from public, anon;
grant execute on function public.add_itinerary_activity(
  uuid, text, text, text, numeric, numeric, time, time, boolean
) to authenticated;

comment on column public.itinerary_activities.location_latitude is
  'Optional map coordinate supplied by a workspace member; never inferred from device location.';
