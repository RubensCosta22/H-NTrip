import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260722193000_archived_trip_read_only.sql",
  import.meta.url,
);

test("archived trips block child mutations at the database layer", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /create or replace function private\.enforce_active_parent_trip/i);
  assert.match(sql, /security definer\s+set search_path = ''/i);
  assert.match(sql, /archived_trip_is_read_only/i);
  assert.match(sql, /before insert or update or delete/i);

  for (const table of [
    "trip_participants",
    "itinerary_days",
    "itinerary_activities",
    "expense_categories",
    "expenses",
    "checklists",
    "checklist_items",
    "trip_documents",
    "trip_document_files",
    "trip_photos",
    "trip_places",
  ]) {
    assert.match(sql, new RegExp(`'${table}'`));
  }
});
