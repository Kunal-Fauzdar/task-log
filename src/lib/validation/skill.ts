import { z } from "zod";

import { SKILL_PROFICIENCY_MAX, SKILL_PROFICIENCY_MIN } from "@/lib/domain/skill";

export const skillInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  proficiencyPercentage: z.coerce
    .number()
    .int("Must be a whole number")
    .min(SKILL_PROFICIENCY_MIN, `Must be between ${SKILL_PROFICIENCY_MIN} and ${SKILL_PROFICIENCY_MAX}`)
    .max(SKILL_PROFICIENCY_MAX, `Must be between ${SKILL_PROFICIENCY_MIN} and ${SKILL_PROFICIENCY_MAX}`),
  notes: z.string().trim().max(1000).optional(),
});

export type SkillInput = z.infer<typeof skillInputSchema>;
