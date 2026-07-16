"use server";

import { redirect } from "next/navigation";
import type { AccessActionState } from "@/src/features/access/actions";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import {
  editableTripStatusSchema,
  idSchema,
  parseBudget,
  participantFormSchema,
  tripFormSchema,
} from "./trip-schema";

export async function createTripAction(
  _previousState: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const parsed = tripFormSchema.safeParse({
    name: formData.get("name"),
    destination: formData.get("destination"),
    description: formData.get("description") ?? "",
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    timezone: formData.get("timezone"),
    baseCurrency: formData.get("baseCurrency"),
    budgetInput: formData.get("budget"),
  });

  if (!parsed.success) {
    const dateError = parsed.error.issues.find((issue) => issue.path.includes("endDate"));
    return {
      status: "error",
      message: dateError?.message ?? "Revise os dados da viagem e tente novamente.",
    };
  }

  const member = await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("create_trip", {
    target_workspace_id: member.workspaceId,
    trip_name: parsed.data.name,
    trip_destination: parsed.data.destination,
    trip_description: parsed.data.description,
    trip_start_date: parsed.data.startDate,
    trip_end_date: parsed.data.endDate,
    trip_timezone: parsed.data.timezone,
    trip_base_currency: parsed.data.baseCurrency,
    trip_budget: parseBudget(parsed.data.budgetInput),
  });

  if (error) {
    return { status: "error", message: "Não foi possível criar a viagem agora." };
  }

  redirect("/trips?created=1");
}

export async function updateTripAction(
  _previousState: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const tripId = idSchema.safeParse(formData.get("tripId"));
  const status = editableTripStatusSchema.safeParse(formData.get("status"));
  const parsed = tripFormSchema.safeParse({
    name: formData.get("name"),
    destination: formData.get("destination"),
    description: formData.get("description") ?? "",
    startDate: formData.get("startDate"),
    endDate: formData.get("endDate"),
    timezone: formData.get("timezone"),
    baseCurrency: formData.get("baseCurrency"),
    budgetInput: formData.get("budget"),
  });

  if (!tripId.success || !status.success || !parsed.success) {
    const dateError = parsed.success
      ? undefined
      : parsed.error.issues.find((issue) => issue.path.includes("endDate"));
    return { status: "error", message: dateError?.message ?? "Revise os dados da viagem." };
  }

  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("update_trip", {
    target_trip_id: tripId.data,
    trip_name: parsed.data.name,
    trip_destination: parsed.data.destination,
    trip_description: parsed.data.description,
    trip_start_date: parsed.data.startDate,
    trip_end_date: parsed.data.endDate,
    trip_timezone: parsed.data.timezone,
    trip_base_currency: parsed.data.baseCurrency,
    trip_budget: parseBudget(parsed.data.budgetInput),
    trip_status: status.data,
  });

  if (error) return { status: "error", message: "Não foi possível salvar as alterações." };
  redirect(`/trips/${tripId.data}?updated=1`);
}

export async function archiveTripAction(formData: FormData) {
  const tripId = idSchema.safeParse(formData.get("tripId"));
  if (!tripId.success) redirect("/trips");
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("archive_trip", { target_trip_id: tripId.data });
  if (error) redirect(`/trips/${tripId.data}?error=archive_failed`);
  redirect("/trips?archived=1");
}

export async function addParticipantAction(
  _previousState: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const parsed = participantFormSchema.safeParse({
    tripId: formData.get("tripId"),
    name: formData.get("name"),
    email: formData.get("email") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) {
    return { status: "error", message: "Revise os dados do participante." };
  }

  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("add_trip_participant", {
    target_trip_id: parsed.data.tripId,
    participant_name: parsed.data.name,
    participant_email: parsed.data.email,
    participant_notes: parsed.data.notes,
  });
  if (error) {
    return {
      status: "error",
      message: "Não foi possível adicionar. Verifique se o e-mail já está na viagem.",
    };
  }
  redirect(`/trips/${parsed.data.tripId}?participant=added`);
}

export async function removeParticipantAction(formData: FormData) {
  const participantId = idSchema.safeParse(formData.get("participantId"));
  const tripId = idSchema.safeParse(formData.get("tripId"));
  if (!participantId.success || !tripId.success) redirect("/trips");
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("remove_trip_participant", {
    target_participant_id: participantId.data,
  });
  if (error) redirect(`/trips/${tripId.data}?error=participant_remove_failed`);
  redirect(`/trips/${tripId.data}?participant=removed`);
}
