import { describe, expect, it } from "vitest";

import { workDayTimesSchema } from "@/lib/validation/workday";

describe("workDayTimesSchema", () => {
  it("accepts valid check-in/check-out/break and transforms break to seconds", () => {
    const result = workDayTimesSchema.safeParse({
      checkIn: "10:10",
      checkOut: "19:25",
      breakDuration: "0:30:00",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.breakDuration).toBe(30 * 60);
    }
  });

  it("allows empty checkIn/checkOut (clearing them)", () => {
    const result = workDayTimesSchema.safeParse({
      checkIn: "",
      checkOut: "",
      breakDuration: "0:00:00",
    });
    expect(result.success).toBe(true);
  });

  it("rejects checkOut earlier than checkIn", () => {
    const result = workDayTimesSchema.safeParse({
      checkIn: "19:25",
      checkOut: "10:10",
      breakDuration: "0:00:00",
    });
    expect(result.success).toBe(false);
  });

  it("rejects checkOut equal to checkIn", () => {
    const result = workDayTimesSchema.safeParse({
      checkIn: "10:10",
      checkOut: "10:10",
      breakDuration: "0:00:00",
    });
    expect(result.success).toBe(false);
  });

  it("allows checkOut without checkIn present validation-wise (cross-field only fires when both set)", () => {
    const result = workDayTimesSchema.safeParse({
      checkIn: "",
      checkOut: "19:25",
      breakDuration: "0:00:00",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed break duration", () => {
    const result = workDayTimesSchema.safeParse({
      checkIn: "10:10",
      checkOut: "19:25",
      breakDuration: "half an hour",
    });
    expect(result.success).toBe(false);
  });
});
