-- H&NTrip: checklists, stable item ordering and audited completion.

create table public.checklists (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  updated_by uuid not null references public.profiles (id),
  archived_at timestamptz,
  constraint checklists_name_length check (char_length(name) between 1 and 100),
  constraint checklists_description_length check (description is null or char_length(description) <= 500),
  constraint checklists_trip_workspace_fk foreign key (trip_id, workspace_id)
    references public.trips (id, workspace_id) on delete cascade
);

create unique index checklists_trip_name_key
  on public.checklists (trip_id, lower(name)) where archived_at is null;
alter table public.checklists
  add constraint checklists_id_trip_workspace_key unique (id, trip_id, workspace_id);

create table public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  checklist_id uuid not null references public.checklists (id) on delete cascade,
  title text not null,
  notes text,
  assignee_name text,
  due_date date,
  position numeric(20, 10) not null,
  is_completed boolean not null default false,
  completed_at timestamptz,
  completed_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  updated_by uuid not null references public.profiles (id),
  constraint checklist_items_title_length check (char_length(title) between 1 and 180),
  constraint checklist_items_notes_length check (notes is null or char_length(notes) <= 1000),
  constraint checklist_items_assignee_length check (assignee_name is null or char_length(assignee_name) <= 120),
  constraint checklist_items_position_positive check (position > 0),
  constraint checklist_items_completion_state check (
    (is_completed = false and completed_at is null and completed_by is null)
    or (is_completed = true and completed_at is not null and completed_by is not null)
  ),
  constraint checklist_items_list_trip_workspace_fk
    foreign key (checklist_id, trip_id, workspace_id)
    references public.checklists (id, trip_id, workspace_id) on delete cascade
);

create index checklists_trip_created_idx
  on public.checklists (trip_id, created_at, id) where archived_at is null;
create index checklist_items_list_position_idx
  on public.checklist_items (checklist_id, position, id);
create index checklist_items_trip_pending_idx
  on public.checklist_items (trip_id, due_date, id) where is_completed = false;

create trigger checklists_set_updated_at before update on public.checklists
for each row execute function private.set_updated_at();
create trigger checklist_items_set_updated_at before update on public.checklist_items
for each row execute function private.set_updated_at();

alter table public.checklists enable row level security;
alter table public.checklists force row level security;
alter table public.checklist_items enable row level security;
alter table public.checklist_items force row level security;

create policy checklists_select_member on public.checklists for select to authenticated
using ((select private.has_workspace_role(workspace_id)));
create policy checklist_items_select_member on public.checklist_items for select to authenticated
using ((select private.has_workspace_role(workspace_id)));

revoke all on public.checklists, public.checklist_items from anon, authenticated;
grant select on public.checklists, public.checklist_items to authenticated;

create or replace function public.add_checklist(
  target_trip_id uuid, checklist_name text, checklist_description text
)
returns public.checklists
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  trip_record public.trips;
  created_list public.checklists;
begin
  select * into trip_record from public.trips where id = target_trip_id and archived_at is null;
  if actor_id is null or trip_record.id is null
    or not private.has_workspace_role(trip_record.workspace_id) then
    raise exception 'trip_access_denied' using errcode = '42501';
  end if;
  insert into public.checklists (
    workspace_id, trip_id, name, description, created_by, updated_by
  ) values (
    trip_record.workspace_id, target_trip_id, trim(checklist_name),
    nullif(trim(checklist_description), ''), actor_id, actor_id
  ) returning * into created_list;
  insert into public.audit_logs (
    workspace_id, actor_id, action, resource_type, resource_id, metadata
  ) values (
    trip_record.workspace_id, actor_id, 'checklist.created', 'checklist',
    created_list.id, jsonb_build_object('trip_id', target_trip_id)
  );
  return created_list;
end;
$$;

create or replace function public.add_checklist_item(
  target_checklist_id uuid,
  item_title text,
  item_notes text,
  item_assignee_name text,
  item_due_date date
)
returns public.checklist_items
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  list_record public.checklists;
  next_position numeric(20, 10);
  created_item public.checklist_items;
