import { describe, expect, it } from "vitest";

import { getMonthRange, getWeekRange, sumNetWorkSeconds } from "@/lib/domain/workday";
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
