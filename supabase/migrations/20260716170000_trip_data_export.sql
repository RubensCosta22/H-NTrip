-- H&NTrip: audit private, versioned trip data exports.

create or replace function public.record_trip_export(
  target_trip_id uuid,
  export_schema_version integer
)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  trip_record public.trips;
begin
  select * into trip_record from public.trips
  where id = target_trip_id and status <> 'archived';
  if actor_id is null or trip_record.id is null
    or not private.has_workspace_role(trip_record.workspace_id) then
    raise exception 'trip_export_access_denied' using errcode = '42501';
  end if;
  if export_schema_version <> 1 then
    raise exception 'unsupported_export_schema' using errcode = '22023';
  end if;

  insert into public.audit_logs (
    workspace_id, actor_id, action, resource_type, resource_id, metadata
  ) values (
    trip_record.workspace_id, actor_id, 'trip.exported', 'trip', target_trip_id,
    jsonb_build_object('schema_version', export_schema_version)
  );
end;
$$;

revoke all on function public.record_trip_export(uuid, integer) from public, anon;
grant execute on function public.record_trip_export(uuid, integer) to authenticated;

comment on function public.record_trip_export(uuid, integer) is
  'Audits a private metadata export. File bytes, storage paths and signed URLs are never exported.';
