-- Performance indexes identified during the H-NTrip audit.
-- Keep this migration in source control so production schema changes are reproducible.
create index if not exists checklist_items_trip_workspace_idx on public.checklist_items (trip_id, workspace_id);
create index if not exists itinerary_activities_trip_workspace_idx on public.itinerary_activities (trip_id, workspace_id);
create index if not exists expense_categories_trip_workspace_active_idx on public.expense_categories (trip_id, workspace_id, name) where archived_at is null;
create index if not exists trip_places_trip_workspace_active_idx on public.trip_places (trip_id, workspace_id, starts_on, id) where archived_at is null;
create index if not exists trip_photos_trip_workspace_active_idx on public.trip_photos (trip_id, workspace_id, taken_on desc, id desc) where archived_at is null;
create index if not exists trip_documents_trip_workspace_active_idx on public.trip_documents (trip_id, workspace_id, created_at, id) where archived_at is null;
create index if not exists trip_participants_trip_workspace_idx on public.trip_participants (trip_id, workspace_id);
create index if not exists trip_document_files_document_idx on public.trip_document_files (document_id);
create index if not exists audit_logs_workspace_occurred_idx on public.audit_logs (workspace_id, occurred_at desc);
