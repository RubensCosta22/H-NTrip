-- H&NTrip: harden expense idempotency and category integrity under concurrent requests.

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
  category_record public.expense_categories;
  created_expense public.expenses;
  normalized_description text := trim(expense_description);
  normalized_merchant text := nullif(trim(expense_merchant), '');
begin
  select * into trip_record
  from public.trips
  where id = target_trip_id and archived_at is null;

  if actor_id is null or trip_record.id is null
    or not private.has_workspace_role(trip_record.workspace_id) then
    raise exception 'trip_access_denied' using errcode = '42501';
  end if;

  select * into category_record
  from public.expense_categories
  where id = target_category_id
    and trip_id = target_trip_id
    and workspace_id = trip_record.workspace_id
    and archived_at is null;

  if category_record.id is null then
    raise exception 'expense_category_unavailable' using errcode = '23503';
  end if;

  select * into created_expense
  from public.expenses
  where workspace_id = trip_record.workspace_id
    and idempotency_key = request_idempotency_key;

  if created_expense.id is not null then
    if created_expense.trip_id <> target_trip_id
      or created_expense.category_id <> target_category_id
      or created_expense.description <> normalized_description
      or created_expense.merchant is distinct from normalized_merchant
      or created_expense.expense_date <> target_expense_date
      or created_expense.amount <> expense_amount
      or created_expense.currency <> trip_record.base_currency then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;
    return created_expense;
  end if;

  insert into public.expenses (
    workspace_id, trip_id, category_id, description, merchant, expense_date,
    amount, currency, idempotency_key, created_by, updated_by
  ) values (
    trip_record.workspace_id, target_trip_id, target_category_id,
    normalized_description, normalized_merchant, target_expense_date,
    expense_amount, trip_record.base_currency, request_idempotency_key, actor_id, actor_id
  )
  on conflict (workspace_id, idempotency_key) do nothing
  returning * into created_expense;

  if created_expense.id is null then
    select * into created_expense
    from public.expenses
    where workspace_id = trip_record.workspace_id
      and idempotency_key = request_idempotency_key;

    if created_expense.id is null
      or created_expense.trip_id <> target_trip_id
      or created_expense.category_id <> target_category_id
      or created_expense.description <> normalized_description
      or created_expense.merchant is distinct from normalized_merchant
      or created_expense.expense_date <> target_expense_date
      or created_expense.amount <> expense_amount
      or created_expense.currency <> trip_record.base_currency then
      raise exception 'idempotency_key_conflict' using errcode = '23505';
    end if;

    return created_expense;
  end if;

  insert into public.audit_logs (
    workspace_id, actor_id, action, resource_type, resource_id, metadata
  ) values (
    trip_record.workspace_id, actor_id, 'finance.expense_added', 'expense',
    created_expense.id,
    jsonb_build_object(
      'trip_id', target_trip_id,
      'amount', created_expense.amount,
      'currency', created_expense.currency
    )
  );

  return created_expense;
end;
$$;

revoke all on function public.add_expense(uuid, uuid, text, text, date, numeric, uuid)
  from public, anon;
grant execute on function public.add_expense(uuid, uuid, text, text, date, numeric, uuid)
  to authenticated;
