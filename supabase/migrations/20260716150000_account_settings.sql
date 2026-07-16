-- H&NTrip: audited profile and owner-only workspace settings.

revoke update on public.profiles from authenticated;
revoke update on public.workspaces from authenticated;

create or replace function public.update_account_settings(
  profile_display_name text,
  workspace_name text
)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  member_record public.workspace_members;
  previous_profile_name text;
  previous_workspace_name text;
  normalized_profile_name text := nullif(btrim(profile_display_name), '');
  normalized_workspace_name text := nullif(btrim(workspace_name), '');
begin
  select * into member_record from public.workspace_members
  where user_id = actor_id and status = 'active' order by created_at limit 1;
  if actor_id is null or member_record.id is null then
    raise exception 'account_settings_access_denied' using errcode = '42501';
  end if;
  if normalized_profile_name is not null and char_length(normalized_profile_name) > 120 then
    raise exception 'invalid_display_name' using errcode = '22023';
  end if;
  if normalized_workspace_name is null or char_length(normalized_workspace_name) > 120 then
    raise exception 'invalid_workspace_name' using errcode = '22023';
  end if;

  select display_name into previous_profile_name from public.profiles where id = actor_id;
  if previous_profile_name is distinct from normalized_profile_name then
    update public.profiles set display_name = normalized_profile_name, updated_at = now()
    where id = actor_id;
    insert into public.audit_logs (
      workspace_id, actor_id, action, resource_type, resource_id
    ) values (
      member_record.workspace_id, actor_id, 'profile.updated', 'profile', actor_id
    );
  end if;

  select name into previous_workspace_name from public.workspaces
  where id = member_record.workspace_id;
  if previous_workspace_name is distinct from normalized_workspace_name then
    if member_record.role <> 'owner' then
      raise exception 'workspace_owner_required' using errcode = '42501';
    end if;
    update public.workspaces
    set name = normalized_workspace_name, updated_by = actor_id
    where id = member_record.workspace_id;
    insert into public.audit_logs (
      workspace_id, actor_id, action, resource_type, resource_id
    ) values (
      member_record.workspace_id, actor_id, 'workspace.updated',
      'workspace', member_record.workspace_id
    );
  end if;
end;
$$;

revoke all on function public.update_account_settings(text, text) from public, anon;
grant execute on function public.update_account_settings(text, text) to authenticated;

comment on function public.update_account_settings(text, text) is
  'Updates the caller profile; only an active owner may rename the workspace. Both changes are audited.';
