create or replace function public.system_health()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select true $$;

revoke all on function public.system_health() from public;
grant execute on function public.system_health() to anon, authenticated;

comment on function public.system_health() is
  'Minimal readiness probe. Returns no project, user, workspace or database metadata.';
