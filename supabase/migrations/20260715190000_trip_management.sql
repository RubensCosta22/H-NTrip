-- H&NTrip: trip editing, archiving and informational participants.

create table public.trip_participants (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null,
  email text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  updated_by uuid not null references public.profiles (id),
  constraint trip_participants_name_length check (char_length(name) between 1 and 120),
  constraint trip_participants_email_format check (
    email is null or (
      char_length(email) between 3 and 254
      and email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    )
  ),
  constraint trip_participants_notes_length check (notes is null or char_length(notes) <= 500)
);

alter table public.trips
  add constraint trips_id_workspace_key unique (id, workspace_id);
alter table public.trip_participants
  add constraint trip_participants_trip_workspace_fk
  foreign key (trip_id, workspace_id)
  references public.trips (id, workspace_id)
  on delete cascade;

create index trip_participants_trip_created_idx
  on public.trip_participants (trip_id, created_at, id);
create unique index trip_participants_trip_email_key
  on public.trip_participants (trip_id, lower(email))
  where email is not null;

create trigger trip_participants_set_updated_at
before update on public.trip_participants
for each row execute function private.set_updated_at();

create or replace function private.trip_workspace_id(target_trip_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select workspace_id from public.trips where id = target_trip_id;
$$;

revoke all on function private.trip_workspace_id(uuid) from public, anon;
revoke all on function private.trip_workspace_id(uuid) from authenticated;

alter table public.trip_participants enable row level security;
alter table public.trip_participants force row level security;

create policy trip_participants_select_member
on public.trip_participants for select to authenticated
using ((select private.has_workspace_role(workspace_id)));

revoke all on public.trip_participants from anon, authenticated;
grant select on public.trip_participants to authenticated;

-- Mutations use audited RPC functions; direct trip updates are no longer granted.
revoke update on public.trips from authenticated;
revoke update (
  name, destination, description, start_date, end_date, timezone,
  base_currency, budget, status, archived_at, updated_by
) on public.trips from authenticated;

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
  updated_trip public.trips;
begin
  if actor_id is null or target_workspace_id is null
    or not private.has_workspace_role(target_workspace_id) then
    raise exception 'trip_access_denied' using errcode = '42501';
  end if;

  if trip_status not in ('draft', 'planned') then
    raise exception 'invalid_trip_status_transition' using errcode = '23514';
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
    target_workspace_id, actor_id, 'trip.updated', 'trip', target_trip_id,
    jsonb_build_object('status', updated_trip.status)
  );

  return updated_trip;
end;
$$;

create or replace function public.archive_trip(target_trip_id uuid)
returns public.trips
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_workspace_id uuid := private.trip_workspace_id(target_trip_id);
  archived_trip public.trips;
begin
  if actor_id is null or target_workspace_id is null
    or not private.has_workspace_role(target_workspace_id) then
    raise exception 'trip_access_denied' using errcode = '42501';
  end if;

  update public.trips
  set status = 'archived', archived_at = now(), updated_by = actor_id
  where id = target_trip_id and archived_at is null
  returning * into archived_trip;

  if archived_trip.id is null then
    raise exception 'trip_not_archivable' using errcode = 'P0002';
  end if;

  insert into public.audit_logs (
    workspace_id, actor_id, action, resource_type, resource_id, metadata
  ) values (
    target_workspace_id, actor_id, 'trip.archived', 'trip', target_trip_id, '{}'::jsonb
  );
  return archived_trip;
end;
$$;

create or replace function public.add_trip_participant(
  target_trip_id uuid,
  participant_name text,
  participant_email text,
  participant_notes text
)
returns public.trip_participants
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  target_workspace_id uuid := private.trip_workspace_id(target_trip_id);
  created_participant public.trip_participants;
begin
  if actor_id is null or target_workspace_id is null
    or not private.has_workspace_role(target_workspace_id) then
    raise exception 'trip_access_denied' using errcode = '42501';
  end if;

  insert into public.trip_participants (
    workspace_id, trip_id, name, email, notes, created_by, updated_by
  ) values (
    target_workspace_id, target_trip_id, trim(participant_name),
    nullif(lower(trim(participant_email)), ''), nullif(trim(participant_notes), ''),
    actor_id, actor_id
  ) returning * into created_participant;

  insert into public.audit_logs (
    workspace_id, actor_id, action, resource_type, resource_id, metadata
  ) values (
    target_workspace_id, actor_id, 'trip.participant_added', 'trip_participant',
    created_participant.id, jsonb_build_object('trip_id', target_trip_id)
  );
  return created_participant;
end;
$$;

create or replace function public.remove_trip_participant(target_participant_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  participant_record public.trip_participants;
begin
  select * into participant_record
  from public.trip_participants
  where id = target_participant_id;

  if actor_id is null or participant_record.id is null
    or not private.has_workspace_role(participant_record.workspace_id) then
    raise exception 'participant_access_denied' using errcode = '42501';
  end if;

  delete from public.trip_participants where id = target_participant_id;
  insert into public.audit_logs (
    workspace_id, actor_id, action, resource_type, resource_id, metadata
  ) values (
    participant_record.workspace_id, actor_id, 'trip.participant_removed',
    'trip_participant', target_participant_id,
    jsonb_build_object('trip_id', participant_record.trip_id)
  );
end;
$$;

revoke all on function public.update_trip(
  uuid, text, text, text, date, date, text, text, numeric, public.trip_status
) from public, anon;
grant execute on function public.update_trip(
  uuid, text, text, text, date, date, text, text, numeric, public.trip_status
) to authenticated;

revoke all on function public.archive_trip(uuid) from public, anon;
grant execute on function public.archive_trip(uuid) to authenticated;
revoke all on function public.add_trip_participant(uuid, text, text, text) from public, anon;
grant execute on function public.add_trip_participant(uuid, text, text, text) to authenticated;
revoke all on function public.remove_trip_participant(uuid) from public, anon;
grant execute on function public.remove_trip_participant(uuid) to authenticated;

comment on table public.trip_participants is
  'Informational travelers only. Rows never grant workspace or application access.';
