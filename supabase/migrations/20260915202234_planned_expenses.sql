-- Additive planning ledger. Existing expenses remain actual payments only.
alter table public.expenses add constraint expenses_id_trip_workspace_key unique (id, trip_id, workspace_id);
alter table public.trip_places add constraint trip_places_id_trip_workspace_key unique (id, trip_id, workspace_id);

create table public.planned_expenses (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete cascade,
 trip_id uuid not null,
 category_id uuid not null,
 description text not null check (char_length(description) between 1 and 180),
 merchant text check (char_length(merchant) <= 120),
 planned_date date not null,
 planned_amount numeric(14,2) not null check (planned_amount > 0 and planned_amount < 'Infinity'::numeric),
 currency text not null check (currency ~ '^[A-Z]{3}$'),
 confirmed_expense_id uuid unique,
 source_place_id uuid unique,
 import_batch_id uuid,
 idempotency_key uuid not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 created_by uuid not null references public.profiles(id), updated_by uuid not null references public.profiles(id),
 cancelled_at timestamptz, cancelled_by uuid references public.profiles(id),
 constraint planned_expenses_cancel_state check ((cancelled_at is null) = (cancelled_by is null)),
 constraint planned_expenses_id_trip_workspace_key unique(id,trip_id,workspace_id),
 constraint planned_expenses_request_key unique(workspace_id,idempotency_key),
 constraint planned_expenses_trip_fk foreign key(trip_id,workspace_id) references public.trips(id,workspace_id) on delete cascade,
 constraint planned_expenses_category_fk foreign key(category_id,trip_id,workspace_id) references public.expense_categories(id,trip_id,workspace_id),
 constraint planned_expenses_payment_fk foreign key(confirmed_expense_id,trip_id,workspace_id) references public.expenses(id,trip_id,workspace_id),
 constraint planned_expenses_source_fk foreign key(source_place_id,trip_id,workspace_id) references public.trip_places(id,trip_id,workspace_id)
);
create index planned_expenses_trip_date_idx on public.planned_expenses(trip_id,planned_date,id) where cancelled_at is null;
create index planned_expenses_category_idx on public.planned_expenses(category_id,trip_id,workspace_id);
create index planned_expenses_workspace_idx on public.planned_expenses(workspace_id);

create table public.planned_expense_confirmations (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null,
 trip_id uuid not null,
 planned_expense_id uuid not null,
 expense_id uuid not null unique,
 idempotency_key uuid not null,
 amount numeric(14,2) not null check (amount > 0 and amount < 'Infinity'::numeric),
 expense_date date not null,
 created_at timestamptz not null default now(),
 created_by uuid not null references public.profiles(id),
 unique(workspace_id,idempotency_key),
 foreign key(planned_expense_id,trip_id,workspace_id) references public.planned_expenses(id,trip_id,workspace_id) on delete cascade,
 foreign key(expense_id,trip_id,workspace_id) references public.expenses(id,trip_id,workspace_id)
);
create index planned_confirmations_plan_idx on public.planned_expense_confirmations(planned_expense_id,trip_id,workspace_id);
create index planned_confirmations_trip_idx on public.planned_expense_confirmations(trip_id);
create index planned_confirmations_workspace_idx on public.planned_expense_confirmations(workspace_id);

alter table public.planned_expenses enable row level security;
alter table public.planned_expenses force row level security;
alter table public.planned_expense_confirmations enable row level security;
alter table public.planned_expense_confirmations force row level security;
create policy planned_expenses_member_select on public.planned_expenses for select to authenticated using ((select private.has_workspace_role(workspace_id)));
create policy planned_confirmations_member_select on public.planned_expense_confirmations for select to authenticated using ((select private.has_workspace_role(workspace_id)));
revoke all on public.planned_expenses,public.planned_expense_confirmations from public,anon,authenticated;
grant select on public.planned_expenses,public.planned_expense_confirmations to authenticated;
create trigger planned_expenses_updated before update on public.planned_expenses for each row execute function private.set_updated_at();
create trigger planned_expenses_enforce_active_parent_trip before insert or update or delete on public.planned_expenses for each row execute function private.enforce_active_parent_trip();
create trigger planned_confirmations_enforce_active_parent_trip before insert or update or delete on public.planned_expense_confirmations for each row execute function private.enforce_active_parent_trip();

