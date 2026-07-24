-- H&NTrip: allow trips to move through the full active lifecycle.
-- Archived remains a dedicated action handled by public.archive_trip().

create or replace function public.update_trip(
  target_trip_id uuid,
  trip_name text,
  trip_destination text,
  trip_description text,
  trip_start_date date,
  trip_end_date date,
  trip_timezone text,
  trip_base_currency text,
  trip_budget numeric,
  trip_status public.trip_status
)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_workspace_id uuid := private.trip_workspace_id(target_trip_id);
  previous_status public.trip_status;
  updated_trip public.trips;
begin
  if actor_id is null or target_workspace_id is null
    or not private.has_workspace_role(target_workspace_id) then
    raise exception 'trip_access_denied' using errcode = '42501';
  end if;

  if trip_status not in ('draft', 'planned', 'ongoing', 'completed') then
    raise exception 'invalid_trip_status_transition' using errcode = '23514';
  end if;

  select status into previous_status
  from public.trips
  where id = target_trip_id and archived_at is null;

  if previous_status is null then
    raise exception 'trip_not_editable' using errcode = 'P0002';
  end if;

  update public.trips
  set name = trim(trip_name),
      destination = trim(trip_destination),
      description = nullif(trim(trip_description), ''),
      start_date = trip_start_date,
      end_date = trip_end_date,
      timezone = trip_timezone,
      base_currency = upper(trip_base_currency),
      budget = trip_budget,
      status = trip_status,
      updated_by = actor_id
  where id = target_trip_id and archived_at is null
  returning * into updated_trip;

  if updated_trip.id is null then
    raise exception 'trip_not_editable' using errcode = 'P0002';
  end if;

  insert into public.audit_logs (
    workspace_id, actor_id, action, resource_type, resource_id, metadata
  ) values (
    target_workspace_id,
    actor_id,
    'trip.updated',
    'trip',
    target_trip_id,
    jsonb_build_object(
      'previous_status', previous_status,
      'status', updated_trip.status
    )
  );

  return updated_trip;
end;
$$;

revoke all on function public.update_trip(
  uuid, text, text, text, date, date, text, text, numeric, public.trip_status
) from public, anon;

grant execute on function public.update_trip(
  uuid, text, text, text, date, date, text, text, numeric, public.trip_status
) to authenticated;

comment on function public.update_trip(
  uuid, text, text, text, date, date, text, text, numeric, public.trip_status
) is 'Updates an active trip through draft, planned, ongoing, or completed states. Archiving remains a separate audited action.';
