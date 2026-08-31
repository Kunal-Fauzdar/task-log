import { describe, expect, it } from "vitest";

import {
  DURATION_TOLERANCE_SECONDS,
  calculateNetWorkSeconds,
  calculateTotalTaskSeconds,
  deriveWorkDayStatus,
  fillMissingWorkingDays,
  hasDurationDiscrepancy,
} from "@/lib/domain/workday";
import { parseDateOnly } from "@/lib/domain/date";

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

describe("fillMissingWorkingDays", () => {
  const MON_FRI = [1, 2, 3, 4, 5];

  it("fills every configured working day in range that has no real WorkDay yet", () => {
    // 2026-08-01 Sat, 08-02 Sun, 08-03 Mon, 08-04 Tue, 08-05 Wed, 08-06 Thu, 08-07 Fri
    const range = { from: parseDateOnly("2026-08-01"), to: parseDateOnly("2026-08-07") };
    const existing = [{ date: parseDateOnly("2026-08-04") }]; // already logged Tuesday
    const today = parseDateOnly("2026-08-10"); // whole range is in the past

    const filled = fillMissingWorkingDays(existing, range, MON_FRI, today);
    const dates = filled.map((w) => w.date.toISOString().slice(0, 10)).sort();

    // Weekend days (08-01, 08-02) never appear; 08-04 appears once (the real entry, not
    // duplicated); the three other Mon-Fri days are filled in blank.
    expect(dates).toEqual(["2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06", "2026-08-07"]);
  });

  it("does not fill a working day past today — nothing to log yet", () => {
    const range = { from: parseDateOnly("2026-08-01"), to: parseDateOnly("2026-08-07") };
    const today = parseDateOnly("2026-08-05"); // Wednesday — Thu/Fri haven't happened yet

    const filled = fillMissingWorkingDays([], range, MON_FRI, today);
    const dates = filled.map((w) => w.date.toISOString().slice(0, 10)).sort();

    expect(dates).toEqual(["2026-08-03", "2026-08-04", "2026-08-05"]);
  });

  it("blank filled entries have the same shape a zero-task day already renders as", () => {
    const range = { from: parseDateOnly("2026-08-03"), to: parseDateOnly("2026-08-03") };
    const [filled] = fillMissingWorkingDays([], range, MON_FRI, parseDateOnly("2026-08-03"));

    expect(filled).toMatchObject({
      checkIn: null,
      checkOut: null,
      breakSeconds: 0,
      isHoliday: false,
      holidayReason: null,
      tasks: [],
    });
  });

  it("respects a custom working-days configuration (e.g. Sun-Thu)", () => {
    const range = { from: parseDateOnly("2026-08-01"), to: parseDateOnly("2026-08-07") };
    const sunThu = [0, 1, 2, 3, 4];

    const filled = fillMissingWorkingDays([], range, sunThu, parseDateOnly("2026-08-10"));
    const dates = filled.map((w) => w.date.toISOString().slice(0, 10)).sort();

    expect(dates).toEqual(["2026-08-02", "2026-08-03", "2026-08-04", "2026-08-05", "2026-08-06"]);
  });

  it("leaves a real WorkDay on a non-working day untouched (e.g. worked a Saturday)", () => {
    const range = { from: parseDateOnly("2026-08-01"), to: parseDateOnly("2026-08-01") };
    const existing = [{ date: parseDateOnly("2026-08-01") }]; // Saturday, not in MON_FRI

    const filled = fillMissingWorkingDays(existing, range, MON_FRI, parseDateOnly("2026-08-01"));
    expect(filled).toEqual(existing);
  });
});
