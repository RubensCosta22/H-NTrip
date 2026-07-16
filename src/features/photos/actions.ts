"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
const photoPreferenceSchema = z.object({ tripId: z.uuid(), photoId: z.uuid() });

export async function updateTripPhotoAction(formData: FormData) {
  const parsed = photoPreferenceSchema.extend({
    caption: z.string().trim().max(500), takenOn: z.union([z.literal(""), z.iso.date()]),
    locationName: z.string().trim().max(180), latitude: z.string(), longitude: z.string(),
  }).safeParse({ tripId: formData.get("tripId"), photoId: formData.get("photoId"), caption: formData.get("caption") ?? "", takenOn: formData.get("takenOn") ?? "", locationName: formData.get("locationName") ?? "", latitude: formData.get("latitude") ?? "", longitude: formData.get("longitude") ?? "" });
  if (!parsed.success) redirect("/trips");
  const latitude = parsed.data.latitude.trim() ? Number(parsed.data.latitude) : null;
  const longitude = parsed.data.longitude.trim() ? Number(parsed.data.longitude) : null;
  const validCoordinates = (latitude === null && longitude === null) || (latitude !== null && longitude !== null && Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180);
  if (!validCoordinates) redirect(`/trips/${parsed.data.tripId}/photos?error=invalid_location`);
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("update_trip_photo_metadata", { target_photo_id: parsed.data.photoId, photo_caption: parsed.data.caption, photo_taken_on: parsed.data.takenOn || null, photo_location_name: parsed.data.locationName, photo_latitude: latitude, photo_longitude: longitude });
  redirect(`/trips/${parsed.data.tripId}/photos${error ? "?error=update_failed" : "?photo=updated"}`);
}

export async function setPhotoFavoriteAction(formData: FormData) {
  const parsed = photoPreferenceSchema.extend({ favorite: z.enum(["true", "false"]) }).safeParse({ tripId: formData.get("tripId"), photoId: formData.get("photoId"), favorite: formData.get("favorite") });
  if (!parsed.success) redirect("/trips");
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  await supabase.rpc("set_trip_photo_favorite", { target_photo_id: parsed.data.photoId, favorite: parsed.data.favorite === "true" });
  redirect(`/trips/${parsed.data.tripId}/photos`);
}

export async function setTripCoverPhotoAction(formData: FormData) {
  const parsed = photoPreferenceSchema.safeParse({ tripId: formData.get("tripId"), photoId: formData.get("photoId") });
  if (!parsed.success) redirect("/trips");
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  await supabase.rpc("set_trip_cover_photo", { target_photo_id: parsed.data.photoId });
  redirect(`/trips/${parsed.data.tripId}/photos`);
}

const archivePhotoSchema = z.object({ tripId: z.uuid(), photoId: z.uuid() });

export async function archiveTripPhotoAction(formData: FormData) {
  const parsed = archivePhotoSchema.safeParse({ tripId: formData.get("tripId"), photoId: formData.get("photoId") });
  if (!parsed.success) redirect("/trips");
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("archive_trip_photo", { target_photo_id: parsed.data.photoId });
  redirect(`/trips/${parsed.data.tripId}/photos${error ? "?error=archive_failed" : "?photo=archived"}`);
}
