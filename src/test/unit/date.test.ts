import { describe, expect, it } from "vitest";

import {
  combineDateAndTime,
  formatClockTime,
  formatDateOnly,
  formatDateUS,
  formatDisplayDate,
  formatTimeInputValue,
  getDayName,
  getLocalISODate,
  getNaiveLocalNow,
  isWeekend,
  parseClockTimeToHHMM,
  parseDateOnly,
  parseDateUS,
} from "@/lib/domain/date";

describe("getDayName", () => {
  it("derives the correct day of week from a date", () => {
    // 2026-08-24 is a Monday.
    expect(getDayName(parseDateOnly("2026-08-24"))).toBe("Monday");
    expect(getDayName(parseDateOnly("2026-08-29"))).toBe("Saturday");
    expect(getDayName(parseDateOnly("2026-08-30"))).toBe("Sunday");
  });
});

describe("isWeekend", () => {
  it("flags Saturday and Sunday", () => {
    expect(isWeekend(parseDateOnly("2026-08-29"))).toBe(true);
    expect(isWeekend(parseDateOnly("2026-08-30"))).toBe(true);
  });

  it("does not flag weekdays", () => {
    expect(isWeekend(parseDateOnly("2026-08-24"))).toBe(false);
  });
});

describe("parseDateOnly / formatDateOnly round trip", () => {
  it("round-trips a YYYY-MM-DD string", () => {
    expect(formatDateOnly(parseDateOnly("2026-08-24"))).toBe("2026-08-24");
  });

  it("rejects malformed input", () => {
    expect(() => parseDateOnly("08/24/2026")).toThrow(RangeError);
    expect(() => parseDateOnly("not-a-date")).toThrow(RangeError);
  });
});

describe("formatDisplayDate", () => {
  it("formats a human-readable date including weekday", () => {
    expect(formatDisplayDate(parseDateOnly("2026-08-24"))).toBe("Monday, August 24, 2026");
  });
});

describe("getLocalISODate", () => {
  it("formats using local (not UTC) calendar fields", () => {
    // Construct via local components so this test is timezone-independent.
    const date = new Date(2026, 0, 5); // Jan 5 2026, local time
    expect(getLocalISODate(date)).toBe("2026-01-05");
  });

  it("zero-pads single-digit month and day", () => {
    const date = new Date(2026, 2, 3); // Mar 3 2026
    expect(getLocalISODate(date)).toBe("2026-03-03");
  });
});

describe("getNaiveLocalNow", () => {
  it("encodes the local wall-clock time in the Date's UTC fields", () => {
    const localNow = new Date();
    const naive = getNaiveLocalNow();
    // Allow a small window for the two `new Date()` calls not landing in the exact same second.
    expect(naive.getUTCFullYear()).toBe(localNow.getFullYear());
    expect(naive.getUTCMonth()).toBe(localNow.getMonth());
    expect(naive.getUTCDate()).toBe(localNow.getDate());
    expect(naive.getUTCHours()).toBe(localNow.getHours());
    expect(naive.getUTCMinutes()).toBe(localNow.getMinutes());
  });
});

describe("combineDateAndTime", () => {
  it("combines a date with an HH:MM time", () => {
    const date = parseDateOnly("2026-08-24");
    const combined = combineDateAndTime(date, "10:10");
    expect(combined.getUTCFullYear()).toBe(2026);
    expect(combined.getUTCMonth()).toBe(7);
    expect(combined.getUTCDate()).toBe(24);
    expect(combined.getUTCHours()).toBe(10);
    expect(combined.getUTCMinutes()).toBe(10);
  });

  it("accepts HH:MM:SS too", () => {
    const combined = combineDateAndTime(parseDateOnly("2026-08-24"), "19:25:30");
    expect(combined.getUTCHours()).toBe(19);
    expect(combined.getUTCMinutes()).toBe(25);
    expect(combined.getUTCSeconds()).toBe(30);
  });

  it("rejects malformed time strings", () => {
    expect(() => combineDateAndTime(parseDateOnly("2026-08-24"), "not-a-time")).toThrow(
      RangeError,
    );
  });
});

describe("formatClockTime / formatTimeInputValue", () => {
  it("formats as h:mm AM/PM", () => {
    expect(formatClockTime(combineDateAndTime(parseDateOnly("2026-08-24"), "10:10"))).toBe(
      "10:10 AM",
    );
    expect(formatClockTime(combineDateAndTime(parseDateOnly("2026-08-24"), "19:25"))).toBe(
      "7:25 PM",
    );
  });

  it("formats as HH:MM for time input defaultValue", () => {
    expect(formatTimeInputValue(combineDateAndTime(parseDateOnly("2026-08-24"), "09:05"))).toBe(
      "09:05",
    );
  });
});

describe("parseDateUS — inverse of formatDateUS (Excel Import, spec §30/§41)", () => {
  it("round-trips a formatDateUS string", () => {
    const date = parseDateOnly("2026-08-24");
    expect(formatDateOnly(parseDateUS(formatDateUS(date)))).toBe("2026-08-24");
  });

  it("accepts single-digit month/day", () => {
    expect(formatDateOnly(parseDateUS("3/8/2026"))).toBe("2026-03-08");
  });

  it("rejects malformed input", () => {
    expect(() => parseDateUS("2026-08-24")).toThrow(RangeError);
    expect(() => parseDateUS("not-a-date")).toThrow(RangeError);
  });

  it("rejects a calendar date that doesn't exist", () => {
    expect(() => parseDateUS("02/30/2026")).toThrow(RangeError);
  });
});

describe("parseClockTimeToHHMM — inverse of formatClockTime (Excel Import)", () => {
  it("round-trips AM and PM times", () => {
    expect(parseClockTimeToHHMM("10:10 AM")).toBe("10:10");
    expect(parseClockTimeToHHMM("7:25 PM")).toBe("19:25");
  });

  it("handles the 12 AM / 12 PM boundary", () => {
    expect(parseClockTimeToHHMM("12:00 AM")).toBe("00:00");
    expect(parseClockTimeToHHMM("12:00 PM")).toBe("12:00");
  });

  it("rejects malformed input", () => {
    expect(() => parseClockTimeToHHMM("25:00 AM")).toThrow(RangeError);
    expect(() => parseClockTimeToHHMM("not-a-time")).toThrow(RangeError);
  });
});
