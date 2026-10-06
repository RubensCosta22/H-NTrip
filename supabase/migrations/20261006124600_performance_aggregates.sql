-- Aggregate helpers: keep large expense/checklist datasets inside PostgreSQL.
-- These functions remain SECURITY INVOKER (the default), so existing RLS still applies.
create or replace function public.trip_expense_total(p_trip_id uuid, p_workspace_id uuid)
returns numeric
language sql
stable
set search_path = ''
as $$
  select coalesce(sum(e.amount), 0)
  from public.expenses e
  where e.trip_id = p_trip_id
    and e.workspace_id = p_workspace_id
    and e.deleted_at is null;
$$;

create or replace function public.trip_checklist_stats(p_trip_id uuid, p_workspace_id uuid)
returns table(total bigint, completed bigint)
language sql
stable
set search_path = ''
as $$
  select count(*)::bigint,
         count(*) filter (where i.is_completed)::bigint
  from public.checklist_items i
  where i.trip_id = p_trip_id
    and i.workspace_id = p_workspace_id;
$$;

revoke execute on function public.trip_expense_total(uuid, uuid) from public, anon;
revoke execute on function public.trip_checklist_stats(uuid, uuid) from public, anon;
grant execute on function public.trip_expense_total(uuid, uuid) to authenticated;
grant execute on function public.trip_checklist_stats(uuid, uuid) to authenticated;
