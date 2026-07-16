import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260715140000_access_and_isolation.sql",
  import.meta.url,
);

const protectedTables = [
  "profiles",
  "workspaces",
  "workspace_members",
  "audit_logs",
];

test("the access migration forces RLS on every exposed table", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  for (const table of protectedTables) {
    assert.match(
      sql,
      new RegExp(`alter table public\\.${table} force row level security;`, "i"),
      `${table} must force RLS`,
    );
  }

  assert.doesNotMatch(sql, /using\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(sql, /with check\s*\(\s*true\s*\)/i);
});

test("anonymous access is explicitly revoked", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(
    sql,
    /revoke all on public\.profiles, public\.workspaces, public\.workspace_members, public\.audit_logs from anon;/i,
  );
});

test("security definer functions pin an empty search path", async () => {
  const sql = await readFile(migrationUrl, "utf8");
  const definerFunctions = sql.match(
    /create or replace function[\s\S]*?security definer[\s\S]*?\$\$;/gi,
  );

  assert.ok(definerFunctions?.length, "expected security definer functions");
  for (const definition of definerFunctions) {
    assert.match(definition, /set search_path = ''/i);
  }
});

test("trips are protected by forced RLS and atomic creation", async () => {
  const tripMigration = await readFile(
    new URL(
      "../supabase/migrations/20260715170000_trips_vertical_slice.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(tripMigration, /alter table public\.trips force row level security;/i);
  assert.match(tripMigration, /create or replace function public\.create_trip/i);
  assert.match(tripMigration, /security definer\s+set search_path = ''/i);
  assert.match(tripMigration, /'trip\.created'/i);
  assert.doesNotMatch(tripMigration, /grant insert on public\.trips to authenticated/i);
});

test("trip management keeps participants informational and mutations audited", async () => {
  const managementMigration = await readFile(
    new URL(
      "../supabase/migrations/20260715190000_trip_management.sql",
      import.meta.url,
    ),
    "utf8",
  );

  assert.match(managementMigration, /alter table public\.trip_participants force row level security;/i);
  assert.match(managementMigration, /Participants are informational|Informational travelers only/i);
  assert.match(managementMigration, /'trip\.updated'/i);
  assert.match(managementMigration, /'trip\.archived'/i);
  assert.match(managementMigration, /'trip\.participant_added'/i);
  assert.match(managementMigration, /'trip\.participant_removed'/i);
  assert.doesNotMatch(managementMigration, /grant (?:insert|update|delete) on public\.trip_participants to authenticated/i);
});

test("itinerary preserves local time, stable order and audited mutations", async () => {
  const itineraryMigration = await readFile(
    new URL("../supabase/migrations/20260715210000_itinerary.sql", import.meta.url),
    "utf8",
  );

  assert.match(itineraryMigration, /alter table public\.itinerary_days force row level security;/i);
  assert.match(itineraryMigration, /alter table public\.itinerary_activities force row level security;/i);
  assert.match(itineraryMigration, /position numeric\(20, 10\) not null/i);
  assert.match(itineraryMigration, /ends_next_day boolean not null/i);
  assert.match(itineraryMigration, /timezone text not null/i);
  assert.match(itineraryMigration, /'itinerary\.activity_moved'/i);
  assert.doesNotMatch(itineraryMigration, /grant (?:insert|update|delete) on public\.itinerary_/i);
});

test("itinerary map coordinates are optional, paired and range constrained", async () => {
  const locationMigration = await readFile(
    new URL("../supabase/migrations/20260716090000_itinerary_locations.sql", import.meta.url),
    "utf8",
  );

  assert.match(locationMigration, /location_latitude numeric\(9, 6\)/i);
  assert.match(locationMigration, /location_longitude numeric\(9, 6\)/i);
  assert.match(locationMigration, /coordinates_paired/i);
  assert.match(locationMigration, /between -90 and 90/i);
  assert.match(locationMigration, /between -180 and 180/i);
  assert.match(locationMigration, /never inferred from device location/i);
  assert.match(locationMigration, /security definer set search_path = ''/i);
});

test("finance uses numeric values, idempotency and soft reversal", async () => {
  const financeMigration = await readFile(
    new URL("../supabase/migrations/20260715230000_finance.sql", import.meta.url),
    "utf8",
  );

  assert.match(financeMigration, /amount numeric\(14, 2\) not null/i);
  assert.match(financeMigration, /unique index expenses_workspace_idempotency_key/i);
  assert.match(financeMigration, /idempotency_key = request_idempotency_key/i);
  assert.match(financeMigration, /deleted_at timestamptz/i);
  assert.match(financeMigration, /'finance\.expense_added'/i);
  assert.match(financeMigration, /'finance\.expense_reversed'/i);
  assert.match(financeMigration, /force row level security/i);
  assert.doesNotMatch(financeMigration, /grant (?:insert|update|delete) on public\.(?:expenses|expense_categories)/i);
});

test("checklists track completion actor and stable ordering", async () => {
  const checklistMigration = await readFile(
    new URL("../supabase/migrations/20260716010000_checklists.sql", import.meta.url),
    "utf8",
  );
  assert.match(checklistMigration, /position numeric\(20, 10\) not null/i);
  assert.match(checklistMigration, /completed_at timestamptz/i);
  assert.match(checklistMigration, /completed_by uuid references public\.profiles/i);
  assert.match(checklistMigration, /'checklist\.item_completed'/i);
  assert.match(checklistMigration, /'checklist\.item_reopened'/i);
  assert.match(checklistMigration, /Informational responsibility label only/i);
  assert.match(checklistMigration, /force row level security/i);
});

test("realtime is restricted to active-trip finance and checklist tables", async () => {
  const realtimeMigration = await readFile(
    new URL("../supabase/migrations/20260716030000_selective_realtime.sql", import.meta.url),
    "utf8",
  );

  for (const table of ["expenses", "expense_categories", "checklists", "checklist_items"]) {
    assert.match(realtimeMigration, new RegExp(`alter table public\\.${table} replica identity full`, "i"));
  }
  assert.match(realtimeMigration, /pubname = 'supabase_realtime'/i);
  assert.match(realtimeMigration, /clients must subscribe with an active trip_id filter/i);
  assert.doesNotMatch(realtimeMigration, /itinerary_(?:days|activities)/i);
});

test("document metadata is isolated, audited and excludes public file storage", async () => {
  const documentMigration = await readFile(
    new URL("../supabase/migrations/20260716050000_trip_documents.sql", import.meta.url),
    "utf8",
  );

  assert.match(documentMigration, /alter table public\.trip_documents force row level security/i);
  assert.match(documentMigration, /private\.has_workspace_role\(workspace_id\)/i);
  assert.match(documentMigration, /'document\.created'/i);
  assert.match(documentMigration, /'document\.archived'/i);
  assert.match(documentMigration, /separate private Storage bucket/i);
  assert.match(documentMigration, /Informational holder label only/i);
  assert.doesNotMatch(documentMigration, /grant (?:insert|update|delete) on public\.trip_documents/i);
  assert.doesNotMatch(documentMigration, /storage\.buckets/i);
});

test("document files use a private constrained bucket and signed access", async () => {
  const fileMigration = await readFile(
    new URL("../supabase/migrations/20260716070000_private_document_files.sql", import.meta.url),
    "utf8",
  );

  assert.match(fileMigration, /'trip-documents'[\s\S]*?false[\s\S]*?10485760/i);
  assert.match(fileMigration, /trip_document_objects_select/i);
  assert.match(fileMigration, /trip_document_objects_insert/i);
  assert.match(fileMigration, /storage\.foldername\(name\)/i);
  assert.match(fileMigration, /private\.has_workspace_role\(document\.workspace_id\)/i);
  assert.match(fileMigration, /'document\.file_attached'/i);
  assert.match(fileMigration, /security definer set search_path = ''/i);
  assert.doesNotMatch(fileMigration, /public\s*=\s*true/i);
});

test("trip photos use a private constrained bucket and audited archive", async () => {
  const photoMigration = await readFile(
    new URL("../supabase/migrations/20260716110000_private_trip_photos.sql", import.meta.url),
    "utf8",
  );

  assert.match(photoMigration, /'trip-photos'[\s\S]*?false[\s\S]*?15728640/i);
  assert.match(photoMigration, /trip_photo_objects_select/i);
  assert.match(photoMigration, /trip_photo_objects_insert/i);
  assert.match(photoMigration, /private\.has_workspace_role\(trip\.workspace_id\)/i);
  assert.match(photoMigration, /'photo\.attached'/i);
  assert.match(photoMigration, /'photo\.archived'/i);
  assert.match(photoMigration, /short-lived signed URLs/i);
  assert.doesNotMatch(photoMigration, /public\s*=\s*true/i);
});

test("photo Storage policies use an explicit active-membership helper", async () => {
  const policyFix = await readFile(
    new URL("../supabase/migrations/20260716210000_photo_storage_policy_fix.sql", import.meta.url),
    "utf8",
  );
  assert.match(policyFix, /security definer\s+set search_path = ''/i);
  assert.match(policyFix, /member\.user_id = \(select auth\.uid\(\)\)/i);
  assert.match(policyFix, /member\.status = 'active'/i);
  assert.match(policyFix, /trip\.workspace_id::text = \(storage\.foldername\(object_name\)\)\[1\]/i);
  assert.match(policyFix, /trip\.id::text = \(storage\.foldername\(object_name\)\)\[2\]/i);
  assert.match(policyFix, /trip_photo_objects_insert[\s\S]*?can_access_trip_photo_object\(name\)/i);
});

test("photo favorites and cover selection are unique and audited", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260716230000_photo_favorites_and_cover.sql", import.meta.url), "utf8");
  assert.match(migration, /is_favorite boolean not null default false/i);
  assert.match(migration, /unique index trip_photos_one_active_cover_idx/i);
  assert.match(migration, /'photo\.favorited'/i);
  assert.match(migration, /'photo\.cover_selected'/i);
  assert.match(migration, /security definer set search_path = ''/i);
});

test("photo locations require paired constrained user-entered coordinates", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260717010000_photo_locations.sql", import.meta.url), "utf8");
  assert.match(migration, /trip_photos_coordinates_paired/i);
  assert.match(migration, /location_latitude between -90 and 90/i);
  assert.match(migration, /location_longitude between -180 and 180/i);
  assert.match(migration, /private\.has_workspace_role\(photo_record\.workspace_id\)/i);
  assert.match(migration, /'photo\.location_updated'/i);
  assert.match(migration, /never inferred from device geolocation/i);
  assert.match(migration, /security definer set search_path = ''/i);
});