begin
  select * into list_record from public.checklists
  where id = target_checklist_id and archived_at is null;
  if actor_id is null or list_record.id is null
    or not private.has_workspace_role(list_record.workspace_id) then
    raise exception 'checklist_access_denied' using errcode = '42501';
  end if;
  select coalesce(max(position), 0) + 1024 into next_position
  from public.checklist_items where checklist_id = target_checklist_id;
  insert into public.checklist_items (
    workspace_id, trip_id, checklist_id, title, notes, assignee_name,
    due_date, position, created_by, updated_by
  ) values (
    list_record.workspace_id, list_record.trip_id, target_checklist_id,
    trim(item_title), nullif(trim(item_notes), ''),
    nullif(trim(item_assignee_name), ''), item_due_date,
    next_position, actor_id, actor_id
  ) returning * into created_item;
  insert into public.audit_logs (
    workspace_id, actor_id, action, resource_type, resource_id, metadata
  ) values (
    list_record.workspace_id, actor_id, 'checklist.item_added', 'checklist_item',
    created_item.id, jsonb_build_object('trip_id', list_record.trip_id, 'checklist_id', target_checklist_id)
  );
  return created_item;
end;
$$;

create or replace function public.set_checklist_item_completion(
  target_item_id uuid, completed boolean
)
returns public.checklist_items
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  item_record public.checklist_items;
begin
  select * into item_record from public.checklist_items where id = target_item_id;
  if actor_id is null or item_record.id is null
    or not private.has_workspace_role(item_record.workspace_id) then
    raise exception 'checklist_access_denied' using errcode = '42501';
  end if;
  update public.checklist_items
  set is_completed = completed,
      completed_at = case when completed then now() else null end,
      completed_by = case when completed then actor_id else null end,
      updated_by = actor_id
  where id = target_item_id
  returning * into item_record;
  insert into public.audit_logs (
    workspace_id, actor_id, action, resource_type, resource_id, metadata
  ) values (
    item_record.workspace_id, actor_id,
    case when completed then 'checklist.item_completed' else 'checklist.item_reopened' end,
    'checklist_item', item_record.id,
    jsonb_build_object('trip_id', item_record.trip_id, 'checklist_id', item_record.checklist_id)
  );
  return item_record;
end;
$$;

create or replace function public.move_checklist_item(
  target_item_id uuid, move_direction text
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  current_item public.checklist_items;
  neighbor_item public.checklist_items;
begin
  if move_direction not in ('up', 'down') then
    raise exception 'invalid_move_direction' using errcode = '22023';
  end if;
  select * into current_item from public.checklist_items where id = target_item_id;
  if actor_id is null or current_item.id is null
    or not private.has_workspace_role(current_item.workspace_id) then
    raise exception 'checklist_access_denied' using errcode = '42501';
  end if;
  if move_direction = 'up' then
    select * into neighbor_item from public.checklist_items
    where checklist_id = current_item.checklist_id
      and (position, id) < (current_item.position, current_item.id)
    order by position desc, id desc limit 1;
  else
    select * into neighbor_item from public.checklist_items
    where checklist_id = current_item.checklist_id
      and (position, id) > (current_item.position, current_item.id)
    order by position asc, id asc limit 1;
  end if;
  if neighbor_item.id is null then return; end if;
  update public.checklist_items
  set position = case when id = current_item.id then neighbor_item.position else current_item.position end,
      updated_by = actor_id
  where id in (current_item.id, neighbor_item.id);
end;
$$;

create or replace function public.remove_checklist_item(target_item_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  item_record public.checklist_items;
begin
  select * into item_record from public.checklist_items where id = target_item_id;
  if actor_id is null or item_record.id is null
    or not private.has_workspace_role(item_record.workspace_id) then
    raise exception 'checklist_access_denied' using errcode = '42501';
  end if;
  delete from public.checklist_items where id = target_item_id;
  insert into public.audit_logs (
    workspace_id, actor_id, action, resource_type, resource_id, metadata
  ) values (
    item_record.workspace_id, actor_id, 'checklist.item_removed', 'checklist_item',
    target_item_id, jsonb_build_object('trip_id', item_record.trip_id, 'checklist_id', item_record.checklist_id)
  );
end;
$$;

revoke all on function public.add_checklist(uuid, text, text) from public, anon;
grant execute on function public.add_checklist(uuid, text, text) to authenticated;
revoke all on function public.add_checklist_item(uuid, text, text, text, date) from public, anon;
grant execute on function public.add_checklist_item(uuid, text, text, text, date) to authenticated;
revoke all on function public.set_checklist_item_completion(uuid, boolean) from public, anon;
grant execute on function public.set_checklist_item_completion(uuid, boolean) to authenticated;
revoke all on function public.move_checklist_item(uuid, text) from public, anon;
grant execute on function public.move_checklist_item(uuid, text) to authenticated;
revoke all on function public.remove_checklist_item(uuid) from public, anon;
grant execute on function public.remove_checklist_item(uuid) to authenticated;

comment on column public.checklist_items.assignee_name is
  'Informational responsibility label only; never grants workspace access.';