-- Private mutation helpers: no browser-controlled ownership or direct table writes.
create function private.add_planned_expense(target_trip_id uuid,target_category_id uuid,expense_description text,expense_merchant text,target_expense_date date,expense_amount numeric,request_idempotency_key uuid)
returns public.planned_expenses language plpgsql security definer set search_path='' as $$
declare t public.trips; p public.planned_expenses; actor uuid := auth.uid();
begin
 select * into t from public.trips where id=target_trip_id for update;
 if actor is null or t.id is null or not private.has_workspace_role(t.workspace_id) then raise exception 'trip_access_denied' using errcode='42501'; end if;
 if t.archived_at is not null then raise exception 'archived_trip_is_read_only'; end if;
 if expense_amount is null or expense_amount <= 0 or expense_amount >= 1000000000000 or expense_amount <> round(expense_amount,2) or target_expense_date is null or request_idempotency_key is null then raise exception 'invalid_expense_input' using errcode='22023'; end if;
 if not exists(select 1 from public.expense_categories where id=target_category_id and trip_id=t.id and workspace_id=t.workspace_id and archived_at is null) then raise exception 'expense_category_unavailable'; end if;
 select * into p from public.planned_expenses where workspace_id=t.workspace_id and idempotency_key=request_idempotency_key;
 if p.id is not null then
  if p.trip_id<>t.id or p.category_id<>target_category_id or p.description is distinct from trim(expense_description) or p.merchant is distinct from nullif(trim(expense_merchant),'') or p.planned_date<>target_expense_date or p.planned_amount<>expense_amount or p.currency<>t.base_currency then raise exception 'idempotency_key_conflict'; end if;
  return p;
 end if;
 insert into public.planned_expenses(workspace_id,trip_id,category_id,description,merchant,planned_date,planned_amount,currency,idempotency_key,created_by,updated_by)
 values(t.workspace_id,t.id,target_category_id,trim(expense_description),nullif(trim(expense_merchant),''),target_expense_date,expense_amount,t.base_currency,request_idempotency_key,actor,actor) returning * into p;
 insert into public.audit_logs(workspace_id,actor_id,action,resource_type,resource_id,metadata) values(t.workspace_id,actor,'finance.planned_added','planned_expense',p.id,jsonb_build_object('trip_id',t.id));
 return p;
end $$;

create function private.confirm_planned_expense(target_plan_id uuid,actual_amount numeric,actual_date date,request_idempotency_key uuid)
returns public.expenses language plpgsql security definer set search_path='' as $$
declare t public.trips; p public.planned_expenses; e public.expenses; c public.planned_expense_confirmations; actor uuid:=auth.uid();
begin
 select t0.* into t from public.trips t0 join public.planned_expenses p0 on p0.trip_id=t0.id where p0.id=target_plan_id for update of t0;
 if actor is null or t.id is null or not private.has_workspace_role(t.workspace_id) then raise exception 'trip_access_denied' using errcode='42501'; end if;
 if t.archived_at is not null then raise exception 'archived_trip_is_read_only'; end if;
 select * into p from public.planned_expenses where id=target_plan_id for update;
 if actual_amount is null or actual_amount <= 0 or actual_amount >= 1000000000000 or actual_amount <> round(actual_amount,2) or actual_date is null or request_idempotency_key is null then raise exception 'invalid_expense_input' using errcode='22023'; end if;
 select * into c from public.planned_expense_confirmations where workspace_id=t.workspace_id and idempotency_key=request_idempotency_key;
 if c.id is not null then
  if c.planned_expense_id<>p.id or c.amount<>actual_amount or c.expense_date<>actual_date then raise exception 'idempotency_key_conflict'; end if;
  select * into e from public.expenses where id=c.expense_id for update;
  if e.deleted_at is not null then raise exception 'confirmation_reversed'; end if;
  return e;
 end if;
 if p.cancelled_at is not null then raise exception 'planned_expense_cancelled'; end if;
 if p.currency<>t.base_currency then raise exception 'currency_changed'; end if;
 if p.confirmed_expense_id is not null then
  select * into e from public.expenses where id=p.confirmed_expense_id for update;
  if e.deleted_at is null then raise exception 'planned_expense_already_confirmed'; end if;
 end if;
 -- The expense key is generated internally; client keys cannot attach unrelated payments.
 e := public.add_expense(t.id,p.category_id,p.description,p.merchant,actual_date,actual_amount,gen_random_uuid());
 insert into public.planned_expense_confirmations(workspace_id,trip_id,planned_expense_id,expense_id,idempotency_key,amount,expense_date,created_by)
 values(t.workspace_id,t.id,p.id,e.id,request_idempotency_key,actual_amount,actual_date,actor);
 update public.planned_expenses set confirmed_expense_id=e.id,updated_by=actor where id=p.id;
 insert into public.audit_logs(workspace_id,actor_id,action,resource_type,resource_id,metadata) values(t.workspace_id,actor,'finance.planned_confirmed','planned_expense',p.id,jsonb_build_object('trip_id',t.id,'expense_id',e.id));
 return e;
