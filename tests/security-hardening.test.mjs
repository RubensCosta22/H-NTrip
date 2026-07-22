import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("production URLs fail closed and require HTTPS", async () => {
  const [appUrl, accessActions, inviteActions] = await Promise.all([
    read("src/lib/app-url.ts"),
    read("src/features/access/actions.ts"),
    read("src/features/access/invite-actions.ts"),
  ]);

  assert.match(appUrl, /APP_URL is required in production/i);
  assert.match(appUrl, /APP_URL must use HTTPS outside local development/i);
  assert.match(accessActions, /getAppUrl\(\)/);
  assert.match(inviteActions, /getAppUrl\(\)/);
  assert.doesNotMatch(accessActions, /process\.env\.APP_URL\s*\?\?/);
  assert.doesNotMatch(inviteActions, /process\.env\.APP_URL\s*\?\?/);
});

test("missing production Supabase configuration returns 503", async () => {
  const proxy = await read("proxy.ts");
  assert.match(proxy, /process\.env\.NODE_ENV === "production"/);
  assert.match(proxy, /status:\s*503/);
  assert.match(proxy, /Cache-Control":\s*"no-store"/);
});

test("baseline browser hardening headers remain enabled", async () => {
  const nextConfig = await read("next.config.ts");
  for (const header of [
    "Content-Security-Policy",
    "Strict-Transport-Security",
    "Cross-Origin-Opener-Policy",
    "Cross-Origin-Resource-Policy",
    "Referrer-Policy",
    "Permissions-Policy",
    "X-Content-Type-Options",
    "X-Frame-Options",
  ]) {
    assert.match(nextConfig, new RegExp(header));
  }
  assert.match(nextConfig, /worker-src 'self' blob:/);
});

test("CI covers both active repository branches", async () => {
  const workflow = await read(".github/workflows/ci.yml");
  assert.match(workflow, /branches:\s*\[main, Rcosta22\]/);
});
