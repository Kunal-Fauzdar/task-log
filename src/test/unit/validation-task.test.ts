import { describe, expect, it } from "vitest";

import { taskInputSchema } from "@/lib/validation/task";

const base = { taskId: "T-1039", description: "Do the thing", duration: "1:30:00" };

describe("taskInputSchema", () => {
  it("accepts valid input and transforms duration to seconds", () => {
    const result = taskInputSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.duration).toBe(5400);
    }
  });

  it("rejects an invalid Task ID", () => {
    const result = taskInputSchema.safeParse({ ...base, taskId: "not-valid-id-format" });
    expect(result.success).toBe(false);
  });

  it("accepts an omitted Task ID (optional)", () => {
    const { taskId: _omit, ...withoutTaskId } = base;
    void _omit;
    const result = taskInputSchema.safeParse(withoutTaskId);
    expect(result.success).toBe(true);
  });

  it("accepts an empty Task ID (optional)", () => {
    const result = taskInputSchema.safeParse({ ...base, taskId: "" });
    expect(result.success).toBe(true);
  });

  it("rejects an empty description", () => {
    const result = taskInputSchema.safeParse({ ...base, description: "  " });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed duration", () => {
    const result = taskInputSchema.safeParse({ ...base, duration: "an hour" });
    expect(result.success).toBe(false);
  });

  it("accepts an empty link (optional field)", () => {
    const result = taskInputSchema.safeParse({ ...base, link: "" });
    expect(result.success).toBe(true);
  });

  it("accepts a valid https link", () => {
    const result = taskInputSchema.safeParse({ ...base, link: "https://example.com/page" });
    expect(result.success).toBe(true);
  });

  it("rejects a javascript: URL", () => {
    const result = taskInputSchema.safeParse({ ...base, link: "javascript:alert(1)" });
    expect(result.success).toBe(false);
  });

  it("rejects a non-http(s) scheme like ftp", () => {
    const result = taskInputSchema.safeParse({ ...base, link: "ftp://example.com/file" });
    expect(result.success).toBe(false);
  });

  it("accepts an omitted projectId (optional)", () => {
    expect(taskInputSchema.safeParse(base).success).toBe(true);
  });

  it("accepts an empty projectId (the '— No project —' option)", () => {
    expect(taskInputSchema.safeParse({ ...base, projectId: "" }).success).toBe(true);
  });

  it("accepts a projectId string", () => {
    const result = taskInputSchema.safeParse({ ...base, projectId: "clv1abc2300000xyz" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.projectId).toBe("clv1abc2300000xyz");
  });
});
