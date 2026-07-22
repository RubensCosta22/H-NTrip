-- H&NTrip: archived trips are immutable until explicitly restored.
-- This database invariant protects child resources even when a stale client or
-- handcrafted RPC/storage request still holds identifiers from before archive.

create or replace function private.enforce_active_parent_trip()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_trip_id uuid;
  parent_archived_at timestamptz;
begin
  target_trip_id := case when tg_op = 'DELETE' then old.trip_id else new.trip_id end;

  select archived_at into parent_archived_at
  from public.trips
  where id = target_trip_id;

  if parent_archived_at is not null then
    raise exception 'archived_trip_is_read_only' using errcode = '55000';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

revoke all on function private.enforce_active_parent_trip() from public, anon, authenticated;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'trip_participants',
    'itinerary_days',
    'itinerary_activities',
    'expense_categories',
    'expenses',
    'checklists',
    'checklist_items',
    'trip_documents',
    'trip_document_files',
    'trip_photos',
    'trip_places'
  ] loop
    execute format('drop trigger if exists enforce_active_parent_trip on public.%I', table_name);
    execute format(
      'create trigger enforce_active_parent_trip before insert or update or delete on public.%I for each row execute function private.enforce_active_parent_trip()',
      table_name
    );
  end loop;
end;
$$;
