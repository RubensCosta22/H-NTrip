-- H&NTrip: selective Realtime for the active trip's finance and checklist modules.

alter table public.expenses replica identity full;
alter table public.expense_categories replica identity full;
alter table public.checklists replica identity full;
alter table public.checklist_items replica identity full;

do $$
declare
  realtime_table text;
begin
  foreach realtime_table in array array[
    'expenses',
    'expense_categories',
    'checklists',
    'checklist_items'
  ]
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = realtime_table
    ) then
      execute format(
        'alter publication supabase_realtime add table public.%I',
        realtime_table
      );
    end if;
  end loop;
end;
$$;

comment on table public.expenses is
  'Realtime enabled; clients must subscribe with an active trip_id filter.';
comment on table public.checklist_items is
  'Realtime enabled; clients must subscribe with an active trip_id filter.';
