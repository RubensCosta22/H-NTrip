-- Category-level limits and quick value-only finance items.
alter table public.expense_categories
  add column if not exists budget_limit numeric(14,2);
alter table public.expense_categories
  add constraint expense_categories_budget_nonnegative check (budget_limit is null or budget_limit >= 0);

create table public.finance_items (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  trip_id uuid not null references public.trips(id) on delete cascade,
  category_id uuid not null references public.expense_categories(id),
  name text not null,
  actual_amount numeric(14,2),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles(id),
  updated_by uuid not null references public.profiles(id),
  constraint finance_items_name_length check (char_length(name) between 1 and 120),
  constraint finance_items_amount_nonnegative check (actual_amount is null or actual_amount >= 0),
  constraint finance_items_trip_workspace_fk foreign key (trip_id, workspace_id) references public.trips(id, workspace_id) on delete cascade,
  constraint finance_items_category_trip_workspace_fk foreign key (category_id, trip_id, workspace_id) references public.expense_categories(id, trip_id, workspace_id)
);
create unique index finance_items_trip_category_name_key on public.finance_items(trip_id, category_id, lower(name));
create index finance_items_trip_sort_idx on public.finance_items(trip_id, category_id, sort_order, id);
create trigger finance_items_set_updated_at before update on public.finance_items for each row execute function private.set_updated_at();

alter table public.finance_items enable row level security;
alter table public.finance_items force row level security;
create policy finance_items_select_member on public.finance_items for select to authenticated using ((select private.has_workspace_role(workspace_id)));
revoke all on public.finance_items from anon, authenticated;
grant select on public.finance_items to authenticated;

create or replace function public.save_finance_item_amount(target_item_id uuid, item_amount numeric)
returns public.finance_items
language plpgsql
security definer
set search_path = ''
as $$
declare actor_id uuid := (select auth.uid()); item_record public.finance_items;
begin
  if item_amount is null or item_amount < 0 then raise exception 'invalid_amount' using errcode='22003'; end if;
  select * into item_record from public.finance_items where id=target_item_id;
  if actor_id is null or item_record.id is null or not private.has_workspace_role(item_record.workspace_id) then raise exception 'finance_item_access_denied' using errcode='42501'; end if;
  update public.finance_items set actual_amount=item_amount, updated_by=actor_id where id=target_item_id returning * into item_record;
  insert into public.audit_logs(workspace_id,actor_id,action,resource_type,resource_id,metadata)
  values(item_record.workspace_id,actor_id,'finance.item_amount_saved','finance_item',item_record.id,jsonb_build_object('trip_id',item_record.trip_id,'amount',item_record.actual_amount));
  return item_record;
end; $$;
revoke all on function public.save_finance_item_amount(uuid,numeric) from public,anon;
grant execute on function public.save_finance_item_amount(uuid,numeric) to authenticated;

create or replace function public.trip_expense_total(p_trip_id uuid, p_workspace_id uuid)
returns numeric language sql stable set search_path=''
as $$
  select coalesce((select sum(i.actual_amount) from public.finance_items i where i.trip_id=p_trip_id and i.workspace_id=p_workspace_id),0)
       + coalesce((select sum(e.amount) from public.expenses e where e.trip_id=p_trip_id and e.workspace_id=p_workspace_id and e.deleted_at is null),0);
$$;
revoke execute on function public.trip_expense_total(uuid,uuid) from public,anon;
grant execute on function public.trip_expense_total(uuid,uuid) to authenticated;
