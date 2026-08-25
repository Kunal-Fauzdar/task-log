import { z } from "zod";

import { durationString } from "@/lib/validation/shared";

export const workDayEditSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
  isHoliday: z.boolean(),
  holidayReason: z.string().trim().max(200).optional(),
});

export type WorkDayEditInput = z.infer<typeof workDayEditSchema>;

const timeInput = z
  .union([z.literal(""), z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Invalid time")])
  .optional();

function timeStringToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Manual correction form (spec §9) — checkIn/checkOut come from <input type="time"> as
// "HH:MM", breakDuration as "H:MM:SS". Overnight shifts (checkOut earlier than checkIn) are
// explicitly out of scope for v1 (see CLAUDE.md §5), so this rejects rather than silently
// treating it as an overnight shift.
export const workDayTimesSchema = z
  .object({
    checkIn: timeInput,
    checkOut: timeInput,
    breakDuration: durationString,
  })
  .refine(
    (data) => {
      if (!data.checkIn || !data.checkOut) return true;
      return timeStringToMinutes(data.checkOut) > timeStringToMinutes(data.checkIn);
    },
    { message: "Check Out must be after Check In", path: ["checkOut"] },
  );

export type WorkDayTimesInput = z.infer<typeof workDayTimesSchema>;
