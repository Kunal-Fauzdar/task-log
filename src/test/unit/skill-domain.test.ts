import { describe, expect, it } from "vitest";

import {
  SKILL_CATEGORY_LABELS,
  SKILL_CATEGORY_ORDER,
  formatProficiencyChange,
} from "@/lib/domain/skill";

describe("SKILL_CATEGORY_LABELS / SKILL_CATEGORY_ORDER", () => {
  it("has the three bands from the spec, in display order", () => {
    expect(SKILL_CATEGORY_ORDER).toEqual(["LESS_THAN_30", "BETWEEN_30_70", "MORE_THAN_70"]);
    expect(SKILL_CATEGORY_LABELS.LESS_THAN_30).toBe("Less Than 30%");
    expect(SKILL_CATEGORY_LABELS.BETWEEN_30_70).toBe("30 to 70%");
    expect(SKILL_CATEGORY_LABELS.MORE_THAN_70).toBe("More Than 70%");
  });
});

describe("formatProficiencyChange", () => {
  it("formats an increase with a + sign", () => {
    expect(formatProficiencyChange(75, 85)).toBe("75% → 85% (+10%)");
  });

  it("formats a decrease without a double sign", () => {
    expect(formatProficiencyChange(85, 75)).toBe("85% → 75% (-10%)");
  });

  it("formats no change with no sign prefix", () => {
    expect(formatProficiencyChange(50, 50)).toBe("50% → 50% (0%)");
  });
});
