begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

select ok(
  not exists (
    select 1
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = any (array[
        'profiles','workspaces','workspace_members','audit_logs','trips','trip_participants',
        'itinerary_days','itinerary_activities','expense_categories','expenses','checklists',
        'checklist_items','trip_documents','trip_document_files','trip_photos','workspace_invites','trip_places'
      ])
      and (not c.relrowsecurity or not c.relforcerowsecurity)
  ),
  'every exposed application table enables and forces RLS'
);

select ok(
  not exists (
    select 1 from information_schema.role_table_grants
    where grantee = 'anon' and table_schema = 'public'
      and privilege_type in ('SELECT','INSERT','UPDATE','DELETE')
  ),
  'anonymous users have no direct table access'
);

select ok(
  not exists (
    select 1 from information_schema.role_table_grants
    where grantee = 'authenticated' and table_schema = 'public'
      and table_name in ('trips','trip_participants','itinerary_days','itinerary_activities','expense_categories','expenses','checklists','checklist_items','trip_documents','trip_document_files','trip_photos','workspace_members','workspace_invites','trip_places')
      and privilege_type in ('INSERT','UPDATE','DELETE')
  ),
  'authenticated users cannot bypass audited mutation RPCs'
);

select ok(
  not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and not ('search_path=""' = any (coalesce(p.proconfig, array[]::text[])))
  ),
  'every public security-definer function pins an empty search path'
);

select ok(
  not has_function_privilege('anon', 'public.create_workspace_invite(text,public.workspace_role)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.deactivate_workspace_member(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.restore_trip(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.update_trip_document(uuid,text,text,text,date,date,text)', 'EXECUTE'),
  'anonymous users cannot execute privileged business functions'
);

select ok(
  has_function_privilege('anon', 'public.validate_workspace_invite(text,text)', 'EXECUTE'),
  'anonymous invite validation is the explicit narrow exception'
);

select * from finish();
rollback;
