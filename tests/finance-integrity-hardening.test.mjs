import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../supabase/migrations/20260722190000_finance_integrity_hardening.sql",
  import.meta.url,
);

test("expense creation rejects archived categories and is concurrency-safe", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /and archived_at is null/i);
  assert.match(sql, /expense_category_unavailable/i);
  assert.match(sql, /on conflict \(workspace_id, idempotency_key\) do nothing/i);
  assert.match(sql, /idempotency_key_conflict/i);
  assert.match(sql, /created_expense\.category_id <> target_category_id/i);
  assert.match(sql, /created_expense\.amount <> expense_amount/i);
  assert.match(sql, /created_expense\.expense_date <> target_expense_date/i);
  assert.match(sql, /security definer\s+set search_path = ''/i);
});
