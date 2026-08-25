import { describe, expect, it } from "vitest";

import { exportQuerySchema } from "@/lib/validation/export";

describe("exportQuerySchema", () => {
  it("accepts a valid day query", () => {
    expect(exportQuerySchema.safeParse({ type: "day", date: "2026-08-24" }).success).toBe(true);
  });

  it("accepts a valid month query", () => {
    expect(exportQuerySchema.safeParse({ type: "month", month: "2026-08" }).success).toBe(true);
  });

  it("accepts a valid range query", () => {
    expect(
      exportQuerySchema.safeParse({ type: "range", from: "2026-08-01", to: "2026-08-31" })
        .success,
    ).toBe(true);
  });

  it("rejects a range where `to` is before `from`", () => {
    expect(
      exportQuerySchema.safeParse({ type: "range", from: "2026-08-31", to: "2026-08-01" })
        .success,
    ).toBe(false);
  });

  it("accepts a range where `to` equals `from`", () => {
    expect(
      exportQuerySchema.safeParse({ type: "range", from: "2026-08-01", to: "2026-08-01" })
        .success,
    ).toBe(true);
  });

  it("rejects a malformed date", () => {
    expect(exportQuerySchema.safeParse({ type: "day", date: "08/24/2026" }).success).toBe(false);
  });

  it("rejects an unknown type", () => {
    expect(exportQuerySchema.safeParse({ type: "year", date: "2026" }).success).toBe(false);
  });

  it("rejects a range missing `to`", () => {
    expect(exportQuerySchema.safeParse({ type: "range", from: "2026-08-01" }).success).toBe(
      false,
    );
  });
});
