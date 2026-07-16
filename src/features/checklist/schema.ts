import { z } from "zod";

export const checklistSchema = z.object({
  tripId: z.uuid(), name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500),
});

export const checklistItemSchema = z.object({
  tripId: z.uuid(), checklistId: z.uuid(), title: z.string().trim().min(1).max(180),
  notes: z.string().trim().max(1000), assigneeName: z.string().trim().max(120),
  dueDate: z.union([z.literal(""), z.iso.date()]),
});

export const checklistItemMutationSchema = z.object({
  tripId: z.uuid(), itemId: z.uuid(),
});
