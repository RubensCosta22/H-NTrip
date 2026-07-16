"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { AccessActionState } from "@/src/features/access/actions";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { itineraryActivitySchema, itineraryDaySchema, itineraryMutationSchema } from "./schema";

export async function addItineraryDayAction(
  _previousState: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const parsed = itineraryDaySchema.safeParse({
    tripId: formData.get("tripId"), date: formData.get("date"),
    title: formData.get("title") ?? "", notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { status: "error", message: "Revise a data e os dados do dia." };
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("add_itinerary_day", {
    target_trip_id: parsed.data.tripId, target_date: parsed.data.date,
    day_title: parsed.data.title, day_notes: parsed.data.notes,
  });
  if (error) return { status: "error", message: "Não foi possível adicionar. A data deve estar dentro da viagem e não pode se repetir." };
  redirect(`/trips/${parsed.data.tripId}/itinerary?day=added`);
}

export async function addItineraryActivityAction(
  _previousState: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const parsed = itineraryActivitySchema.safeParse({
    dayId: formData.get("dayId"), tripId: formData.get("tripId"),
    title: formData.get("title"), description: formData.get("description") ?? "",
    location: formData.get("location") ?? "", startTime: formData.get("startTime") ?? "",
    latitude: formData.get("latitude") ?? "", longitude: formData.get("longitude") ?? "",
    endTime: formData.get("endTime") ?? "", endsNextDay: formData.get("endsNextDay") === "on",
  });
  if (!parsed.success) {
    return { status: "error", message: parsed.error.issues[0]?.message ?? "Revise a atividade." };
  }
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("add_itinerary_activity", {
    target_day_id: parsed.data.dayId, activity_title: parsed.data.title,
    activity_description: parsed.data.description, activity_location: parsed.data.location,
    activity_latitude: parsed.data.latitude === "" ? null : parsed.data.latitude,
    activity_longitude: parsed.data.longitude === "" ? null : parsed.data.longitude,
    activity_start_time: parsed.data.startTime || null,
    activity_end_time: parsed.data.endTime || null,
    activity_ends_next_day: parsed.data.endsNextDay,
  });
  if (error) return { status: "error", message: "Não foi possível adicionar a atividade." };
  redirect(`/trips/${parsed.data.tripId}/itinerary?activity=added`);
}

export async function moveItineraryActivityAction(formData: FormData) {
  const parsed = itineraryMutationSchema.extend({ direction: z.enum(["up", "down"]) }).safeParse({
    tripId: formData.get("tripId"), activityId: formData.get("activityId"),
    direction: formData.get("direction"),
  });
  if (!parsed.success) redirect("/trips");
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  await supabase.rpc("move_itinerary_activity", {
    target_activity_id: parsed.data.activityId, move_direction: parsed.data.direction,
  });
  redirect(`/trips/${parsed.data.tripId}/itinerary`);
}

export async function removeItineraryActivityAction(formData: FormData) {
  const parsed = itineraryMutationSchema.safeParse({
    tripId: formData.get("tripId"), activityId: formData.get("activityId"),
  });
  if (!parsed.success) redirect("/trips");
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("remove_itinerary_activity", {
    target_activity_id: parsed.data.activityId,
  });
  redirect(`/trips/${parsed.data.tripId}/itinerary${error ? "?error=remove_failed" : "?activity=removed"}`);
}
