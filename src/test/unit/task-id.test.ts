import { describe, expect, it } from "vitest";

import { isValidTaskId } from "@/lib/domain/task";

describe("isValidTaskId", () => {
  it("accepts letters-dash-digits", () => {
    expect(isValidTaskId("T-1039")).toBe(true);
    expect(isValidTaskId("T-1219")).toBe(true);
    expect(isValidTaskId("BUG-42")).toBe(true);
  });

  it("rejects missing dash, missing digits, or empty string", () => {
    expect(isValidTaskId("T1039")).toBe(false);
    expect(isValidTaskId("T-")).toBe(false);
    expect(isValidTaskId("-1039")).toBe(false);
    expect(isValidTaskId("")).toBe(false);
  });

  it("rejects lowercase-only special characters or spaces", () => {
    expect(isValidTaskId("T 1039")).toBe(false);
    expect(isValidTaskId("T_1039")).toBe(false);
  });
});
