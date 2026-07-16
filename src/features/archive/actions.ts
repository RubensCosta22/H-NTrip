"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

const restoreSchema = z.object({ tripId: z.uuid(), itemId: z.uuid(), kind: z.enum(["document", "photo", "place"]) });

export async function restoreTripItemAction(formData: FormData) {
  const parsed = restoreSchema.safeParse({ tripId: formData.get("tripId"), itemId: formData.get("itemId"), kind: formData.get("kind") });
  if (!parsed.success) redirect("/trips");
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const functions = { document: "restore_trip_document", photo: "restore_trip_photo", place: "restore_trip_place" } as const;
  const parameters = { document: "target_document_id", photo: "target_photo_id", place: "target_place_id" } as const;
  const { error } = await supabase.rpc(functions[parsed.data.kind], { [parameters[parsed.data.kind]]: parsed.data.itemId });
  redirect(`/trips/${parsed.data.tripId}/archived${error ? "?error=restore_failed" : "?restored=1"}`);
}

export async function restoreTripAction(formData: FormData) {
  const parsed = z.object({ tripId: z.uuid() }).safeParse({ tripId: formData.get("tripId") });
  if (!parsed.success) redirect("/trips");
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("restore_trip", { target_trip_id: parsed.data.tripId });
  redirect(error ? "/trips/archived?error=restore_failed" : `/trips/${parsed.data.tripId}?restored=1`);
}
