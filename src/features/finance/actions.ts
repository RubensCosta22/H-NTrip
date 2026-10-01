"use server";

import { redirect } from "next/navigation";
import type { AccessActionState } from "@/src/features/access/actions";
import { requireCurrentMember } from "@/src/lib/auth/current-member";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";
import { confirmExpenseSchema, expenseCategorySchema, expenseMutationSchema, expenseSchema, parseExpenseAmount } from "./schema";

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
    kind: formData.get("kind") ?? "actual",
  });
  if (!parsed.success) return { status: "error", message: "Revise os dados do gasto." };
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc(parsed.data.kind === "planned" ? "add_planned_expense" : "add_expense", {
    target_trip_id: parsed.data.tripId, target_category_id: parsed.data.categoryId,
    expense_description: parsed.data.description, expense_merchant: parsed.data.merchant,
    target_expense_date: parsed.data.date,
    expense_amount: parseExpenseAmount(parsed.data.amountInput),
    request_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) {
    console.error(JSON.stringify({ action: "finance.create", kind: parsed.data.kind, outcome: "error", code: error.code }));
    return { status: "error", message: "Não foi possível registrar. Confira a categoria, a data e o valor." };
  }
  redirect(`/trips/${parsed.data.tripId}/finance?expense=${parsed.data.kind === "planned" ? "planned" : "added"}`);
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

export async function confirmPlannedExpenseAction(_previousState: AccessActionState, formData: FormData): Promise<AccessActionState> {
  const parsed = confirmExpenseSchema.safeParse({ tripId: formData.get("tripId"), expenseId: formData.get("expenseId"), amountInput: formData.get("amount"), date: formData.get("date"), idempotencyKey: formData.get("idempotencyKey") });
  if (!parsed.success) return { status: "error", message: "Informe um valor positivo com até duas casas decimais e a data do pagamento." };
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("confirm_planned_expense", { target_plan_id: parsed.data.expenseId, actual_amount: parseExpenseAmount(parsed.data.amountInput), actual_date: parsed.data.date, request_idempotency_key: parsed.data.idempotencyKey });
  if (error) {
    console.error(JSON.stringify({ action: "finance.confirm", outcome: "error", code: error.code }));
    return { status: "error", message: error.message.includes("confirmation_reversed") ? "Esta confirmação já foi estornada. Atualize a página para iniciar uma nova confirmação." : error.message.includes("already_confirmed") || error.message.includes("idempotency_key_conflict") ? "Este lançamento já foi confirmado ou mudou durante o envio. Atualize a página e confira o histórico." : "Não foi possível confirmar. Confira valor, data e conexão antes de tentar novamente." };
  }
  redirect(`/trips/${parsed.data.tripId}/finance?expense=confirmed`);
}

export async function cancelPlannedExpenseAction(formData: FormData) {
  const parsed = expenseMutationSchema.safeParse({ tripId: formData.get("tripId"), expenseId: formData.get("expenseId") });
  if (!parsed.success) redirect("/trips");
  await requireCurrentMember();
  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.rpc("cancel_planned_expense", { target_plan_id: parsed.data.expenseId });
  if (error) console.error(JSON.stringify({ action: "finance.cancel_plan", outcome: "error", code: error.code }));
  redirect(`/trips/${parsed.data.tripId}/finance${error ? "?error=cancel_failed" : "?expense=cancelled"}`);
}
