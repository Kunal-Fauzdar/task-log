import { z } from "zod";

import { parseDurationToSeconds } from "@/lib/domain/duration";

// Shared by any form field entering a duration as "H:MM:SS" (task duration, break duration).
export const durationString = z
  .string()
  .trim()
  .refine(
    (value) => {
      try {
        parseDurationToSeconds(value);
        return true;
      } catch {
        return false;
      }
    },
    { message: "Duration must be in H:MM:SS format, e.g. 4:00:00" },
  )
  .transform(parseDurationToSeconds);
