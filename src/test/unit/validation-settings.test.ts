import { describe, expect, it } from "vitest";

import { workingDaysSchema } from "@/lib/validation/settings";

describe("workingDaysSchema", () => {
  it("accepts FormData.getAll()-shaped string values and coerces them to numbers", () => {
    const result = workingDaysSchema.safeParse({ workingDays: ["1", "2", "3", "4", "5"] });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.workingDays).toEqual([1, 2, 3, 4, 5]);
  });

  it("rejects an empty selection — at least one working day is required", () => {
    const result = workingDaysSchema.safeParse({ workingDays: [] });
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-range weekday value", () => {
    expect(workingDaysSchema.safeParse({ workingDays: ["7"] }).success).toBe(false);
    expect(workingDaysSchema.safeParse({ workingDays: ["-1"] }).success).toBe(false);
  });
});