test("photo and document metadata edits require membership and are audited", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260717030000_edit_photo_document_metadata.sql", import.meta.url), "utf8");
  assert.match(migration, /update_trip_photo_metadata/i);
  assert.match(migration, /update_trip_document/i);
  assert.match(migration, /private\.has_workspace_role\(photo_record\.workspace_id\)/i);
  assert.match(migration, /private\.has_workspace_role\(document_record\.workspace_id\)/i);
  assert.match(migration, /'photo\.metadata_updated'/i);
  assert.match(migration, /'document\.updated'/i);
  assert.match(migration, /security definer set search_path = ''/i);
});

test("archived trips, documents, photos and places restore through audited RPCs", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260717050000_archived_items_restore.sql", import.meta.url), "utf8");
  for (const resource of ["trip", "trip_document", "trip_photo", "trip_place"]) assert.match(migration, new RegExp(`restore_${resource}`));
  for (const action of ["trip.restored", "document.restored", "photo.restored", "place.restored"]) assert.match(migration, new RegExp(`'${action.replace(".", "\\.")}'`));
  assert.match(migration, /status = 'draft', archived_at = null/i);
  assert.match(migration, /private\.has_workspace_role/i);
  assert.match(migration, /security definer set search_path = ''/i);
});

test("readiness RPC exposes no project or user metadata", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260717070000_system_health.sql", import.meta.url), "utf8");
  assert.match(migration, /function public\.system_health\(\)/i);
  assert.match(migration, /returns boolean/i);
  assert.match(migration, /security definer[\s\S]*?set search_path = ''/i);
  assert.match(migration, /grant execute on function public\.system_health\(\) to anon, authenticated/i);
  assert.doesNotMatch(migration, /workspace_id|user_id|auth\.uid/i);
});