end $$;

create function private.cancel_planned_expense(target_plan_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare t public.trips; p public.planned_expenses; actor uuid:=auth.uid();
begin
 select t0.* into t from public.trips t0 join public.planned_expenses p0 on p0.trip_id=t0.id where p0.id=target_plan_id for update of t0;
 if actor is null or t.id is null or not private.has_workspace_role(t.workspace_id) then raise exception 'trip_access_denied' using errcode='42501'; end if;
 if t.archived_at is not null then raise exception 'archived_trip_is_read_only'; end if;
 select * into p from public.planned_expenses where id=target_plan_id for update;
 if p.cancelled_at is not null then return; end if;
 perform 1 from public.expenses where id=p.confirmed_expense_id and deleted_at is null for update;
 if found then raise exception 'reverse_expense_before_cancel'; end if;
 update public.planned_expenses set cancelled_at=now(),cancelled_by=actor,updated_by=actor where id=p.id;
 insert into public.audit_logs(workspace_id,actor_id,action,resource_type,resource_id,metadata) values(t.workspace_id,actor,'finance.planned_cancelled','planned_expense',p.id,jsonb_build_object('trip_id',t.id));
end $$;

-- Same trip -> plan -> expense order for old and new callers of reversal.
create function private.reverse_expense_with_plan(target_expense_id uuid) returns public.expenses language plpgsql security definer set search_path='' as $$
declare t public.trips; e public.expenses; actor uuid:=auth.uid();
begin
 select t0.* into t from public.trips t0 join public.expenses e0 on e0.trip_id=t0.id where e0.id=target_expense_id for update of t0;
 if actor is null or t.id is null or not private.has_workspace_role(t.workspace_id) then raise exception 'expense_access_denied' using errcode='42501'; end if;
 if t.archived_at is not null then raise exception 'archived_trip_is_read_only'; end if;
 perform 1 from public.planned_expenses where confirmed_expense_id=target_expense_id for update;
 select * into e from public.expenses where id=target_expense_id for update;
 if e.deleted_at is not null then return e; end if;
 update public.expenses set deleted_at=now(),deleted_by=actor,updated_by=actor where id=e.id returning * into e;
 insert into public.audit_logs(workspace_id,actor_id,action,resource_type,resource_id,metadata) values(t.workspace_id,actor,'finance.expense_reversed','expense',e.id,jsonb_build_object('trip_id',t.id,'amount',e.amount,'currency',e.currency));
 return e;
end $$;

create function public.add_planned_expense(target_trip_id uuid,target_category_id uuid,expense_description text,expense_merchant text,target_expense_date date,expense_amount numeric,request_idempotency_key uuid)
returns public.planned_expenses language sql security invoker set search_path='' as $$ select private.add_planned_expense(target_trip_id,target_category_id,expense_description,expense_merchant,target_expense_date,expense_amount,request_idempotency_key); $$;
create function public.confirm_planned_expense(target_plan_id uuid,actual_amount numeric,actual_date date,request_idempotency_key uuid)
returns public.expenses language sql security invoker set search_path='' as $$ select private.confirm_planned_expense(target_plan_id,actual_amount,actual_date,request_idempotency_key); $$;
create function public.cancel_planned_expense(target_plan_id uuid) returns void language sql security invoker set search_path='' as $$ select private.cancel_planned_expense(target_plan_id); $$;
create or replace function public.reverse_expense(target_expense_id uuid) returns public.expenses language sql security invoker set search_path='' as $$ select private.reverse_expense_with_plan(target_expense_id); $$;

-- Aggregate in PostgreSQL: no Data API row cap and exact decimal arithmetic.
create function public.trip_finance_summary(target_trip_id uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare t public.trips; planned numeric; pending numeric; actual numeric;
begin
 select * into t from public.trips where id=target_trip_id;
 if auth.uid() is null or t.id is null then raise exception 'trip_access_denied' using errcode='42501'; end if;
 if exists(select 1 from public.planned_expenses where trip_id=t.id and currency<>t.base_currency and cancelled_at is null) or exists(select 1 from public.expenses where trip_id=t.id and currency<>t.base_currency and deleted_at is null) then raise exception 'currency_mismatch'; end if;
 select coalesce(sum(p.planned_amount),0),coalesce(sum(p.planned_amount) filter(where e.id is null or e.deleted_at is not null),0) into planned,pending
 from public.planned_expenses p left join public.expenses e on e.id=p.confirmed_expense_id where p.trip_id=t.id and p.cancelled_at is null;
 select coalesce(sum(amount),0) into actual from public.expenses where trip_id=t.id and deleted_at is null;
 return jsonb_build_object('planned',planned::text,'pending',pending::text,'actual',actual::text,'projected',(actual+pending)::text,'margin',(t.budget-actual-pending)::text,'actual_balance',(t.budget-actual)::text);
end $$;

revoke all on function private.add_planned_expense(uuid,uuid,text,text,date,numeric,uuid),public.add_planned_expense(uuid,uuid,text,text,date,numeric,uuid),private.confirm_planned_expense(uuid,numeric,date,uuid),public.confirm_planned_expense(uuid,numeric,date,uuid),private.cancel_planned_expense(uuid),public.cancel_planned_expense(uuid),private.reverse_expense_with_plan(uuid),public.reverse_expense(uuid),public.trip_finance_summary(uuid) from public,anon,authenticated;
grant execute on function private.add_planned_expense(uuid,uuid,text,text,date,numeric,uuid),public.add_planned_expense(uuid,uuid,text,text,date,numeric,uuid),private.confirm_planned_expense(uuid,numeric,date,uuid),public.confirm_planned_expense(uuid,numeric,date,uuid),private.cancel_planned_expense(uuid),public.cancel_planned_expense(uuid),private.reverse_expense_with_plan(uuid),public.reverse_expense(uuid),public.trip_finance_summary(uuid) to authenticated;
alter table public.planned_expenses replica identity full;
do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') then alter publication supabase_realtime add table public.planned_expenses; end if;
end $$;

-- Currency cannot be relabelled after monetary records exist; no implicit FX.
create function private.guard_finance_currency() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.base_currency is distinct from old.base_currency and (exists(select 1 from public.expenses where trip_id=old.id) or exists(select 1 from public.planned_expenses where trip_id=old.id)) then
  raise exception 'currency_has_financial_records' using errcode='23514';
 end if;
 return new;
end $$;
revoke all on function private.guard_finance_currency() from public,anon,authenticated;
create trigger guard_finance_currency before update of base_currency on public.trips for each row execute function private.guard_finance_currency();

-- One stable snapshot preserves cross-links during concurrent confirmations/exports.
create function public.trip_finance_export(target_trip_id uuid) returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.trips where id=target_trip_id) then raise exception 'trip_access_denied' using errcode='42501'; end if;
 return jsonb_build_object(
  'expenses',coalesce((select jsonb_agg(x order by x.expense_date,x.id) from (select id,category_id,description,merchant,expense_date,amount,currency,created_at from public.expenses where trip_id=target_trip_id and deleted_at is null) x),'[]'::jsonb),
  'expense_history',coalesce((select jsonb_agg(x order by x.expense_date,x.id) from (select id,category_id,description,merchant,expense_date,amount,currency,created_at,deleted_at from public.expenses where trip_id=target_trip_id) x),'[]'::jsonb),
  'planned_expenses',coalesce((select jsonb_agg(x order by x.planned_date,x.id) from (select id,category_id,description,merchant,planned_date,planned_amount,currency,confirmed_expense_id,source_place_id,created_at,cancelled_at from public.planned_expenses where trip_id=target_trip_id) x),'[]'::jsonb),
  'confirmations',coalesce((select jsonb_agg(x order by x.created_at,x.expense_id) from (select planned_expense_id,expense_id,amount,expense_date,created_at from public.planned_expense_confirmations where trip_id=target_trip_id) x),'[]'::jsonb));
end $$;
revoke all on function public.trip_finance_export(uuid) from public,anon,authenticated;
grant execute on function public.trip_finance_export(uuid) to authenticated;
