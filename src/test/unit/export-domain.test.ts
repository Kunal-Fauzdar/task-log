import { describe, expect, it } from "vitest";

import { parseDateOnly, parseMonthOnly } from "@/lib/domain/date";
import { getExportFilename } from "@/lib/domain/export";

describe("formatDateUS (via export filenames' underlying use)", () => {
  it("is exercised through getExportFilename for day exports", () => {
    expect(getExportFilename("day", { date: parseDateOnly("2026-08-03") })).toBe(
      "WorkLog_2026-08-03.xlsx",
    );
  });
});

describe("getExportFilename", () => {
  it("day: WorkLog_YYYY-MM-DD.xlsx", () => {
    expect(getExportFilename("day", { date: parseDateOnly("2026-08-03") })).toBe(
      "WorkLog_2026-08-03.xlsx",
    );
  });

  it("month: WorkLog_Month_YYYY.xlsx", () => {
    expect(getExportFilename("month", { month: parseMonthOnly("2026-08") })).toBe(
      "WorkLog_August_2026.xlsx",
    );
  });

  it("range: WorkLog_YYYY-MM-DD_to_YYYY-MM-DD.xlsx", () => {
    expect(
      getExportFilename("range", {
        from: parseDateOnly("2026-08-01"),
        to: parseDateOnly("2026-08-31"),
      }),
    ).toBe("WorkLog_2026-08-01_to_2026-08-31.xlsx");
  });

  it("throws on mismatched kind/params", () => {
    expect(() =>
      getExportFilename("day", { from: parseDateOnly("2026-08-01"), to: parseDateOnly("2026-08-02") }),
    ).toThrow(RangeError);
  });

  it("appends a slugified project name when the export is filtered to one project", () => {
    expect(
      getExportFilename("month", { month: parseMonthOnly("2026-08") }, "Website Redesign"),
    ).toBe("WorkLog_August_2026_Website-Redesign.xlsx");
  });

  it("omits the suffix when no project name is given", () => {
    expect(getExportFilename("day", { date: parseDateOnly("2026-08-03") }, undefined)).toBe(
      "WorkLog_2026-08-03.xlsx",
    );
  });
});
