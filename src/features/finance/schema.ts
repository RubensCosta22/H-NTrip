import { z } from "zod";

const moneyPattern = /^\d{1,12}(?:[.,]\d{1,2})?$/;

export const expenseCategorySchema = z.object({
  tripId: z.uuid(),
  name: z.string().trim().min(1).max(80),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

export const expenseSchema = z.object({
  tripId: z.uuid(),
  categoryId: z.uuid(),
  description: z.string().trim().min(1).max(180),
  merchant: z.string().trim().max(120),
  date: z.iso.date(),
  amountInput: z.string().trim().regex(moneyPattern),
  idempotencyKey: z.uuid(),
});

export const expenseMutationSchema = z.object({
  tripId: z.uuid(),
  expenseId: z.uuid(),
});

export function parseExpenseAmount(input: string) {
  return Number(input.replace(",", ".")).toFixed(2);
}
