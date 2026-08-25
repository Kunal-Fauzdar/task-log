import { z } from "zod";

const dateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
const monthOnly = z.string().regex(/^\d{4}-\d{2}$/, "Invalid month");

export const exportQuerySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("day"), date: dateOnly }),
  z.object({ type: z.literal("month"), month: monthOnly }),
  z
    .object({ type: z.literal("range"), from: dateOnly, to: dateOnly })
    .refine((data) => data.to >= data.from, {
      message: "End date must be on or after the start date",
      path: ["to"],
    }),
]);

export type ExportQuery = z.infer<typeof exportQuerySchema>;
