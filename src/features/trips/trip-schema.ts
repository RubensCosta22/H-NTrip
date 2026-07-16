import { z } from "zod";

const moneyPattern = /^\d{1,12}(?:[.,]\d{1,2})?$/;
const currencyPattern = /^[A-Z]{3}$/;

function isValidTimezone(value: string) {
  try {
    new Intl.DateTimeFormat("pt-BR", { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}

export const tripFormSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    destination: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    timezone: z.string().trim().min(1).max(64).refine(isValidTimezone),
    baseCurrency: z.string().trim().toUpperCase().regex(currencyPattern),
    budgetInput: z.string().trim().regex(moneyPattern),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "A data final deve ser igual ou posterior à data inicial.",
    path: ["endDate"],
  });

export function parseBudget(input: string) {
  return Number(input.replace(",", ".")).toFixed(2);
}

export const idSchema = z.uuid();
export const editableTripStatusSchema = z.enum(["draft", "planned"]);
export const participantFormSchema = z.object({
  tripId: idSchema,
  name: z.string().trim().min(1).max(120),
  email: z.union([z.literal(""), z.string().trim().email().max(254)]),
  notes: z.string().trim().max(500),
});

export type TripFormData = z.infer<typeof tripFormSchema>;
