import { describe, expect, it } from "vitest";

import {
  elapsedWorkSeconds,
  getMonthRange,
  getRollingRange,
  getWeekRange,
  sumNetWorkSeconds,
} from "@/lib/domain/workday";
import { parseDateOnly } from "@/lib/domain/date";

describe("getWeekRange", () => {
  it("returns Sunday-Saturday containing the date", () => {
    // 2026-08-24 is a Monday.
    const { from, to } = getWeekRange(parseDateOnly("2026-08-24"));
    expect(from.getUTCDay()).toBe(0);
    expect(to.getUTCDay()).toBe(6);
    expect(from.toISOString().slice(0, 10)).toBe("2026-08-23");
    expect(to.toISOString().slice(0, 10)).toBe("2026-08-29");
  });

  it("handles a date that is itself a Sunday", () => {
    const { from, to } = getWeekRange(parseDateOnly("2026-08-23"));
    expect(from.toISOString().slice(0, 10)).toBe("2026-08-23");
    expect(to.toISOString().slice(0, 10)).toBe("2026-08-29");
  });

  it("handles a week crossing a month boundary", () => {
    // 2026-09-01 is a Tuesday; that week starts in August.
    const { from, to } = getWeekRange(parseDateOnly("2026-09-01"));
    expect(from.toISOString().slice(0, 10)).toBe("2026-08-30");
    expect(to.toISOString().slice(0, 10)).toBe("2026-09-05");
  });
});

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
