import { describe, expect, it } from "vitest";

import {
  elapsedWorkSeconds,
  getMonthRange,
  getRollingRange,
  projectedCheckOutTime,
  sumNetWorkSeconds,
} from "@/lib/domain/workday";
import { formatClockTime, parseDateOnly } from "@/lib/domain/date";

describe("getMonthRange", () => {
  it("returns the 1st to the last day of the month", () => {
    const { from, to } = getMonthRange(parseDateOnly("2026-08-24"));
    expect(from.toISOString().slice(0, 10)).toBe("2026-08-01");
    expect(to.toISOString().slice(0, 10)).toBe("2026-08-31");
  });

  it("handles February in a leap year", () => {
    const { to } = getMonthRange(parseDateOnly("2028-02-10"));
    expect(to.toISOString().slice(0, 10)).toBe("2028-02-29");
  });

  it("handles December correctly (year rollover)", () => {
    const { from, to } = getMonthRange(parseDateOnly("2026-12-15"));
    expect(from.toISOString().slice(0, 10)).toBe("2026-12-01");
    expect(to.toISOString().slice(0, 10)).toBe("2026-12-31");
  });
});

describe("getRollingRange", () => {
  it("returns the last N days ending on (and including) the date", () => {
    const { from, to } = getRollingRange(parseDateOnly("2026-09-01"), 7);
    expect(from.toISOString().slice(0, 10)).toBe("2026-08-26");
    expect(to.toISOString().slice(0, 10)).toBe("2026-09-01");
  });

  it("days=1 is just the date itself", () => {
    const { from, to } = getRollingRange(parseDateOnly("2026-09-01"), 1);
    expect(from.toISOString().slice(0, 10)).toBe("2026-09-01");
    expect(to.toISOString().slice(0, 10)).toBe("2026-09-01");
  });

  it("spans a month boundary for a 30-day window early in a month", () => {
    const { from } = getRollingRange(parseDateOnly("2026-09-01"), 30);
    expect(from.toISOString().slice(0, 10)).toBe("2026-08-03");
  });
});

describe("elapsedWorkSeconds", () => {
  it("returns net work duration for a completed day", () => {
    const checkIn = new Date(Date.UTC(2026, 8, 1, 9, 0, 0));
    const checkOut = new Date(Date.UTC(2026, 8, 1, 17, 30, 0));
    expect(elapsedWorkSeconds({ checkIn, checkOut, breakSeconds: 1800 }, new Date())).toBe(
      8 * 3600 + 30 * 60 - 1800,
    );
  });

  it("counts check-in → now (minus break) for an in-progress day", () => {
    const checkIn = new Date(Date.UTC(2026, 8, 1, 9, 0, 0));
    const now = new Date(Date.UTC(2026, 8, 1, 12, 0, 0));
    expect(elapsedWorkSeconds({ checkIn, checkOut: null, breakSeconds: 600 }, now)).toBe(
      3 * 3600 - 600,
    );
  });

  it("is 0 when never checked in", () => {
    expect(elapsedWorkSeconds({ checkIn: null, checkOut: null, breakSeconds: 0 }, new Date())).toBe(0);
  });

  it("never goes negative", () => {
    const checkIn = new Date(Date.UTC(2026, 8, 1, 9, 0, 0));
    const now = new Date(Date.UTC(2026, 8, 1, 9, 5, 0));
    expect(
      elapsedWorkSeconds({ checkIn, checkOut: null, breakSeconds: 99999 }, now),
    ).toBe(0);
  });
});

describe("sumNetWorkSeconds", () => {
  it("sums complete days and treats incomplete days as 0", () => {
    const complete = {
      checkIn: parseDateOnly("2026-08-24"),
      checkOut: new Date(parseDateOnly("2026-08-24").getTime() + 8 * 3600 * 1000),
      breakSeconds: 0,
    };
    const incomplete = { checkIn: parseDateOnly("2026-08-25"), checkOut: null, breakSeconds: 0 };
    const untouched = { checkIn: null, checkOut: null, breakSeconds: 0 };

    expect(sumNetWorkSeconds([complete, incomplete, untouched])).toBe(8 * 3600);
  });

  it("returns 0 for an empty list", () => {
    expect(sumNetWorkSeconds([])).toBe(0);
  });
});

describe("projectedCheckOutTime", () => {
  it("adds task duration and break time onto check-in", () => {
    // Check in 9:00 AM, 6h of tasks, 30m break -> 3:30 PM.
    const checkIn = new Date(Date.UTC(2026, 7, 24, 9, 0, 0));
    const result = projectedCheckOutTime({ checkIn, breakSeconds: 30 * 60 }, 6 * 3600);
    expect(result).not.toBeNull();
    expect(formatClockTime(result as Date)).toBe("3:30 PM");
  });

  it("returns null when there is no check-in", () => {
    expect(projectedCheckOutTime({ checkIn: null, breakSeconds: 0 }, 3600)).toBeNull();
  });

  it("equals check-in itself when there are no tasks and no break", () => {
    const checkIn = new Date(Date.UTC(2026, 7, 24, 10, 15, 0));
    const result = projectedCheckOutTime({ checkIn, breakSeconds: 0 }, 0);
    expect((result as Date).getTime()).toBe(checkIn.getTime());
  });
});
