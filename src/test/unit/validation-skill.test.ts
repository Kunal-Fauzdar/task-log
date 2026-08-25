import { describe, expect, it } from "vitest";

import { skillInputSchema } from "@/lib/validation/skill";

describe("skillInputSchema", () => {
  it("accepts valid input", () => {
    const result = skillInputSchema.safeParse({
      name: "React.js",
      proficiencyPercentage: "85",
      notes: "Used daily",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.proficiencyPercentage).toBe(85);
    }
  });

  it("rejects an empty name", () => {
    const result = skillInputSchema.safeParse({ name: "  ", proficiencyPercentage: "50" });
    expect(result.success).toBe(false);
  });

  it("rejects a percentage above 100", () => {
    const result = skillInputSchema.safeParse({ name: "X", proficiencyPercentage: "101" });
    expect(result.success).toBe(false);
  });

  it("rejects a negative percentage", () => {
    const result = skillInputSchema.safeParse({ name: "X", proficiencyPercentage: "-1" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-integer percentage", () => {
    const result = skillInputSchema.safeParse({ name: "X", proficiencyPercentage: "50.5" });
    expect(result.success).toBe(false);
  });

  it("allows an empty/absent notes field", () => {
    const result = skillInputSchema.safeParse({ name: "X", proficiencyPercentage: "50" });
    expect(result.success).toBe(true);
  });
});
