-- H&NTrip: itinerary days, local-time activities and stable ordering.

create table public.itinerary_days (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  day_date date not null,
  title text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  updated_by uuid not null references public.profiles (id),
  constraint itinerary_days_trip_date_key unique (trip_id, day_date),
  constraint itinerary_days_title_length check (title is null or char_length(title) <= 120),
  constraint itinerary_days_notes_length check (notes is null or char_length(notes) <= 1000),
  constraint itinerary_days_trip_workspace_fk foreign key (trip_id, workspace_id)
    references public.trips (id, workspace_id) on delete cascade
);

create table public.itinerary_activities (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  itinerary_day_id uuid not null references public.itinerary_days (id) on delete cascade,
  title text not null,
  description text,
  location_name text,
  start_time time,
  end_time time,
  ends_next_day boolean not null default false,
  timezone text not null,
  position numeric(20, 10) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  updated_by uuid not null references public.profiles (id),
  constraint itinerary_activities_title_length check (char_length(title) between 1 and 160),
  constraint itinerary_activities_description_length check (description is null or char_length(description) <= 2000),
  constraint itinerary_activities_location_length check (location_name is null or char_length(location_name) <= 180),
  constraint itinerary_activities_timezone_length check (char_length(timezone) between 1 and 64),
  constraint itinerary_activities_times_check check (
    (start_time is null and end_time is null and ends_next_day = false)
    or (start_time is not null and end_time is null and ends_next_day = false)
    or (start_time is not null and end_time is not null and (
      (ends_next_day = false and end_time >= start_time)
      or ends_next_day = true
    ))
  ),
  constraint itinerary_activities_position_positive check (position > 0)
);

alter table public.itinerary_days
  add constraint itinerary_days_id_trip_workspace_key unique (id, trip_id, workspace_id);
alter table public.itinerary_activities
  add constraint itinerary_activities_day_trip_workspace_fk
  foreign key (itinerary_day_id, trip_id, workspace_id)
  references public.itinerary_days (id, trip_id, workspace_id)
  on delete cascade;

create index itinerary_days_trip_date_idx
  on public.itinerary_days (trip_id, day_date, id);
create index itinerary_activities_day_position_idx
  on public.itinerary_activities (itinerary_day_id, position, id);

create trigger itinerary_days_set_updated_at
before update on public.itinerary_days
for each row execute function private.set_updated_at();
create trigger itinerary_activities_set_updated_at
before update on public.itinerary_activities
for each row execute function private.set_updated_at();

alter table public.itinerary_days enable row level security;
alter table public.itinerary_days force row level security;
alter table public.itinerary_activities enable row level security;
alter table public.itinerary_activities force row level security;

create policy itinerary_days_select_member
on public.itinerary_days for select to authenticated
using ((select private.has_workspace_role(workspace_id)));
create policy itinerary_activities_select_member
on public.itinerary_activities for select to authenticated
using ((select private.has_workspace_role(workspace_id)));

revoke all on public.itinerary_days, public.itinerary_activities from anon, authenticated;
grant select on public.itinerary_days, public.itinerary_activities to authenticated;

create or replace function public.add_itinerary_day(
  target_trip_id uuid,
  target_date date,
  day_title text,
  day_notes text
)
returns public.itinerary_days
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  trip_record public.trips;
  created_day public.itinerary_days;
begin
  select * into trip_record from public.trips where id = target_trip_id and archived_at is null;
  if actor_id is null or trip_record.id is null
    or not private.has_workspace_role(trip_record.workspace_id) then
    raise exception 'trip_access_denied' using errcode = '42501';
  end if;
  if target_date < trip_record.start_date or target_date > trip_record.end_date then
    raise exception 'itinerary_date_outside_trip' using errcode = '23514';
  end if;

  insert into public.itinerary_days (
    workspace_id, trip_id, day_date, title, notes, created_by, updated_by
  ) values (
    trip_record.workspace_id, target_trip_id, target_date,
    nullif(trim(day_title), ''), nullif(trim(day_notes), ''), actor_id, actor_id
  ) returning * into created_day;

  insert into public.audit_logs (
    workspace_id, actor_id, action, resource_type, resource_id, metadata
  ) values (
    trip_record.workspace_id, actor_id, 'itinerary.day_added', 'itinerary_day',
    created_day.id, jsonb_build_object('trip_id', target_trip_id, 'date', target_date)
  );
  return created_day;
end;
$$;

