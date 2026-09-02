import { z } from "zod";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
const monthOnly = z.string().regex(/^\d{4}-\d{2}$/, "Invalid month");

// Optional single-project filter — produces a per-project timesheet in the same layout, with
// each day's tasks limited to that project (days with none collapse to a timings-only row).
// An empty string (the "All projects" <option>) is treated as "no filter".
const projectId = z
  .string()
  .trim()
  .max(50)
  .optional()
  .transform((value) => (value ? value : undefined));

export const exportQuerySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("day"), date: dateOnly, projectId }),
  z.object({ type: z.literal("month"), month: monthOnly, projectId }),
  z
    .object({ type: z.literal("range"), from: dateOnly, to: dateOnly, projectId })
    .refine((data) => data.to >= data.from, {
      message: "End date must be on or after the start date",
      path: ["to"],
    }),
]);

export type ExportQuery = z.infer<typeof exportQuerySchema>;
