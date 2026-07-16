import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;

test("renders development preview metadata", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/login", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );

  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-type") ?? "",
    /^text\/html\b/i,
  );
  assert.match(await response.text(), developmentPreviewMeta);
});

test("exposes a minimal health check without sensitive data", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("health-test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/api/health", {
      headers: { accept: "application/json" },
    }),
    {
      ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
    },
    { waitUntil() {}, passThroughOnException() {} },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("readiness check is bounded and returns only safe states", async () => {
  const source = await readFile(new URL("../app/api/health/readiness/route.ts", import.meta.url), "utf8");
  assert.match(source, /rpc\/system_health/);
  assert.match(source, /AbortSignal\.timeout\(4000\)/);
  assert.match(source, /status: "ready"/);
  assert.match(source, /status: "degraded"/);
  assert.match(source, /status: 503/);
  assert.match(source, /Cache-Control.*no-store/);
  assert.doesNotMatch(source, /error\.message|console\./);
});

test("dashboard consolidates the active trip planning indicators", async () => {
  const source = await readFile(new URL("../app/(app)/dashboard/page.tsx", import.meta.url), "utf8");

  assert.match(source, /currentTrip/);
  assert.match(source, /Total gasto/);
  assert.match(source, /Saldo/);
  assert.match(source, /Pendências/);
  assert.match(source, /itinerary_activities/);
  assert.match(source, /checklist_items/);
  assert.match(source, /\.is\("deleted_at", null\)/);
});

test("realtime refreshes only records from the open trip", async () => {
  const source = await readFile(new URL("../src/components/trip-realtime-refresh.tsx", import.meta.url), "utf8");

  assert.match(source, /filter: `trip_id=eq\.\$\{tripId\}`/);
  assert.match(source, /allowedTables/);
  assert.match(source, /removeChannel/);
  assert.match(source, /router\.refresh\(\)/);
  assert.match(source, /document\.visibilityState === "visible"/);
  assert.match(source, /setInterval\([\s\S]*?4000\)/);
  assert.match(source, /clearInterval\(fallbackTimer\)/);
});

test("document downloads use short-lived signed URLs", async () => {
  const source = await readFile(new URL("../app/api/documents/[fileId]/download/route.ts", import.meta.url), "utf8");

  assert.match(source, /createSignedUrl\(file\.storage_path, 60/);
  assert.match(source, /\.is\("archived_at", null\)/);
  assert.match(source, /workspace_id/);
});

test("PWA cache excludes private pages, APIs and documents", async () => {
  const worker = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const manifest = await readFile(new URL("../app/manifest.ts", import.meta.url), "utf8");

  assert.match(worker, /request\.mode === "navigate"/);
  assert.match(worker, /fetch\(request\)\.catch\(\(\) => caches\.match\(OFFLINE_URL\)\)/);
  assert.match(worker, /\/_next\/static\//);
  assert.doesNotMatch(worker, /cache\.put\([^\n]*(?:dashboard|trips|api|documents)/i);
  assert.doesNotMatch(worker, /staleWhileRevalidate|networkFirst/i);
  assert.match(manifest, /display: "standalone"/);
  assert.match(manifest, /purpose: "maskable"/);
});

test("trip map embeds only validated coordinates without device geolocation", async () => {
  const source = await readFile(new URL("../src/features/itinerary/trip-map.tsx", import.meta.url), "utf8");

  assert.match(source, /openstreetmap\.org\/export\/embed\.html/);
  assert.match(source, /encodeURIComponent\(bbox\)/);
  assert.match(source, /referrerPolicy="no-referrer"/);
  assert.doesNotMatch(source, /navigator\.geolocation|getCurrentPosition/);
});

test("private photo previews require authenticated short-lived URLs", async () => {
  const source = await readFile(new URL("../app/api/photos/[photoId]/route.ts", import.meta.url), "utf8");

  assert.match(source, /requireCurrentMember\(\)/);
  assert.match(source, /\.is\("archived_at", null\)/);
  assert.match(source, /createSignedUrl\(photo\.storage_path, 60/);
  assert.match(source, /workspace_id/);
});

test("photo gallery exposes favorite and explicit cover controls", async () => {
  const page = await readFile(new URL("../app/(app)/trips/[tripId]/photos/page.tsx", import.meta.url), "utf8");
  const album = await readFile(new URL("../app/(app)/trips/[tripId]/album/page.tsx", import.meta.url), "utf8");
  const viewer = await readFile(new URL("../src/features/photos/photo-gallery-viewer.tsx", import.meta.url), "utf8");
  assert.match(viewer, /setPhotoFavoriteAction/);
  assert.match(viewer, /setTripCoverPhotoAction/);
  assert.match(page, /is_favorite, is_cover/);
  assert.match(album, /photo\.is_cover/);
  assert.match(album, /order\("is_favorite", \{ ascending: false \}\)/);
  assert.match(viewer, /className="photo-media"/);
});

test("photo gallery supports bounded batch upload and an accessible lightbox", async () => {
  const upload = await readFile(new URL("../src/features/photos/photo-upload-form.tsx", import.meta.url), "utf8");
  const viewer = await readFile(new URL("../src/features/photos/photo-gallery-viewer.tsx", import.meta.url), "utf8");
  assert.match(upload, /files\.length > 10/);
  assert.match(upload, /multiple/);
  assert.match(upload, /Enviando \$\{index \+ 1\} de \$\{files\.length\}/);
  assert.match(viewer, /role="dialog"/);
  assert.match(viewer, /aria-modal="true"/);
  assert.match(viewer, /event\.key === "Escape"/);
  assert.match(viewer, /event\.key === "ArrowLeft"/);
  assert.match(viewer, /event\.key === "ArrowRight"/);
});

test("photo upload accepts only explicit optional locations and displays their names", async () => {
  const upload = await readFile(new URL("../src/features/photos/photo-upload-form.tsx", import.meta.url), "utf8");
  const viewer = await readFile(new URL("../src/features/photos/photo-gallery-viewer.tsx", import.meta.url), "utf8");
  const album = await readFile(new URL("../app/(app)/trips/[tripId]/album/page.tsx", import.meta.url), "utf8");
  assert.match(upload, /set_trip_photo_location/);
  assert.match(upload, /name="latitude"/);
  assert.match(upload, /name="longitude"/);
  assert.doesNotMatch(upload, /navigator\.geolocation/);
  assert.match(viewer, /photo\.location_name/);
  assert.match(album, /photo\.location_name/);
});

test("active photo and document cards expose metadata editing", async () => {
  const photoViewer = await readFile(new URL("../src/features/photos/photo-gallery-viewer.tsx", import.meta.url), "utf8");
  const photoActions = await readFile(new URL("../src/features/photos/actions.ts", import.meta.url), "utf8");
  const documents = await readFile(new URL("../app/(app)/trips/[tripId]/documents/page.tsx", import.meta.url), "utf8");
  const documentActions = await readFile(new URL("../src/features/documents/actions.ts", import.meta.url), "utf8");
  assert.match(photoViewer, /updateTripPhotoAction/);
  assert.match(photoActions, /update_trip_photo_metadata/);
  assert.match(documents, /updateTripDocumentAction/);
  assert.match(documentActions, /update_trip_document/);
  assert.match(photoViewer, /Editar informações/);
  assert.match(documents, /Editar informações/);
});

test("archive recovery is available for trips and trip resources", async () => {
  const trips = await readFile(new URL("../app/(app)/trips/archived/page.tsx", import.meta.url), "utf8");
  const items = await readFile(new URL("../app/(app)/trips/[tripId]/archived/page.tsx", import.meta.url), "utf8");
  const nav = await readFile(new URL("../src/components/trip-section-nav.tsx", import.meta.url), "utf8");
  assert.match(trips, /restoreTripAction/);
  assert.match(items, /restoreTripItemAction/);
  assert.match(items, /trip_documents/);
  assert.match(items, /trip_photos/);
  assert.match(items, /trip_places/);
  assert.match(nav, /Arquivados/);
});

test("photo and document collections support persistent filters and pagination", async () => {
  const photos = await readFile(new URL("../app/(app)/trips/[tripId]/photos/page.tsx", import.meta.url), "utf8");
  const documents = await readFile(new URL("../app/(app)/trips/[tripId]/documents/page.tsx", import.meta.url), "utf8");
  const pagination = await readFile(new URL("../src/components/list-pagination.tsx", import.meta.url), "utf8");
  assert.match(photos, /caption\.ilike/);
  assert.match(photos, /is_favorite/);
  assert.match(documents, /title\.ilike/);
  assert.match(documents, /documentQuery\.eq\("category"/);
  assert.match(photos, /pageSize = 12/);
  assert.match(documents, /pageSize = 12/);
  assert.match(pagination, /URLSearchParams/);
  assert.match(pagination, /Página \{page\} de \{pages\}/);
});

test("finance and activity lists filter and paginate without changing financial totals", async () => {
  const finance = await readFile(new URL("../app/(app)/trips/[tripId]/finance/page.tsx", import.meta.url), "utf8");
  const activity = await readFile(new URL("../app/(app)/trips/[tripId]/activity/page.tsx", import.meta.url), "utf8");
  assert.match(finance, /description\.ilike/);
  assert.match(finance, /expenseQuery\.eq\("category_id"/);
  assert.match(finance, /allAmounts/);
  assert.match(finance, /pageSize = 20/);
  assert.match(activity, /filteredEvents/);
  assert.match(activity, /moduleFilter/);
  assert.match(activity, /pageSize = 25/);
  assert.match(activity, /ListPagination/);
});

test("mobile shell keeps navigation reachable and forms touch friendly", async () => {
  const layout = await readFile(new URL("../app/(app)/layout.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(layout, /className="skip-link"/);
  assert.match(layout, /id="app-content"/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /grid-template-columns: repeat\(4, 1fr\)/);
  assert.match(css, /scroll-snap-type: x proximity/);
  assert.match(css, /input, select, textarea \{ font-size: 16px; \}/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(css, /:focus-visible/);
});

test("browser Supabase features receive runtime public configuration from the server", async () => {
  const client = await readFile(new URL("../src/lib/supabase/client.ts", import.meta.url), "utf8");
  const documents = await readFile(new URL("../app/(app)/trips/[tripId]/documents/page.tsx", import.meta.url), "utf8");
  const photos = await readFile(new URL("../app/(app)/trips/[tripId]/photos/page.tsx", import.meta.url), "utf8");
  assert.match(client, /createBrowserSupabaseClient\(config: SupabasePublicConfig\)/);
  assert.doesNotMatch(client, /process\.env|getSupabasePublicConfig\(\)/);
  assert.match(documents, /supabaseConfig=\{supabaseConfig\}/);
  assert.match(photos, /supabaseConfig=\{supabaseConfig\}/);
});

test("upload forms preserve the form node and surface sanitized Storage failures", async () => {
  const documents = await readFile(new URL("../src/features/documents/document-file-form.tsx", import.meta.url), "utf8");
  const photos = await readFile(new URL("../src/features/photos/photo-upload-form.tsx", import.meta.url), "utf8");
  const errors = await readFile(new URL("../src/lib/supabase/storage-error.ts", import.meta.url), "utf8");
  assert.match(documents, /const formElement = event\.currentTarget/);
  assert.match(documents, /formElement\.reset\(\)/);
  assert.doesNotMatch(documents, /event\.currentTarget\.reset\(\)/);
  assert.match(documents, /describeStorageUploadError\(uploadError\.message, "arquivo"\)/);
  assert.match(photos, /describeStorageUploadError\(uploadError\.message, "foto"\)/);
  assert.match(errors, /message\.slice\(0, 160\)/);
});

test("trip statistics derive indicators from isolated source tables", async () => {
  const source = await readFile(new URL("../app/(app)/trips/[tripId]/statistics/page.tsx", import.meta.url), "utf8");

  for (const table of ["itinerary_activities", "expenses", "checklist_items", "trip_documents", "trip_photos"]) {
    assert.match(source, new RegExp(`from\\(\"${table}\"\\)`));
  }
  assert.match(source, /\.eq\("workspace_id", member\.workspaceId\)/);
  assert.match(source, /budgetPercent/);
  assert.match(source, /checklistPercent/);
  assert.match(source, /expiredDocuments/);
});

test("trip history filters workspace audit events without rendering raw metadata", async () => {
  const source = await readFile(new URL("../app/(app)/trips/[tripId]/activity/page.tsx", import.meta.url), "utf8");

  assert.match(source, /from\("audit_logs"\)/);
  assert.match(source, /\.eq\("workspace_id", member\.workspaceId\)/);
  assert.match(source, /event\.resource_id === trip\.id \|\| metadata\.trip_id === trip\.id/);
  assert.match(source, /actionLabels/);
  assert.doesNotMatch(source, /JSON\.stringify\(event\.metadata\)|<pre>/);
});

test("invite callback accepts only an exact local completion path", async () => {
  const callback = await readFile(new URL("../app/auth/callback/route.ts", import.meta.url), "utf8");
  const signup = await readFile(new URL("../src/features/access/invite-actions.ts", import.meta.url), "utf8");

  assert.match(callback, /\^\\\/accept-invite\\\/complete\\\?token=\(\[a-f0-9\]\{64\}\)\$/);
  assert.match(signup, /validate_workspace_invite/);
  assert.match(signup, /accept_workspace_invite/);
  assert.doesNotMatch(signup, /SERVICE_ROLE|service_role/);
});

test("workspace settings are role-aware and use an audited RPC", async () => {
  const page = await readFile(new URL("../app/(app)/settings/profile/page.tsx", import.meta.url), "utf8");
  const action = await readFile(new URL("../src/features/workspace/account-actions.ts", import.meta.url), "utf8");

  assert.match(page, /canRenameWorkspace=\{member\.role === "owner"\}/);
  assert.match(action, /update_account_settings/);
  assert.match(action, /requireCurrentMember\(\)/);
});

test("trip export is no-store, versioned and omits storage internals", async () => {
  const source = await readFile(new URL("../app/api/trips/[tripId]/export/route.ts", import.meta.url), "utf8");

  assert.match(source, /exportSchemaVersion = 1/);
  assert.match(source, /record_trip_export/);
  assert.match(source, /private, no-store, max-age=0/);
  assert.match(source, /Content-Disposition/);
  assert.doesNotMatch(source, /select\([^\n]*storage_path/);
  assert.doesNotMatch(source, /audit_logs|signedUrl|token_hash/);
});

test("trip workspace navigation exposes every module and marks the active section", async () => {
  const source = await readFile(new URL("../src/components/trip-section-nav.tsx", import.meta.url), "utf8");
  const layout = await readFile(new URL("../app/(app)/trips/[tripId]/layout.tsx", import.meta.url), "utf8");

  for (const section of ["itinerary", "finance", "checklist", "places", "documents", "photos", "album", "statistics", "activity"]) {
    assert.match(source, new RegExp(`slug: \"${section}\"`));
  }
  assert.match(source, /aria-current=\{active \? "page"/);
  assert.match(source, /aria-label=\{`Seções de \$\{tripName\}`\}/);
  assert.match(layout, /\.eq\("workspace_id", member\.workspaceId\)/);
});

test("automatic album composes only workspace-scoped trip memories", async () => {
  const source = await readFile(new URL("../app/(app)/trips/[tripId]/album/page.tsx", import.meta.url), "utf8");
  for (const table of ["trips", "trip_participants", "itinerary_days", "itinerary_activities", "trip_places", "expenses", "trip_photos"]) {
    assert.match(source, new RegExp(`from\\("${table}"\\)`));
  }
  assert.equal(source.match(/\.eq\("workspace_id", member\.workspaceId\)/g)?.length, 7);
  assert.match(source, /\/api\/photos\/\$\{photo\.id\}/);
  assert.match(source, /trip\.status !== "completed"/);
});

test("places query and mutations stay scoped to the current workspace and trip", async () => {
  const page = await readFile(new URL("../app/(app)/trips/[tripId]/places/page.tsx", import.meta.url), "utf8");
  const actions = await readFile(new URL("../src/features/places/actions.ts", import.meta.url), "utf8");
  assert.match(page, /from\("trip_places"\)/);
  assert.match(page, /\.eq\("trip_id", tripId\)/);
  assert.match(page, /\.eq\("workspace_id", member\.workspaceId\)/);
  assert.match(actions, /requireCurrentMember\(\)/);
  assert.match(actions, /rpc\("add_trip_place"/);
  assert.match(actions, /rpc\("archive_trip_place"/);
});

test("alerts derive only workspace-scoped actionable deadlines", async () => {
  const source = await readFile(new URL("../app/(app)/alerts/page.tsx", import.meta.url), "utf8");

  for (const table of ["trips", "checklist_items", "trip_documents"]) {
    assert.match(source, new RegExp(`from\\(\"${table}\"\\)`));
  }
  assert.equal(source.match(/\.eq\("workspace_id", member\.workspaceId\)/g)?.length, 3);
  assert.match(source, /addDays\(now, 7\)/);
  assert.match(source, /addDays\(now, 60\)/);
  assert.match(source, /alerts\.sort\(\(a, b\) => a\.priority - b\.priority/);
});