test("workspace invitations store only hashes and gate membership mutations", async () => {
  const inviteMigration = await readFile(
    new URL("../supabase/migrations/20260716130000_workspace_invites.sql", import.meta.url),
    "utf8",
  );

  assert.match(inviteMigration, /token_hash bytea not null unique/i);
  assert.match(inviteMigration, /extensions\.digest\(generated_token, 'sha256'\)/i);
  assert.match(inviteMigration, /now\(\) \+ interval '7 days'/i);
  assert.match(inviteMigration, /revoke insert, update, delete on public\.workspace_members/i);
  assert.match(inviteMigration, /'workspace\.invite_accepted'/i);
  assert.match(inviteMigration, /'workspace\.member_deactivated'/i);
  assert.match(inviteMigration, /role = 'owner' and status = 'active'/i);
  assert.match(inviteMigration, /raw one-time token is returned once and never stored/i);
});

test("account settings revoke direct writes and audit owner-only workspace changes", async () => {
  const settingsMigration = await readFile(
    new URL("../supabase/migrations/20260716150000_account_settings.sql", import.meta.url),
    "utf8",
  );

  assert.match(settingsMigration, /revoke update on public\.profiles from authenticated/i);
  assert.match(settingsMigration, /revoke update on public\.workspaces from authenticated/i);
  assert.match(settingsMigration, /member_record\.role <> 'owner'/i);
  assert.match(settingsMigration, /'profile\.updated'/i);
  assert.match(settingsMigration, /'workspace\.updated'/i);
  assert.match(settingsMigration, /security definer set search_path = ''/i);
});

