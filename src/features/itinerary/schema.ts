import { z } from "zod";

export const itineraryDaySchema = z.object({
  tripId: z.uuid(),
  date: z.iso.date(),
  title: z.string().trim().max(120),
  notes: z.string().trim().max(1000),
});

export const itineraryActivitySchema = z
  .object({
    dayId: z.uuid(),
    tripId: z.uuid(),
    title: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000),
    location: z.string().trim().max(180),
    latitude: z.union([z.literal(""), z.coerce.number().min(-90).max(90)]),
    longitude: z.union([z.literal(""), z.coerce.number().min(-180).max(180)]),
    startTime: z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)]),
    endTime: z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)]),
    endsNextDay: z.boolean(),
  })
  .refine((data) => !data.endTime || Boolean(data.startTime), {
    message: "Informe o horário inicial antes do horário final.",
    path: ["endTime"],
  })
  .refine((data) => Boolean(data.latitude === "") === Boolean(data.longitude === ""), {
    message: "Informe latitude e longitude juntas.",
    path: ["longitude"],
  })
  .refine(
    (data) => !data.startTime || !data.endTime || data.endsNextDay || data.endTime >= data.startTime,
    { message: "O horário final deve ser posterior ao inicial.", path: ["endTime"] },
  );

export const itineraryMutationSchema = z.object({
  tripId: z.uuid(),
  activityId: z.uuid(),
});
