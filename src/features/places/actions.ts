"use server";

import { redirect } from "next/navigation";
import type { AccessActionState } from "@/src/features/access/actions";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { archiveTripPlaceSchema, tripPlaceSchema } from "./schema";

const parsePlace = (formData: FormData) => tripPlaceSchema.safeParse({ tripId: formData.get("tripId"), name: formData.get("name"), category: formData.get("category"), address: formData.get("address") ?? "", phone: formData.get("phone") ?? "", website: formData.get("website") ?? "", reservationCode: formData.get("reservationCode") ?? "", startsOn: formData.get("startsOn") ?? "", endsOn: formData.get("endsOn") ?? "", plannedCost: formData.get("plannedCost") ?? "", actualCost: formData.get("actualCost") ?? "", rating: formData.get("rating") ?? "", notes: formData.get("notes") ?? "" });
const rpcArgs = (d: z.infer<typeof tripPlaceSchema>) => ({ place_name:d.name,place_category:d.category,place_address:d.address,place_phone:d.phone,place_website:d.website,place_reservation_code:d.reservationCode,place_starts_on:d.startsOn||null,place_ends_on:d.endsOn||null,place_planned_cost:d.plannedCost===""?null:d.plannedCost,place_actual_cost:d.actualCost===""?null:d.actualCost,place_rating:d.rating===""?null:d.rating,place_notes:d.notes });
import { z } from "zod";

export async function addTripPlaceAction(_state: AccessActionState, formData: FormData): Promise<AccessActionState> {
 const parsed=parsePlace(formData); if(!parsed.success)return {status:"error",message:parsed.error.issues[0]?.message??"Revise os dados do local."}; await requireCurrentMember(); const supabase=await createServerSupabaseClient(); const {error}=await supabase.rpc("add_trip_place",{target_trip_id:parsed.data.tripId,...rpcArgs(parsed.data)}); if(error)return {status:"error",message:"Não foi possível adicionar o local."}; redirect(`/trips/${parsed.data.tripId}/places?place=added`);
}
export async function updateTripPlaceAction(formData: FormData){ const placeId=String(formData.get("placeId")??""); const parsed=parsePlace(formData); if(!parsed.success||!/^[0-9a-f-]{36}$/i.test(placeId))redirect(`/trips/${String(formData.get("tripId")??"")}/places?error=edit_invalid`); await requireCurrentMember(); const supabase=await createServerSupabaseClient(); const {error}=await supabase.rpc("update_trip_place",{target_place_id:placeId,...rpcArgs(parsed.data)}); redirect(`/trips/${parsed.data.tripId}/places${error?"?error=edit_failed":"?place=updated"}`); }
export async function archiveTripPlaceAction(formData: FormData){const parsed=archiveTripPlaceSchema.safeParse({tripId:formData.get("tripId"),placeId:formData.get("placeId")});if(!parsed.success)redirect("/trips");await requireCurrentMember();const supabase=await createServerSupabaseClient();const {error}=await supabase.rpc("archive_trip_place",{target_place_id:parsed.data.placeId});redirect(`/trips/${parsed.data.tripId}/places${error?"?error=archive_failed":"?place=archived"}`);}
