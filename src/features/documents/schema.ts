import { z } from "zod";

export const documentCategories = [
  "identity",
  "reservation",
  "insurance",
  "transport",
  "health",
  "other",
] as const;

export const tripDocumentSchema = z.object({
  tripId: z.uuid(),
  title: z.string().trim().min(1).max(140),
  category: z.enum(documentCategories),
  holderName: z.string().trim().max(120),
  issuedOn: z.union([z.literal(""), z.iso.date()]),
  expiresOn: z.union([z.literal(""), z.iso.date()]),
  notes: z.string().trim().max(1000),
}).refine(
  (value) => !value.issuedOn || !value.expiresOn || value.expiresOn >= value.issuedOn,
  { message: "A validade não pode ser anterior à emissão.", path: ["expiresOn"] },
);

export const archiveTripDocumentSchema = z.object({
  tripId: z.uuid(),
  documentId: z.uuid(),
});

export const updateTripDocumentSchema = z.object({
  tripId: z.uuid(), documentId: z.uuid(), title: z.string().trim().min(1).max(140),
  category: z.enum(documentCategories), holderName: z.string().trim().max(120),
  issuedOn: z.union([z.literal(""), z.iso.date()]), expiresOn: z.union([z.literal(""), z.iso.date()]),
  notes: z.string().trim().max(1000),
}).refine((value) => !value.issuedOn || !value.expiresOn || value.expiresOn >= value.issuedOn,
  { message: "A validade não pode ser anterior à emissão.", path: ["expiresOn"] });
