import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260722200000_place_website_scheme_hardening.sql",
  import.meta.url,
);

const schemaUrl = new URL("../src/features/places/schema.ts", import.meta.url);
const pageUrl = new URL("../app/(app)/trips/[tripId]/places/page.tsx", import.meta.url);

test("place websites accept only http and https across input, storage and rendering", async () => {
  const [migration, schema, page] = await Promise.all([
    readFile(migrationUrl, "utf8"),
    readFile(schemaUrl, "utf8"),
    readFile(pageUrl, "utf8"),
  ]);

  assert.match(schema, /url\.protocol === "https:" \|\| url\.protocol === "http:"/);
  assert.match(migration, /trip_places_website_http_scheme/i);
  assert.match(migration, /\^https\?\:\/\//i);
  assert.match(migration, /invalid_place_website_scheme/i);
  assert.match(migration, /security definer set search_path = ''/i);
  assert.match(page, /isSafeWebUrl/);
  assert.match(page, /place\.website && isSafeWebUrl\(place\.website\)/);
});
