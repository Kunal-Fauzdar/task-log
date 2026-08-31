import { z } from "zod";

// FormData delivers each checked "workingDays" checkbox as a separate string entry (getAll) —
// coerced to numbers and validated as real weekday values (0-6) before ever reaching the DB.
export const workingDaysSchema = z.object({
  workingDays: z
    .array(z.coerce.number().int().min(0).max(6))
    .min(1, "Select at least one working day"),
});

export type WorkingDaysInput = z.infer<typeof workingDaysSchema>;
