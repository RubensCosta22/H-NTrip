"use server";

import { redirect } from "next/navigation";
import type { AccessActionState } from "@/src/features/access/actions";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { expenseCategorySchema, expenseMutationSchema, expenseSchema, parseExpenseAmount } from "./schema";

export async function addExpenseCategoryAction(
  _previousState: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const parsed = expenseCategorySchema.safeParse({
    tripId: formData.get("tripId"), name: formData.get("name"), color: formData.get("color"),
  });
  if (!parsed.success) return { status: "error", message: "Revise o nome e a cor da categoria." };
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("add_expense_category", {
    target_trip_id: parsed.data.tripId, category_name: parsed.data.name,
    category_color: parsed.data.color,
  });
  if (error) return { status: "error", message: "Não foi possível criar. O nome pode já estar em uso." };
  redirect(`/trips/${parsed.data.tripId}/finance?category=added`);
}

export async function addExpenseAction(
  _previousState: AccessActionState,
  formData: FormData,
): Promise<AccessActionState> {
  const parsed = expenseSchema.safeParse({
    tripId: formData.get("tripId"), categoryId: formData.get("categoryId"),
    description: formData.get("description"), merchant: formData.get("merchant") ?? "",
    date: formData.get("date"), amountInput: formData.get("amount"),
    idempotencyKey: formData.get("idempotencyKey"),
  });
  if (!parsed.success) return { status: "error", message: "Revise os dados do gasto." };
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("add_expense", {
    target_trip_id: parsed.data.tripId, target_category_id: parsed.data.categoryId,
    expense_description: parsed.data.description, expense_merchant: parsed.data.merchant,
    target_expense_date: parsed.data.date,
    expense_amount: parseExpenseAmount(parsed.data.amountInput),
    request_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) return { status: "error", message: "Não foi possível registrar. Confira a categoria, a data e o valor." };
  redirect(`/trips/${parsed.data.tripId}/finance?expense=added`);
}

export async function reverseExpenseAction(formData: FormData) {
  const parsed = expenseMutationSchema.safeParse({
    tripId: formData.get("tripId"), expenseId: formData.get("expenseId"),
  });
  if (!parsed.success) redirect("/trips");
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("reverse_expense", { target_expense_id: parsed.data.expenseId });
  redirect(`/trips/${parsed.data.tripId}/finance${error ? "?error=reverse_failed" : "?expense=reversed"}`);
}
