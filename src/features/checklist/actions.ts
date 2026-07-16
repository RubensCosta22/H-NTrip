"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { AccessActionState } from "@/src/features/access/actions";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { checklistItemMutationSchema, checklistItemSchema, checklistSchema } from "./schema";

export async function addChecklistAction(_state: AccessActionState, formData: FormData): Promise<AccessActionState> {
  const parsed = checklistSchema.safeParse({ tripId: formData.get("tripId"), name: formData.get("name"), description: formData.get("description") ?? "" });
  if (!parsed.success) return { status: "error", message: "Revise os dados da lista." };
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("add_checklist", { target_trip_id: parsed.data.tripId, checklist_name: parsed.data.name, checklist_description: parsed.data.description });
  if (error) return { status: "error", message: "Não foi possível criar. O nome pode já estar em uso." };
  redirect(`/trips/${parsed.data.tripId}/checklist?list=added`);
}

export async function addChecklistItemAction(_state: AccessActionState, formData: FormData): Promise<AccessActionState> {
  const parsed = checklistItemSchema.safeParse({ tripId: formData.get("tripId"), checklistId: formData.get("checklistId"), title: formData.get("title"), notes: formData.get("notes") ?? "", assigneeName: formData.get("assigneeName") ?? "", dueDate: formData.get("dueDate") ?? "" });
  if (!parsed.success) return { status: "error", message: "Revise os dados do item." };
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("add_checklist_item", { target_checklist_id: parsed.data.checklistId, item_title: parsed.data.title, item_notes: parsed.data.notes, item_assignee_name: parsed.data.assigneeName, item_due_date: parsed.data.dueDate || null });
  if (error) return { status: "error", message: "Não foi possível adicionar o item." };
  redirect(`/trips/${parsed.data.tripId}/checklist?item=added`);
}

export async function setChecklistItemCompletionAction(formData: FormData) {
  const parsed = checklistItemMutationSchema.extend({ completed: z.enum(["true", "false"]) }).safeParse({ tripId: formData.get("tripId"), itemId: formData.get("itemId"), completed: formData.get("completed") });
  if (!parsed.success) redirect("/trips");
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  await supabase.rpc("set_checklist_item_completion", { target_item_id: parsed.data.itemId, completed: parsed.data.completed === "true" });
  redirect(`/trips/${parsed.data.tripId}/checklist`);
}

export async function moveChecklistItemAction(formData: FormData) {
  const parsed = checklistItemMutationSchema.extend({ direction: z.enum(["up", "down"]) }).safeParse({ tripId: formData.get("tripId"), itemId: formData.get("itemId"), direction: formData.get("direction") });
  if (!parsed.success) redirect("/trips");
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  await supabase.rpc("move_checklist_item", { target_item_id: parsed.data.itemId, move_direction: parsed.data.direction });
  redirect(`/trips/${parsed.data.tripId}/checklist`);
}

export async function removeChecklistItemAction(formData: FormData) {
  const parsed = checklistItemMutationSchema.safeParse({ tripId: formData.get("tripId"), itemId: formData.get("itemId") });
  if (!parsed.success) redirect("/trips");
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("remove_checklist_item", { target_item_id: parsed.data.itemId });
  redirect(`/trips/${parsed.data.tripId}/checklist${error ? "?error=remove_failed" : "?item=removed"}`);
}
