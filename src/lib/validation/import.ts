import { z } from "zod";

import { TASK_ID_PATTERN } from "@/lib/domain/task";

// Re-validated server-side on confirm (spec §33: "never trust client-side validation alone") —
// the preview shown in the browser came from this same server a moment earlier, but the confirm
// request is still just untrusted JSON as far as this endpoint is concerned.
const httpUrlOrEmpty = z.union([
  z.literal(""),
  z.string().trim().regex(/^https?:\/\//i, "Link must start with http:// or https://"),
]);

const timeHHMM = z
  .union([z.literal(""), z.string().regex(/^\d{2}:\d{2}$/, "Invalid time")])
  .nullable()
  .optional()
  .transform((value) => (value ? value : null));

const importTaskSchema = z.object({
  // Optional — empty is allowed; when present it must match the T-1039 shape.
  taskId: z
    .union([z.literal(""), z.string().trim().regex(TASK_ID_PATTERN, "Invalid Task ID")])
    .optional()
    .transform((value) => value ?? ""),
  description: z.string().trim().min(1, "Description is required").max(2000),
  durationSeconds: z.number().int().min(0),
  link: httpUrlOrEmpty.nullable().optional().transform((value) => value || null),
});

export const importGroupSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
    dayType: z.enum(["WORKING", "HOLIDAY", "LEAVE"]),
    dayNote: z.string().trim().max(200).nullable().optional(),
    checkIn: timeHHMM,
    checkOut: timeHHMM,
    breakSeconds: z.number().int().min(0),
    tasks: z.array(importTaskSchema),
  })
  .refine(
    (data) => {
      if (!data.checkIn || !data.checkOut) return true;
      return data.checkOut > data.checkIn;
    },
    { message: "Check Out must be after Check In", path: ["checkOut"] },
  );

export const importConfirmSchema = z.object({
  groups: z.array(importGroupSchema).min(1, "No rows selected to import"),
});

export type ImportGroupInput = z.infer<typeof importGroupSchema>;
