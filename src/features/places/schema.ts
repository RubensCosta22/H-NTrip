import { z } from "zod";

export const placeCategories = [
  "lodging",
  "restaurant",
  "cafe",
  "attraction",
  "event",
  "parking",
  "other",
] as const;

const optionalMoney = z.union([
  z.literal(""),
  z.coerce.number().min(0).max(999999999999.99),
]);

export const tripPlaceSchema = z.object({
  tripId: z.uuid(),
  name: z.string().trim().min(1).max(140),
  category: z.enum(placeCategories),
  address: z.string().trim().max(300),
  phone: z.string().trim().max(40),
  website: z.union([z.literal(""), z.url().max(500)]),
  reservationCode: z.string().trim().max(100),
  startsOn: z.union([z.literal(""), z.iso.date()]),
  endsOn: z.union([z.literal(""), z.iso.date()]),
  plannedCost: optionalMoney,
  actualCost: optionalMoney,
  rating: z.union([z.literal(""), z.coerce.number().int().min(1).max(5)]),
  notes: z.string().trim().max(1000),
}).refine(
  (value) => !value.startsOn || !value.endsOn || value.endsOn >= value.startsOn,
  { message: "A data final não pode ser anterior à inicial.", path: ["endsOn"] },
);

export const archiveTripPlaceSchema = z.object({
  tripId: z.uuid(),
  placeId: z.uuid(),
});