test("trip places are workspace isolated, constrained and audited", async () => {
  const placesMigration = await readFile(
    new URL("../supabase/migrations/20260716190000_trip_places.sql", import.meta.url),
    "utf8",
  );
  assert.match(placesMigration, /alter table public\.trip_places force row level security/i);
  assert.match(placesMigration, /private\.has_workspace_role\(workspace_id\)/i);
  assert.match(placesMigration, /planned_cost numeric\(14, 2\)/i);
  assert.match(placesMigration, /rating between 1 and 5/i);
  assert.match(placesMigration, /'place\.created'/i);
  assert.match(placesMigration, /'place\.archived'/i);
  assert.match(placesMigration, /security definer set search_path = ''/i);
  assert.doesNotMatch(placesMigration, /grant (?:insert|update|delete) on public\.trip_places/i);
});

test("trip exports require membership and create a minimal audit event", async () => {
  const exportMigration = await readFile(
    new URL("../supabase/migrations/20260716170000_trip_data_export.sql", import.meta.url),
    "utf8",
  );

  assert.match(exportMigration, /private\.has_workspace_role\(trip_record\.workspace_id\)/i);
  assert.match(exportMigration, /'trip\.exported'/i);
  assert.match(exportMigration, /'schema_version'/i);
  assert.match(exportMigration, /File bytes, storage paths and signed URLs are never exported/i);
  assert.match(exportMigration, /security definer set search_path = ''/i);
});
