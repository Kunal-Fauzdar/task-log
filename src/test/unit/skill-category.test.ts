import { describe, expect, it } from "vitest";

import { deriveSkillCategory } from "@/lib/domain/skill";

describe("deriveSkillCategory", () => {
  it("returns LESS_THAN_30 for 0-29", () => {
    expect(deriveSkillCategory(0)).toBe("LESS_THAN_30");
    expect(deriveSkillCategory(20)).toBe("LESS_THAN_30");
    expect(deriveSkillCategory(29)).toBe("LESS_THAN_30");
  });

  it("returns BETWEEN_30_70 for 30-70", () => {
    expect(deriveSkillCategory(30)).toBe("BETWEEN_30_70");
    expect(deriveSkillCategory(55)).toBe("BETWEEN_30_70");
    expect(deriveSkillCategory(70)).toBe("BETWEEN_30_70");
  });

  it("returns MORE_THAN_70 for 71-100", () => {
    expect(deriveSkillCategory(71)).toBe("MORE_THAN_70");
    expect(deriveSkillCategory(85)).toBe("MORE_THAN_70");
    expect(deriveSkillCategory(100)).toBe("MORE_THAN_70");
  });

  it("rejects out-of-range values", () => {
    expect(() => deriveSkillCategory(-1)).toThrow(RangeError);
    expect(() => deriveSkillCategory(101)).toThrow(RangeError);
  });

  it("rejects non-integer values", () => {
    expect(() => deriveSkillCategory(29.5)).toThrow(RangeError);
  });
});
