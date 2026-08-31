import { SkillCategory } from "../../generated/prisma/enums.ts";

// Boundaries per CLAUDE.md §21: 0-29 -> LESS_THAN_30, 30-70 -> BETWEEN_30_70, 71-100 -> MORE_THAN_70.
export const SKILL_PROFICIENCY_MIN = 0;
export const SKILL_PROFICIENCY_MAX = 100;

export function deriveSkillCategory(proficiencyPercentage: number): SkillCategory {
  if (
    !Number.isInteger(proficiencyPercentage) ||
    proficiencyPercentage < SKILL_PROFICIENCY_MIN ||
    proficiencyPercentage > SKILL_PROFICIENCY_MAX
  ) {
    throw new RangeError(
      `proficiencyPercentage must be an integer between ${SKILL_PROFICIENCY_MIN} and ${SKILL_PROFICIENCY_MAX}, got ${proficiencyPercentage}`,
    );
  }

  if (proficiencyPercentage <= 29) return SkillCategory.LESS_THAN_30;
  if (proficiencyPercentage <= 70) return SkillCategory.BETWEEN_30_70;
  return SkillCategory.MORE_THAN_70;
}

// Display labels matching the spec's three SkillMap bands (§20), in display order.
export const SKILL_CATEGORY_LABELS: Record<SkillCategory, string> = {
  LESS_THAN_30: "Less Than 30%",
  BETWEEN_30_70: "30 to 70%",
  MORE_THAN_70: "More Than 70%",
};

export const SKILL_CATEGORY_ORDER: SkillCategory[] = [
  SkillCategory.LESS_THAN_30,
  SkillCategory.BETWEEN_30_70,
  SkillCategory.MORE_THAN_70,
];

// A monochrome proficiency ramp instead of a red/amber/green stoplight: neutral grey-green for
// "needs work", sage for "developing", bright green for "strong". Flat fills, no gradients.
export const SKILL_CATEGORY_PROGRESS_CLASS: Record<SkillCategory, string> = {
  LESS_THAN_30: "bg-muted-foreground/45",
  BETWEEN_30_70: "bg-accent",
  MORE_THAN_70: "bg-success",
};

export const SKILL_CATEGORY_ICON_CLASS: Record<SkillCategory, string> = {
  LESS_THAN_30: "bg-muted text-muted-foreground",
  BETWEEN_30_70: "bg-accent/20 text-foreground",
  MORE_THAN_70: "bg-success/25 text-success-foreground",
};

export const SKILL_CATEGORY_BORDER_CLASS: Record<SkillCategory, string> = {
  LESS_THAN_30: "border-l-muted-foreground/40",
  BETWEEN_30_70: "border-l-accent",
  MORE_THAN_70: "border-l-success",
};

// e.g. "75% → 85% (+10%)" for a SkillHistory entry (spec §23).
export function formatProficiencyChange(fromPercentage: number, toPercentage: number): string {
  const delta = toPercentage - fromPercentage;
  const sign = delta > 0 ? "+" : "";
  return `${fromPercentage}% → ${toPercentage}% (${sign}${delta}%)`;
}