create or replace function public.add_itinerary_activity(
  target_day_id uuid,
  activity_title text,
  activity_description text,
  activity_location text,
  activity_start_time time,
  activity_end_time time,
  activity_ends_next_day boolean
)
returns public.itinerary_activities
language plpgsql
security definer
set search_path = ''
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
  select timezone into trip_timezone from public.trips where id = day_record.trip_id;
  select coalesce(max(position), 0) + 1024 into next_position
  from public.itinerary_activities where itinerary_day_id = target_day_id;

  insert into public.itinerary_activities (
    workspace_id, trip_id, itinerary_day_id, title, description, location_name,
    start_time, end_time, ends_next_day, timezone, position, created_by, updated_by
  ) values (
    day_record.workspace_id, day_record.trip_id, target_day_id, trim(activity_title),
    nullif(trim(activity_description), ''), nullif(trim(activity_location), ''),
    activity_start_time, activity_end_time, activity_ends_next_day,
    trip_timezone, next_position, actor_id, actor_id
  ) returning * into created_activity;

  insert into public.audit_logs (
    workspace_id, actor_id, action, resource_type, resource_id, metadata
  ) values (
    day_record.workspace_id, actor_id, 'itinerary.activity_added', 'itinerary_activity',
    created_activity.id, jsonb_build_object('trip_id', day_record.trip_id, 'day_id', target_day_id)
  );
  return created_activity;
end;
$$;

create or replace function public.move_itinerary_activity(
  target_activity_id uuid,
  move_direction text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_activity public.itinerary_activities;
  neighbor_activity public.itinerary_activities;
begin
  if move_direction not in ('up', 'down') then
    raise exception 'invalid_move_direction' using errcode = '22023';
  end if;
  select * into current_activity from public.itinerary_activities where id = target_activity_id;
  if actor_id is null or current_activity.id is null
    or not private.has_workspace_role(current_activity.workspace_id) then
    raise exception 'itinerary_access_denied' using errcode = '42501';
  end if;

  if move_direction = 'up' then
    select * into neighbor_activity from public.itinerary_activities
    where itinerary_day_id = current_activity.itinerary_day_id
      and (position, id) < (current_activity.position, current_activity.id)
    order by position desc, id desc limit 1;
  else
    select * into neighbor_activity from public.itinerary_activities
    where itinerary_day_id = current_activity.itinerary_day_id
      and (position, id) > (current_activity.position, current_activity.id)
    order by position asc, id asc limit 1;
  end if;
  if neighbor_activity.id is null then return; end if;

  update public.itinerary_activities
  set position = case
      when id = current_activity.id then neighbor_activity.position
      else current_activity.position
    end,
    updated_by = actor_id
  where id in (current_activity.id, neighbor_activity.id);

  insert into public.audit_logs (
    workspace_id, actor_id, action, resource_type, resource_id, metadata
  ) values (
    current_activity.workspace_id, actor_id, 'itinerary.activity_moved',
    'itinerary_activity', current_activity.id,
    jsonb_build_object('direction', move_direction)
  );
end;
$$;

create or replace function public.remove_itinerary_activity(target_activity_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  activity_record public.itinerary_activities;
begin
  select * into activity_record from public.itinerary_activities where id = target_activity_id;
  if actor_id is null or activity_record.id is null
    or not private.has_workspace_role(activity_record.workspace_id) then
    raise exception 'itinerary_access_denied' using errcode = '42501';
  end if;
  delete from public.itinerary_activities where id = target_activity_id;
  insert into public.audit_logs (
    workspace_id, actor_id, action, resource_type, resource_id, metadata
  ) values (
    activity_record.workspace_id, actor_id, 'itinerary.activity_removed',
    'itinerary_activity', target_activity_id,
    jsonb_build_object('trip_id', activity_record.trip_id, 'day_id', activity_record.itinerary_day_id)
  );
end;
$$;

revoke all on function public.add_itinerary_day(uuid, date, text, text) from public, anon;
grant execute on function public.add_itinerary_day(uuid, date, text, text) to authenticated;
revoke all on function public.add_itinerary_activity(uuid, text, text, text, time, time, boolean) from public, anon;
grant execute on function public.add_itinerary_activity(uuid, text, text, text, time, time, boolean) to authenticated;
revoke all on function public.move_itinerary_activity(uuid, text) from public, anon;
grant execute on function public.move_itinerary_activity(uuid, text) to authenticated;
revoke all on function public.remove_itinerary_activity(uuid) from public, anon;
grant execute on function public.remove_itinerary_activity(uuid) to authenticated;
