-- H&NTrip: minimal trip creation and listing vertical slice.

create type public.trip_status as enum (
  'draft',
  'planned',
  'ongoing',
  'completed',
  'archived'
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  name text not null,
  destination text not null,
  description text,
  start_date date not null,
  end_date date not null,
  timezone text not null,
  base_currency text not null default 'BRL',
  budget numeric(14, 2) not null default 0,
  status public.trip_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  updated_by uuid not null references public.profiles (id),
  archived_at timestamptz,
  constraint trips_name_length check (char_length(name) between 1 and 120),
  constraint trips_destination_length check (char_length(destination) between 1 and 160),
  constraint trips_description_length check (description is null or char_length(description) <= 2000),
  constraint trips_date_range check (end_date >= start_date),
  constraint trips_timezone_length check (char_length(timezone) between 1 and 64),
  constraint trips_currency_iso_format check (base_currency ~ '^[A-Z]{3}$'),
  constraint trips_budget_nonnegative check (budget >= 0),
  constraint trips_archived_state check (
    (status = 'archived' and archived_at is not null)
    or (status <> 'archived' and archived_at is null)
  )
);

create index trips_workspace_start_idx
  on public.trips (workspace_id, start_date, id)
  where archived_at is null;
create index trips_workspace_status_updated_idx
  on public.trips (workspace_id, status, updated_at desc, id desc);

create trigger trips_set_updated_at
before update on public.trips
for each row execute function private.set_updated_at();

alter table public.trips enable row level security;
alter table public.trips force row level security;

create policy trips_select_member
on public.trips for select to authenticated
using ((select private.has_workspace_role(workspace_id)));

create policy trips_update_admin
on public.trips for update to authenticated
using ((select private.has_workspace_role(workspace_id)))
with check (
  (select private.has_workspace_role(workspace_id))
  and updated_by = (select auth.uid())
);

revoke all on public.trips from anon, authenticated;
grant select on public.trips to authenticated;
grant update (
  name, destination, description, start_date, end_date, timezone,
  base_currency, budget, status, archived_at, updated_by
) on public.trips to authenticated;

create or replace function public.create_trip(
  target_workspace_id uuid,
  trip_name text,
  trip_destination text,
  trip_description text,
  trip_start_date date,
  trip_end_date date,
  trip_timezone text,
  trip_base_currency text,
  trip_budget numeric
)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  created_trip public.trips;
begin
  if actor_id is null or not private.has_workspace_role(target_workspace_id) then
    raise exception 'workspace_access_denied' using errcode = '42501';
  end if;

  insert into public.trips (
    workspace_id, name, destination, description, start_date, end_date,
    timezone, base_currency, budget, created_by, updated_by
  )
  values (
    target_workspace_id,
    trim(trip_name),
    trim(trip_destination),
    nullif(trim(trip_description), ''),
    trip_start_date,
    trip_end_date,
    trip_timezone,
    upper(trip_base_currency),
    trip_budget,
    actor_id,
    actor_id
  )
  returning * into created_trip;

  insert into public.audit_logs (
    workspace_id, actor_id, action, resource_type, resource_id, metadata
  )
  values (
    target_workspace_id,
    actor_id,
    'trip.created',
    'trip',
    created_trip.id,
    jsonb_build_object('status', created_trip.status)
  );

  return created_trip;
end;
$$;

revoke all on function public.create_trip(
  uuid, text, text, text, date, date, text, text, numeric
) from public, anon;
grant execute on function public.create_trip(
  uuid, text, text, text, date, date, text, text, numeric
) to authenticated;

comment on function public.create_trip(
  uuid, text, text, text, date, date, text, text, numeric
) is 'Creates a trip and its audit event atomically after workspace authorization.';
