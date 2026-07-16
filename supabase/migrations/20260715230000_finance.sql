-- H&NTrip: expense categories, idempotent expenses and soft reversal.

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  name text not null,
  color text not null default '#43C6D9',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  updated_by uuid not null references public.profiles (id),
  archived_at timestamptz,
  constraint expense_categories_name_length check (char_length(name) between 1 and 80),
  constraint expense_categories_color_format check (color ~ '^#[0-9A-Fa-f]{6}$'),
  constraint expense_categories_trip_workspace_fk foreign key (trip_id, workspace_id)
    references public.trips (id, workspace_id) on delete cascade
);

create unique index expense_categories_trip_name_key
  on public.expense_categories (trip_id, lower(name))
  where archived_at is null;
alter table public.expense_categories
  add constraint expense_categories_id_trip_workspace_key unique (id, trip_id, workspace_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  trip_id uuid not null references public.trips (id) on delete cascade,
  category_id uuid not null references public.expense_categories (id),
  description text not null,
  merchant text,
  expense_date date not null,
  amount numeric(14, 2) not null,
  currency text not null,
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references public.profiles (id),
  updated_by uuid not null references public.profiles (id),
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id),
  constraint expenses_description_length check (char_length(description) between 1 and 180),
  constraint expenses_merchant_length check (merchant is null or char_length(merchant) <= 120),
  constraint expenses_amount_positive check (amount > 0),
  constraint expenses_currency_iso_format check (currency ~ '^[A-Z]{3}$'),
  constraint expenses_trip_workspace_fk foreign key (trip_id, workspace_id)
    references public.trips (id, workspace_id) on delete cascade,
  constraint expenses_category_trip_workspace_fk foreign key (category_id, trip_id, workspace_id)
    references public.expense_categories (id, trip_id, workspace_id)
);

create unique index expenses_workspace_idempotency_key
  on public.expenses (workspace_id, idempotency_key);
create index expenses_trip_date_idx
  on public.expenses (trip_id, expense_date desc, created_at desc, id desc)
  where deleted_at is null;
create index expenses_trip_category_idx
  on public.expenses (trip_id, category_id, id)
  where deleted_at is null;

create trigger expense_categories_set_updated_at
before update on public.expense_categories
for each row execute function private.set_updated_at();
create trigger expenses_set_updated_at
before update on public.expenses
for each row execute function private.set_updated_at();

alter table public.expense_categories enable row level security;
alter table public.expense_categories force row level security;
alter table public.expenses enable row level security;
alter table public.expenses force row level security;

create policy expense_categories_select_member
on public.expense_categories for select to authenticated
using ((select private.has_workspace_role(workspace_id)));
create policy expenses_select_member
on public.expenses for select to authenticated
using ((select private.has_workspace_role(workspace_id)));

revoke all on public.expense_categories, public.expenses from anon, authenticated;
grant select on public.expense_categories, public.expenses to authenticated;

create or replace function public.add_expense_category(
  target_trip_id uuid,
  category_name text,
  category_color text
)
returns public.expense_categories
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  trip_record public.trips;
  created_category public.expense_categories;
begin
  select * into trip_record from public.trips where id = target_trip_id and archived_at is null;
  if actor_id is null or trip_record.id is null
    or not private.has_workspace_role(trip_record.workspace_id) then
    raise exception 'trip_access_denied' using errcode = '42501';
  end if;

  insert into public.expense_categories (
    workspace_id, trip_id, name, color, created_by, updated_by
  ) values (
    trip_record.workspace_id, target_trip_id, trim(category_name),
    upper(category_color), actor_id, actor_id
  ) returning * into created_category;

  insert into public.audit_logs (
    workspace_id, actor_id, action, resource_type, resource_id, metadata
  ) values (
    trip_record.workspace_id, actor_id, 'finance.category_added',
    'expense_category', created_category.id, jsonb_build_object('trip_id', target_trip_id)
  );
  return created_category;
end;
$$;

create or replace function public.add_expense(
  target_trip_id uuid,
  target_category_id uuid,
  expense_description text,
  expense_merchant text,
  target_expense_date date,
  expense_amount numeric,
  request_idempotency_key uuid
)
returns public.expenses
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  trip_record public.trips;
  created_expense public.expenses;
begin
  select * into trip_record from public.trips where id = target_trip_id and archived_at is null;
  if actor_id is null or trip_record.id is null
    or not private.has_workspace_role(trip_record.workspace_id) then
    raise exception 'trip_access_denied' using errcode = '42501';
  end if;
  select * into created_expense
  from public.expenses
  where workspace_id = trip_record.workspace_id
    and idempotency_key = request_idempotency_key;
  if created_expense.id is not null then
    if created_expense.trip_id <> target_trip_id then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;
    return created_expense;
  end if;

  insert into public.expenses (
    workspace_id, trip_id, category_id, description, merchant, expense_date,
    amount, currency, idempotency_key, created_by, updated_by
  ) values (
    trip_record.workspace_id, target_trip_id, target_category_id,
    trim(expense_description), nullif(trim(expense_merchant), ''), target_expense_date,
    expense_amount, trip_record.base_currency, request_idempotency_key, actor_id, actor_id
  ) returning * into created_expense;

  insert into public.audit_logs (
    workspace_id, actor_id, action, resource_type, resource_id, metadata
  ) values (
    trip_record.workspace_id, actor_id, 'finance.expense_added', 'expense',
    created_expense.id,
    jsonb_build_object('trip_id', target_trip_id, 'amount', created_expense.amount, 'currency', created_expense.currency)
  );
  return created_expense;
end;
$$;

create or replace function public.reverse_expense(target_expense_id uuid)
returns public.expenses
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := (select auth.uid());
  expense_record public.expenses;
begin
  select * into expense_record from public.expenses where id = target_expense_id;
  if actor_id is null or expense_record.id is null
    or not private.has_workspace_role(expense_record.workspace_id) then
    raise exception 'expense_access_denied' using errcode = '42501';
  end if;
  if expense_record.deleted_at is not null then return expense_record; end if;

  update public.expenses
  set deleted_at = now(), deleted_by = actor_id, updated_by = actor_id
  where id = target_expense_id
  returning * into expense_record;

  insert into public.audit_logs (
    workspace_id, actor_id, action, resource_type, resource_id, metadata
  ) values (
    expense_record.workspace_id, actor_id, 'finance.expense_reversed', 'expense',
    expense_record.id,
    jsonb_build_object('trip_id', expense_record.trip_id, 'amount', expense_record.amount, 'currency', expense_record.currency)
  );
  return expense_record;
end;
$$;

revoke all on function public.add_expense_category(uuid, text, text) from public, anon;
grant execute on function public.add_expense_category(uuid, text, text) to authenticated;
revoke all on function public.add_expense(uuid, uuid, text, text, date, numeric, uuid) from public, anon;
grant execute on function public.add_expense(uuid, uuid, text, text, date, numeric, uuid) to authenticated;
revoke all on function public.reverse_expense(uuid) from public, anon;
grant execute on function public.reverse_expense(uuid) to authenticated;
