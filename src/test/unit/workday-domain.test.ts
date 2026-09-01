import { describe, expect, it } from "vitest";

import {
  DURATION_TOLERANCE_SECONDS,
  calculateNetWorkSeconds,
  calculateTotalTaskSeconds,
  deriveWorkDayStatus,
  fillMissingExportDays,
  isWeeklyOffExportDay,
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
      deriveWorkDayStatus({ checkIn: new Date(), checkOut: new Date(), dayType: "HOLIDAY" }),
    ).toBe("HOLIDAY");
  });

  it("leave wins regardless of check-in/out", () => {
    expect(
      deriveWorkDayStatus({ checkIn: new Date(), checkOut: new Date(), dayType: "LEAVE" }),
    ).toBe("LEAVE");
  });

  it("NOT_STARTED with no check-in", () => {
    expect(deriveWorkDayStatus({ checkIn: null, checkOut: null, dayType: "WORKING" })).toBe(
      "NOT_STARTED",
    );
  });

  it("IN_PROGRESS with check-in but no check-out", () => {
    expect(deriveWorkDayStatus({ checkIn: new Date(), checkOut: null, dayType: "WORKING" })).toBe(
      "IN_PROGRESS",
    );
  });

  it("COMPLETED with both check-in and check-out", () => {
    expect(
      deriveWorkDayStatus({ checkIn: new Date(), checkOut: new Date(), dayType: "WORKING" }),
    ).toBe("COMPLETED");
  });
});

describe("fillMissingExportDays", () => {
  it("fills every calendar day in range with no real WorkDay yet — weekends included", () => {
    // 2026-08-01 Sat .. 08-07 Fri
    const range = { from: parseDateOnly("2026-08-01"), to: parseDateOnly("2026-08-07") };
    const existing = [{ date: parseDateOnly("2026-08-04") }]; // already logged Tuesday
    const today = parseDateOnly("2026-08-10"); // whole range is in the past

    const filled = fillMissingExportDays(existing, range, today);
    const dates = filled.map((w) => w.date.toISOString().slice(0, 10)).sort();

    // Every day appears once; 08-04 is the real entry, not duplicated.
    expect(dates).toEqual([
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
      "2026-08-06",
      "2026-08-07",
    ]);
  });

  it("does not fill a day past today — nothing to log yet", () => {
    const range = { from: parseDateOnly("2026-08-01"), to: parseDateOnly("2026-08-07") };
    const today = parseDateOnly("2026-08-05");

    const filled = fillMissingExportDays([], range, today);
    const dates = filled.map((w) => w.date.toISOString().slice(0, 10)).sort();

    expect(dates).toEqual([
      "2026-08-01",
      "2026-08-02",
      "2026-08-03",
      "2026-08-04",
      "2026-08-05",
    ]);
  });

  it("blank filled entries carry dayType WORKING and no note", () => {
    const range = { from: parseDateOnly("2026-08-03"), to: parseDateOnly("2026-08-03") };
    const [filled] = fillMissingExportDays([], range, parseDateOnly("2026-08-03"));

    expect(filled).toMatchObject({
      checkIn: null,
      checkOut: null,
      breakSeconds: 0,
      dayType: "WORKING",
      dayNote: null,
      tasks: [],
    });
  });

  it("leaves a real WorkDay untouched (not re-filled)", () => {
    const range = { from: parseDateOnly("2026-08-01"), to: parseDateOnly("2026-08-01") };
    const existing = [{ date: parseDateOnly("2026-08-01") }];

    const filled = fillMissingExportDays(existing, range, parseDateOnly("2026-08-01"));
    expect(filled).toEqual(existing);
  });
});

describe("isWeeklyOffExportDay", () => {
  const MON_FRI = [1, 2, 3, 4, 5];
  const emptyDay = { checkIn: null, dayType: "WORKING" as const, tasks: [] as unknown[] };

  it("is true for an empty non-working day (weekend)", () => {
    expect(isWeeklyOffExportDay(emptyDay, MON_FRI, parseDateOnly("2026-08-01"))).toBe(true); // Sat
  });

  it("is false for a working day", () => {
    expect(isWeeklyOffExportDay(emptyDay, MON_FRI, parseDateOnly("2026-08-03"))).toBe(false); // Mon
  });

  it("is false when the weekend day has work logged", () => {
    expect(
      isWeeklyOffExportDay(
        { checkIn: new Date(), dayType: "WORKING", tasks: [] },
        MON_FRI,
        parseDateOnly("2026-08-01"),
      ),
    ).toBe(false);
  });

  it("is false for a declared holiday/leave (those render with their own label)", () => {
    expect(
      isWeeklyOffExportDay({ checkIn: null, dayType: "HOLIDAY", tasks: [] }, MON_FRI, parseDateOnly("2026-08-01")),
    ).toBe(false);
  });

  it("respects a custom working-days set (Sun-Thu makes Friday the weekly off)", () => {
    const sunThu = [0, 1, 2, 3, 4];
    expect(isWeeklyOffExportDay(emptyDay, sunThu, parseDateOnly("2026-08-07"))).toBe(true); // Fri
    expect(isWeeklyOffExportDay(emptyDay, sunThu, parseDateOnly("2026-08-02"))).toBe(false); // Sun
  });
});
