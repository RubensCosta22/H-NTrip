import { NextResponse } from "next/server";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
const exportSchemaVersion = 1;

function safeFilename(name: string) {
  const normalized = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "viagem";
}

export async function GET(_request: Request, { params }: { params: Promise<{ tripId: string }> }) {
  const { tripId } = await params;
  const member = await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const [
    tripResult,
    participantsResult,
    daysResult,
    activitiesResult,
    categoriesResult,
    expensesResult,
    listsResult,
    itemsResult,
    documentsResult,
    documentFilesResult,
    photosResult,
  ] = await Promise.all([
    supabase.from("trips").select("id, name, destination, description, start_date, end_date, timezone, base_currency, budget, status, created_at, updated_at").eq("id", tripId).eq("workspace_id", member.workspaceId).neq("status", "archived").maybeSingle(),
    supabase.from("trip_participants").select("name, email, notes, created_at").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).order("created_at", { ascending: true }),
    supabase.from("itinerary_days").select("id, day_date, title, notes").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).order("day_date", { ascending: true }).order("id", { ascending: true }),
    supabase.from("itinerary_activities").select("itinerary_day_id, title, description, location_name, location_latitude, location_longitude, start_time, end_time, ends_next_day, timezone, position").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).order("position", { ascending: true }),
    supabase.from("expense_categories").select("id, name, color").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).is("archived_at", null).order("name", { ascending: true }),
    supabase.from("expenses").select("category_id, description, merchant, expense_date, amount, currency, created_at").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).is("deleted_at", null).order("expense_date", { ascending: true }).order("created_at", { ascending: true }),
    supabase.from("checklists").select("id, name, description, created_at").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).is("archived_at", null).order("created_at", { ascending: true }),
    supabase.from("checklist_items").select("checklist_id, title, notes, assignee_name, due_date, position, is_completed, completed_at").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).order("position", { ascending: true }),
    supabase.from("trip_documents").select("id, title, category, holder_name, issued_on, expires_on, notes, created_at").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).is("archived_at", null).order("created_at", { ascending: true }),
    supabase.from("trip_document_files").select("document_id, original_filename, mime_type, size_bytes, created_at").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).order("created_at", { ascending: true }),
    supabase.from("trip_photos").select("original_filename, mime_type, size_bytes, caption, taken_on, created_at").eq("trip_id", tripId).eq("workspace_id", member.workspaceId).is("archived_at", null).order("taken_on", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true }),
  ]);

  if (!tripResult.data) return new NextResponse("Viagem não encontrada.", { status: 404 });
  const queryResults = [participantsResult, daysResult, activitiesResult, categoriesResult, expensesResult, listsResult, itemsResult, documentsResult, documentFilesResult, photosResult];
  if (queryResults.some((result) => result.error)) return new NextResponse("Exportação indisponível.", { status: 503 });

  const activitiesByDay = new Map<string, typeof activitiesResult.data>();
  for (const activity of activitiesResult.data ?? []) {
    const group = activitiesByDay.get(activity.itinerary_day_id) ?? [];
    group.push(activity);
    activitiesByDay.set(activity.itinerary_day_id, group);
  }
  const itemsByList = new Map<string, typeof itemsResult.data>();
  for (const item of itemsResult.data ?? []) {
    const group = itemsByList.get(item.checklist_id) ?? [];
    group.push(item);
    itemsByList.set(item.checklist_id, group);
  }
  const filesByDocument = new Map<string, typeof documentFilesResult.data>();
  for (const file of documentFilesResult.data ?? []) {
    const group = filesByDocument.get(file.document_id) ?? [];
    group.push(file);
    filesByDocument.set(file.document_id, group);
  }

  const payload = {
    schema_version: exportSchemaVersion,
    exported_at: new Date().toISOString(),
    trip: tripResult.data,
    participants: participantsResult.data ?? [],
    itinerary: (daysResult.data ?? []).map((day) => ({ ...day, activities: activitiesByDay.get(day.id) ?? [] })),
    finance: { categories: categoriesResult.data ?? [], expenses: expensesResult.data ?? [] },
    checklists: (listsResult.data ?? []).map((list) => ({ ...list, items: itemsByList.get(list.id) ?? [] })),
    documents: (documentsResult.data ?? []).map((document) => ({ ...document, files: filesByDocument.get(document.id) ?? [] })),
    photos: photosResult.data ?? [],
  };

  const { error: auditError } = await supabase.rpc("record_trip_export", { target_trip_id: tripId, export_schema_version: exportSchemaVersion });
  if (auditError) return new NextResponse("Exportação indisponível.", { status: 503 });

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="hntrip-${safeFilename(tripResult.data.name)}.json"`,
      "Cache-Control": "private, no-store, max-age=0",
      Pragma: "no-cache",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
