import { z } from "zod";

import { TASK_ID_PATTERN } from "@/lib/domain/task";
import { durationString } from "@/lib/validation/shared";

// Restrict to http(s) even though z.url() would accept any well-formed URL — a task Link is
// rendered as a clickable <a href>, so this is where an XSS-by-javascript: URL gets stopped.
const httpUrl = z
  .url({ message: "Link must be a valid URL" })
  .refine((url) => /^https?:\/\//i.test(url), "Link must start with http:// or https://");

export const taskInputSchema = z.object({
  // Optional — a task can be a free-form note with no ticket ID. When given, it must still look
  // like "T-1039" (letters-dash-digits) so exports/imports stay consistent.
  taskId: z
    .union([
      z.literal(""),
      z.string().trim().regex(TASK_ID_PATTERN, "Task ID must look like T-1039"),
    ])
    .optional(),
  description: z.string().trim().min(1, "Description is required").max(2000),
  duration: durationString,
  link: z.union([httpUrl, z.literal("")]).optional(),
  // A Project id, or "" for "no project". The value comes from a server-rendered <select> of
  // real projects, so a bad id can only be a stale option — the FK (ON DELETE SET NULL) and the
  // action's own null-coercion handle that; no need to check existence here.
  projectId: z.string().trim().max(50).optional(),
});

export type TaskInput = z.infer<typeof taskInputSchema>;
