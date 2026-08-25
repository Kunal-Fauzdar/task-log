import { describe, expect, it } from "vitest";

import { formatSecondsToDuration, parseDurationToSeconds } from "@/lib/domain/duration";

describe("parseDurationToSeconds", () => {
  it("parses H:MM:SS", () => {
    expect(parseDurationToSeconds("4:00:00")).toBe(4 * 3600);
    expect(parseDurationToSeconds("0:30:00")).toBe(30 * 60);
    expect(parseDurationToSeconds("1:30:00")).toBe(3600 + 30 * 60);
    expect(parseDurationToSeconds("0:00:01")).toBe(1);
  });

  it("allows multi-digit hours", () => {
    expect(parseDurationToSeconds("12:34:56")).toBe(12 * 3600 + 34 * 60 + 56);
  });

  it("tolerates surrounding whitespace", () => {
    expect(parseDurationToSeconds("  4:00:00  ")).toBe(4 * 3600);
  });

  it("rejects malformed input", () => {
    expect(() => parseDurationToSeconds("4:00")).toThrow(RangeError);
    expect(() => parseDurationToSeconds("4:60:00")).toThrow(RangeError);
    expect(() => parseDurationToSeconds("4:00:60")).toThrow(RangeError);
    expect(() => parseDurationToSeconds("not a duration")).toThrow(RangeError);
    expect(() => parseDurationToSeconds("-1:00:00")).toThrow(RangeError);
  });
});

describe("formatSecondsToDuration", () => {
  it("formats without a leading zero on hours", () => {
    expect(formatSecondsToDuration(4 * 3600)).toBe("4:00:00");
    expect(formatSecondsToDuration(30 * 60)).toBe("0:30:00");
  });

  it("zero-pads minutes and seconds", () => {
    expect(formatSecondsToDuration(3661)).toBe("1:01:01");
  });

  it("rejects negative or non-integer input", () => {
    expect(() => formatSecondsToDuration(-1)).toThrow(RangeError);
    expect(() => formatSecondsToDuration(1.5)).toThrow(RangeError);
  });

  it("round-trips through parseDurationToSeconds", () => {
    const values = ["4:00:00", "0:30:00", "12:34:56", "0:00:00"];
    for (const value of values) {
      expect(formatSecondsToDuration(parseDurationToSeconds(value))).toBe(value);
    }
  });
});
