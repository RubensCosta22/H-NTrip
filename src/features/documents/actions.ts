"use server";

import { redirect } from "next/navigation";
import type { AccessActionState } from "@/src/features/access/actions";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { archiveTripDocumentSchema, tripDocumentSchema, updateTripDocumentSchema } from "./schema";

export async function updateTripDocumentAction(formData: FormData) {
  const parsed = updateTripDocumentSchema.safeParse({ tripId: formData.get("tripId"), documentId: formData.get("documentId"), title: formData.get("title"), category: formData.get("category"), holderName: formData.get("holderName") ?? "", issuedOn: formData.get("issuedOn") ?? "", expiresOn: formData.get("expiresOn") ?? "", notes: formData.get("notes") ?? "" });
  if (!parsed.success) redirect("/trips");
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("update_trip_document", { target_document_id: parsed.data.documentId, document_title: parsed.data.title, document_category: parsed.data.category, document_holder_name: parsed.data.holderName, document_issued_on: parsed.data.issuedOn || null, document_expires_on: parsed.data.expiresOn || null, document_notes: parsed.data.notes });
  redirect(`/trips/${parsed.data.tripId}/documents${error ? "?error=update_failed" : "?document=updated"}`);
}

export async function addTripDocumentAction(
  _state: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const parsed = tripDocumentSchema.safeParse({
    tripId: formData.get("tripId"),
    title: formData.get("title"),
    category: formData.get("category"),
    holderName: formData.get("holderName") ?? "",
    issuedOn: formData.get("issuedOn") ?? "",
    expiresOn: formData.get("expiresOn") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revise os dados do documento." };
  }

  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("add_trip_document", {
    target_trip_id: parsed.data.tripId,
    document_title: parsed.data.title,
    document_category: parsed.data.category,
    document_holder_name: parsed.data.holderName,
    document_issued_on: parsed.data.issuedOn || null,
    document_expires_on: parsed.data.expiresOn || null,
    document_notes: parsed.data.notes,
  });
  if (error) return { status: "error", message: "Não foi possível adicionar o documento." };
  redirect(`/trips/${parsed.data.tripId}/documents?document=added`);
}

export async function archiveTripDocumentAction(formData: FormData) {
  const parsed = archiveTripDocumentSchema.safeParse({
    tripId: formData.get("tripId"),
    documentId: formData.get("documentId"),
  });
  if (!parsed.success) redirect("/trips");

  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("archive_trip_document", {
    target_document_id: parsed.data.documentId,
  });
  redirect(`/trips/${parsed.data.tripId}/documents${error ? "?error=archive_failed" : "?document=archived"}`);
}
