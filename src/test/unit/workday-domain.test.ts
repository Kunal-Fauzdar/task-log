import { describe, expect, it } from "vitest";

import {
  DURATION_TOLERANCE_SECONDS,
  calculateNetWorkSeconds,
  calculateTotalTaskSeconds,
  deriveWorkDayStatus,
  hasDurationDiscrepancy,
} from "@/lib/domain/workday";

describe("calculateNetWorkSeconds", () => {
  it("returns null when checkIn or checkOut is missing", () => {
    expect(calculateNetWorkSeconds({ checkIn: null, checkOut: null, breakSeconds: 0 })).toBeNull();
    expect(
      calculateNetWorkSeconds({ checkIn: new Date(), checkOut: null, breakSeconds: 0 }),
    ).toBeNull();
  });

  it("subtracts break from checkOut - checkIn", () => {
    const checkIn = new Date(Date.UTC(2026, 7, 24, 10, 10, 0));
    const checkOut = new Date(Date.UTC(2026, 7, 24, 19, 25, 0));
    // 9h15m gross, minus 30m break = 8h45m
    const result = calculateNetWorkSeconds({ checkIn, checkOut, breakSeconds: 30 * 60 });
    expect(result).toBe(8 * 3600 + 45 * 60);
  });
});

describe("calculateTotalTaskSeconds", () => {
  it("sums task durations", () => {
    expect(
      calculateTotalTaskSeconds([{ durationSeconds: 3600 }, { durationSeconds: 1800 }]),
    ).toBe(5400);
  });

  it("returns 0 for no tasks", () => {
    expect(calculateTotalTaskSeconds([])).toBe(0);
  });
});

describe("hasDurationDiscrepancy", () => {
  it("is false when net work duration is unknown (day not complete)", () => {
    expect(hasDurationDiscrepancy(null, 999999)).toBe(false);
  });

  it("is false when task total is within tolerance", () => {
    const net = 8 * 3600;
    expect(hasDurationDiscrepancy(net, net + DURATION_TOLERANCE_SECONDS)).toBe(false);
  });

  it("is true when task total exceeds net + tolerance", () => {
    const net = 8 * 3600;
    expect(hasDurationDiscrepancy(net, net + DURATION_TOLERANCE_SECONDS + 1)).toBe(true);
  });

  it("matches the spec example: net 7h45m vs tasks 8h15m", () => {
    expect(hasDurationDiscrepancy(7 * 3600 + 45 * 60, 8 * 3600 + 15 * 60)).toBe(true);
  });
});

describe("deriveWorkDayStatus", () => {
  it("holiday wins regardless of check-in/out", () => {
    expect(
      deriveWorkDayStatus({ checkIn: new Date(), checkOut: new Date(), isHoliday: true }),
    ).toBe("HOLIDAY");
  });

  it("NOT_STARTED with no check-in", () => {
    expect(deriveWorkDayStatus({ checkIn: null, checkOut: null, isHoliday: false })).toBe(
      "NOT_STARTED",
    );
  });

  it("IN_PROGRESS with check-in but no check-out", () => {
    expect(deriveWorkDayStatus({ checkIn: new Date(), checkOut: null, isHoliday: false })).toBe(
      "IN_PROGRESS",
    );
  });

  it("COMPLETED with both check-in and check-out", () => {
    expect(
      deriveWorkDayStatus({ checkIn: new Date(), checkOut: new Date(), isHoliday: false }),
    ).toBe("COMPLETED");
  });
});
