"use server";

import { redirect } from "next/navigation";
import type { AccessActionState } from "@/src/features/access/actions";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { archiveTripPlaceSchema, tripPlaceSchema } from "./schema";

export async function addTripPlaceAction(
  _state: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const parsed = tripPlaceSchema.safeParse({
    tripId: formData.get("tripId"),
    name: formData.get("name"),
    category: formData.get("category"),
    address: formData.get("address") ?? "",
    phone: formData.get("phone") ?? "",
    website: formData.get("website") ?? "",
    reservationCode: formData.get("reservationCode") ?? "",
    startsOn: formData.get("startsOn") ?? "",
    endsOn: formData.get("endsOn") ?? "",
    plannedCost: formData.get("plannedCost") ?? "",
    actualCost: formData.get("actualCost") ?? "",
    rating: formData.get("rating") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revise os dados do local." };
  }

  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("add_trip_place", {
    target_trip_id: parsed.data.tripId,
    place_name: parsed.data.name,
    place_category: parsed.data.category,
    place_address: parsed.data.address,
    place_phone: parsed.data.phone,
    place_website: parsed.data.website,
    place_reservation_code: parsed.data.reservationCode,
    place_starts_on: parsed.data.startsOn || null,
    place_ends_on: parsed.data.endsOn || null,
    place_planned_cost: parsed.data.plannedCost === "" ? null : parsed.data.plannedCost,
    place_actual_cost: parsed.data.actualCost === "" ? null : parsed.data.actualCost,
    place_rating: parsed.data.rating === "" ? null : parsed.data.rating,
    place_notes: parsed.data.notes,
  });
  if (error) return { status: "error", message: "Não foi possível adicionar o local." };
  redirect(`/trips/${parsed.data.tripId}/places?place=added`);
}

export async function archiveTripPlaceAction(formData: FormData) {
  const parsed = archiveTripPlaceSchema.safeParse({
    tripId: formData.get("tripId"),
    placeId: formData.get("placeId"),
  });
  if (!parsed.success) redirect("/trips");
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("archive_trip_place", { target_place_id: parsed.data.placeId });
  redirect(`/trips/${parsed.data.tripId}/places${error ? "?error=archive_failed" : "?place=archived"}`);
}
