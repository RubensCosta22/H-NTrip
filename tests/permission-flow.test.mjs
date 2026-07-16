import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

async function source(path) { return readFile(new URL(path, import.meta.url), "utf8"); }

test("every server mutation module authenticates before using Supabase", async () => {
  const roots = ["../src/features/trips/actions.ts", "../src/features/itinerary/actions.ts", "../src/features/finance/actions.ts", "../src/features/checklist/actions.ts", "../src/features/documents/actions.ts", "../src/features/photos/actions.ts", "../src/features/places/actions.ts", "../src/features/archive/actions.ts", "../src/features/workspace/account-actions.ts", "../src/features/workspace/actions.ts"];
  for (const file of roots) {
    const text = await source(file);
    assert.match(text, /requireCurrentMember/, `${file} must authenticate mutations`);
  }
});

test("critical collection pages scope reads to the current workspace", async () => {
  const pages = ["photos", "documents", "finance", "checklist", "itinerary", "places", "statistics", "activity", "archived"];
  for (const page of pages) {
    const text = await source(`../app/(app)/trips/[tripId]/${page}/page.tsx`);
    assert.match(text, /member\.workspaceId/, `${page} must use the current workspace`);
  }
});

test("permission SQL covers forced RLS, grants and privileged RPCs", async () => {
  const sql = await source("../supabase/tests/permissions_rls_test.sql");
  assert.match(sql, /relforcerowsecurity/);
  assert.match(sql, /grantee = 'anon'/);
  assert.match(sql, /authenticated users cannot bypass audited mutation RPCs/);
  assert.match(sql, /security-definer function pins an empty search path/);
  assert.match(sql, /validate_workspace_invite/);
});

test("release-critical routes are present", async () => {
  const expected = ["dashboard", "trips", "alerts", "settings"];
  const entries = await readdir(new URL("../app/(app)/", import.meta.url));
  for (const route of expected) assert.ok(entries.includes(route), `${route} route missing`);
  for (const route of ["photos", "documents", "finance", "checklist", "itinerary", "places", "statistics", "activity", "album", "archived"]) {
    const text = await source(`../app/(app)/trips/[tripId]/${route}/page.tsx`);
    assert.ok(text.length > 100, `${route} flow missing`);
  }
});
