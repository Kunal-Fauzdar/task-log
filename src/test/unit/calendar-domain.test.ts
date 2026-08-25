import { describe, expect, it } from "vitest";

import { addMonths, formatMonthLabel, getLocalMonth, parseMonthOnly } from "@/lib/domain/date";

describe("parseMonthOnly", () => {
  it("parses YYYY-MM into the 1st of that month", () => {
    const date = parseMonthOnly("2026-08");
    expect(date.getUTCFullYear()).toBe(2026);
    expect(date.getUTCMonth()).toBe(7);
    expect(date.getUTCDate()).toBe(1);
  });

  it("rejects malformed input", () => {
    expect(() => parseMonthOnly("2026-8")).toThrow(RangeError);
    expect(() => parseMonthOnly("not-a-month")).toThrow(RangeError);
  });
});

describe("formatMonthLabel", () => {
  it("formats as 'Month YYYY'", () => {
    expect(formatMonthLabel(parseMonthOnly("2026-08"))).toBe("August 2026");
  });
});

describe("addMonths", () => {
  it("adds months, staying on the 1st", () => {
    expect(formatMonthLabel(addMonths(parseMonthOnly("2026-08"), 1))).toBe("September 2026");
  });

  it("subtracts months across a year boundary", () => {
    expect(formatMonthLabel(addMonths(parseMonthOnly("2026-01"), -1))).toBe("December 2025");
  });

  it("adds across a year boundary", () => {
    expect(formatMonthLabel(addMonths(parseMonthOnly("2026-12"), 1))).toBe("January 2027");
  });
});

describe("getLocalMonth", () => {
  it("formats using local (not UTC) calendar fields", () => {
    const date = new Date(2026, 0, 5); // Jan 5 2026, local time
    expect(getLocalMonth(date)).toBe("2026-01");
  });
});
