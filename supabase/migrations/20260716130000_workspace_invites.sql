-- H&NTrip: one-time hashed workspace invitations and owner-controlled membership.

create table public.workspace_invites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  email text not null,
  role public.workspace_role not null default 'admin',
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.profiles (id),
  revoked_at timestamptz,
  revoked_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  constraint workspace_invites_email_length check (char_length(email) between 3 and 254),
  constraint workspace_invites_expiration check (expires_at > created_at),
  constraint workspace_invites_terminal_state check (used_at is null or revoked_at is null)
);

create unique index workspace_invites_active_email_key
  on public.workspace_invites (workspace_id, lower(email))
  where used_at is null and revoked_at is null;
create index workspace_invites_workspace_created_idx
  on public.workspace_invites (workspace_id, created_at desc, id desc);

alter table public.workspace_invites enable row level security;
alter table public.workspace_invites force row level security;
create policy workspace_invites_select_member on public.workspace_invites for select to authenticated
using ((select private.has_workspace_role(workspace_id)));
revoke all on public.workspace_invites from anon, authenticated;
grant select on public.workspace_invites to authenticated;

-- Membership mutations must go through audited functions, never direct table writes.
revoke insert, update, delete on public.workspace_members from authenticated;

create or replace function private.is_workspace_owner(target_workspace_id uuid, actor_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = target_workspace_id and user_id = actor_id
      and role = 'owner' and status = 'active'
  );
$$;

create or replace function public.create_workspace_invite(
  invited_email text,
  invited_role public.workspace_role default 'admin'
)
returns table (invite_id uuid, raw_token text, expires_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_workspace_id uuid;
  generated_token text := encode(extensions.gen_random_bytes(32), 'hex');
  created_invite public.workspace_invites;
begin
  select workspace_id into actor_workspace_id from public.workspace_members
  where user_id = actor_id and role = 'owner' and status = 'active'
  order by created_at limit 1;
  if actor_workspace_id is null then
    raise exception 'invite_owner_required' using errcode = '42501';
  end if;
  if invited_email is null or char_length(btrim(invited_email)) not between 3 and 254
    or invited_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'invalid_invite_email' using errcode = '22023';
  end if;

  insert into public.workspace_invites (
    workspace_id, email, role, token_hash, expires_at, created_by
  ) values (
    actor_workspace_id, lower(btrim(invited_email)), invited_role,
    extensions.digest(generated_token, 'sha256'), now() + interval '7 days', actor_id
  ) returning * into created_invite;

  insert into public.audit_logs (
    workspace_id, actor_id, action, resource_type, resource_id, metadata
  ) values (
    actor_workspace_id, actor_id, 'workspace.invite_created', 'workspace_invite',
    created_invite.id, jsonb_build_object('role', invited_role, 'expires_at', created_invite.expires_at)
  );
  return query select created_invite.id, generated_token, created_invite.expires_at;
end;
$$;

create or replace function public.validate_workspace_invite(invite_token text, invited_email text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.workspace_invites
    where token_hash = extensions.digest(invite_token, 'sha256')
      and email = lower(btrim(invited_email))
      and used_at is null and revoked_at is null and expires_at > now()
  );
$$;

create or replace function public.accept_workspace_invite(invite_token text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  actor_email text;
  invite_record public.workspace_invites;
begin
  if actor_id is null then raise exception 'authentication_required' using errcode = '42501'; end if;
  select lower(email) into actor_email from auth.users where id = actor_id;
  select * into invite_record from public.workspace_invites
  where token_hash = extensions.digest(invite_token, 'sha256')
    and email = actor_email and used_at is null and revoked_at is null and expires_at > now()
  for update;
  if invite_record.id is null then raise exception 'invalid_or_expired_invite' using errcode = '42501'; end if;

  insert into public.workspace_members (
    workspace_id, user_id, role, status, invited_at, joined_at, created_by, updated_by
  ) values (
    invite_record.workspace_id, actor_id, invite_record.role, 'active',
    invite_record.created_at, now(), actor_id, actor_id
  ) on conflict (workspace_id, user_id) do update set
    role = excluded.role, status = 'active', joined_at = now(), deactivated_at = null,
    updated_by = actor_id;
  update public.workspace_invites set used_at = now(), used_by = actor_id where id = invite_record.id;
  insert into public.audit_logs (
    workspace_id, actor_id, action, resource_type, resource_id, metadata
  ) values (
    invite_record.workspace_id, actor_id, 'workspace.invite_accepted',
    'workspace_invite', invite_record.id, jsonb_build_object('role', invite_record.role)
  );
  return invite_record.workspace_id;
end;
$$;

create or replace function public.revoke_workspace_invite(target_invite_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare actor_id uuid := (select auth.uid()); invite_record public.workspace_invites;
begin
  select * into invite_record from public.workspace_invites where id = target_invite_id and used_at is null and revoked_at is null;
  if invite_record.id is null or not private.is_workspace_owner(invite_record.workspace_id, actor_id) then
    raise exception 'invite_owner_required' using errcode = '42501';
  end if;
  update public.workspace_invites set revoked_at = now(), revoked_by = actor_id where id = target_invite_id;
  insert into public.audit_logs (workspace_id, actor_id, action, resource_type, resource_id)
  values (invite_record.workspace_id, actor_id, 'workspace.invite_revoked', 'workspace_invite', target_invite_id);
end;
$$;

create or replace function public.deactivate_workspace_member(target_membership_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare actor_id uuid := (select auth.uid()); member_record public.workspace_members;
begin
  select * into member_record from public.workspace_members where id = target_membership_id and status = 'active';
  if member_record.id is null or actor_id = member_record.user_id
    or not private.is_workspace_owner(member_record.workspace_id, actor_id) then
    raise exception 'member_deactivation_denied' using errcode = '42501';
  end if;
  update public.workspace_members set status = 'inactive', deactivated_at = now(), updated_by = actor_id
  where id = target_membership_id;
  insert into public.audit_logs (workspace_id, actor_id, action, resource_type, resource_id, metadata)
  values (member_record.workspace_id, actor_id, 'workspace.member_deactivated', 'workspace_member',
    target_membership_id, jsonb_build_object('role', member_record.role));
end;
$$;

revoke all on function public.create_workspace_invite(text, public.workspace_role) from public, anon;
grant execute on function public.create_workspace_invite(text, public.workspace_role) to authenticated;
revoke all on function public.validate_workspace_invite(text, text) from public;
grant execute on function public.validate_workspace_invite(text, text) to anon, authenticated;
revoke all on function public.accept_workspace_invite(text) from public, anon;
grant execute on function public.accept_workspace_invite(text) to authenticated;
revoke all on function public.revoke_workspace_invite(uuid) from public, anon;
grant execute on function public.revoke_workspace_invite(uuid) to authenticated;
revoke all on function public.deactivate_workspace_member(uuid) from public, anon;
grant execute on function public.deactivate_workspace_member(uuid) to authenticated;

comment on column public.workspace_invites.token_hash is
  'SHA-256 hash only. The raw one-time token is returned once and never stored.';
