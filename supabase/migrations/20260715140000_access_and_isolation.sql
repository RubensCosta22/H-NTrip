-- H&NTrip: access foundation and workspace isolation.
-- Forward-only migration. Corrections must be delivered as a new migration.

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create type public.workspace_role as enum ('owner', 'admin');
create type public.membership_status as enum ('active', 'inactive');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length check (
    display_name is null or char_length(display_name) between 1 and 120
  )
);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  updated_by uuid not null references public.profiles (id),
  archived_at timestamptz,
  constraint workspaces_name_length check (char_length(name) between 1 and 120),
  constraint workspaces_slug_format check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint workspaces_slug_length check (char_length(slug) between 3 and 80),
  constraint workspaces_slug_key unique (slug)
);

create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.workspace_role not null,
  status public.membership_status not null default 'active',
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  deactivated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  updated_by uuid not null references public.profiles (id),
  constraint workspace_members_workspace_user_key unique (workspace_id, user_id),
  constraint workspace_members_status_dates check (
    (status = 'active' and deactivated_at is null)
    or (status = 'inactive' and deactivated_at is not null)
  ),
  constraint workspace_members_joined_after_invited check (
    joined_at is null or joined_at >= invited_at
  )
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  request_id text,
  constraint audit_logs_action_length check (char_length(action) between 1 and 100),
  constraint audit_logs_resource_type_length check (char_length(resource_type) between 1 and 80),
  constraint audit_logs_metadata_object check (jsonb_typeof(metadata) = 'object'),
  constraint audit_logs_request_id_length check (
    request_id is null or char_length(request_id) between 1 and 128
  )
);

create index workspace_members_user_active_idx
  on public.workspace_members (user_id, workspace_id)
  where status = 'active';
create index workspace_members_workspace_active_idx
  on public.workspace_members (workspace_id, user_id)
  where status = 'active';
create index audit_logs_workspace_occurred_idx
  on public.audit_logs (workspace_id, occurred_at desc, id desc);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger workspaces_set_updated_at
before update on public.workspaces
for each row execute function private.set_updated_at();

create trigger workspace_members_set_updated_at
before update on public.workspace_members
for each row execute function private.set_updated_at();

create or replace function private.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 120), '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function private.create_profile_for_auth_user() from public, anon, authenticated;

create trigger auth_user_created_profile
after insert on auth.users
for each row execute function private.create_profile_for_auth_user();

create or replace function private.has_workspace_role(
  target_workspace_id uuid,
  allowed_roles public.workspace_role[] default array['owner', 'admin']::public.workspace_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspace_members as member
    where member.workspace_id = target_workspace_id
      and member.user_id = (select auth.uid())
      and member.status = 'active'
      and member.role = any(allowed_roles)
  );
$$;

revoke all on function private.has_workspace_role(uuid, public.workspace_role[]) from public, anon;
grant execute on function private.has_workspace_role(uuid, public.workspace_role[]) to authenticated;

create or replace function private.can_view_profile(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    target_user_id = (select auth.uid())
    or exists (
      select 1
      from public.workspace_members mine
      join public.workspace_members theirs
        on theirs.workspace_id = mine.workspace_id
      where mine.user_id = (select auth.uid())
        and mine.status = 'active'
        and theirs.user_id = target_user_id
        and theirs.status = 'active'
    );
$$;

revoke all on function private.can_view_profile(uuid) from public, anon;
grant execute on function private.can_view_profile(uuid) to authenticated;

create or replace function private.ensure_workspace_has_active_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  affected_workspace_id uuid := coalesce(new.workspace_id, old.workspace_id);
begin
  if not exists (
    select 1
    from public.workspace_members
    where workspace_id = affected_workspace_id
      and role = 'owner'
      and status = 'active'
  ) then
    raise exception 'workspace_must_have_active_owner' using errcode = '23514';
  end if;
  return coalesce(new, old);
end;
$$;

revoke all on function private.ensure_workspace_has_active_owner() from public, anon, authenticated;

create constraint trigger workspace_members_require_active_owner
after insert or update or delete on public.workspace_members
deferrable initially deferred
for each row execute function private.ensure_workspace_has_active_owner();

alter table public.profiles enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.audit_logs enable row level security;

alter table public.profiles force row level security;
alter table public.workspaces force row level security;
alter table public.workspace_members force row level security;
alter table public.audit_logs force row level security;

create policy profiles_select_shared_workspace
on public.profiles for select to authenticated
using ((select private.can_view_profile(id)));

create policy profiles_update_self
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy workspaces_select_member
on public.workspaces for select to authenticated
using ((select private.has_workspace_role(id)));

create policy workspaces_update_admin
on public.workspaces for update to authenticated
using ((select private.has_workspace_role(id)))
with check (
  (select private.has_workspace_role(id))
  and updated_by = (select auth.uid())
);

create policy workspace_members_select_member
on public.workspace_members for select to authenticated
using ((select private.has_workspace_role(workspace_id)));

create policy workspace_members_insert_admin
on public.workspace_members for insert to authenticated
with check (
  (select private.has_workspace_role(workspace_id))
  and created_by = (select auth.uid())
  and updated_by = (select auth.uid())
);

create policy workspace_members_update_admin
on public.workspace_members for update to authenticated
using ((select private.has_workspace_role(workspace_id)))
with check (
  (select private.has_workspace_role(workspace_id))
  and updated_by = (select auth.uid())
);

create policy workspace_members_delete_admin
on public.workspace_members for delete to authenticated
using ((select private.has_workspace_role(workspace_id)));

create policy audit_logs_select_admin
on public.audit_logs for select to authenticated
using ((select private.has_workspace_role(workspace_id)));

revoke all on public.profiles, public.workspaces, public.workspace_members, public.audit_logs from anon;
revoke all on public.profiles, public.workspaces, public.workspace_members, public.audit_logs from authenticated;
grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select on public.workspaces to authenticated;
grant update (name, slug, archived_at, updated_by) on public.workspaces to authenticated;
grant select, delete on public.workspace_members to authenticated;
grant insert (
  workspace_id, user_id, role, status, invited_at, joined_at,
  deactivated_at, created_by, updated_by
) on public.workspace_members to authenticated;
grant update (role, status, joined_at, deactivated_at, updated_by)
  on public.workspace_members to authenticated;
grant select on public.audit_logs to authenticated;

comment on table public.workspace_members is
  'Authorization source of truth. Trip participants never grant application access.';
comment on table public.audit_logs is
  'Append-only security and business audit trail. Writes occur through trusted server operations.';
