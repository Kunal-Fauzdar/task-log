import { describe, expect, it } from "vitest";

import { changePasswordSchema, loginSchema, registerSchema } from "@/lib/validation/auth";

describe("registerSchema", () => {
  const base = {
    email: "Kavya@Example.com ",
    name: "  Kavya  ",
    password: "longenough1",
    confirmPassword: "longenough1",
  };

  it("normalises email (trim + lowercase) and trims name", () => {
    const result = registerSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("kavya@example.com");
      expect(result.data.name).toBe("Kavya");
    }
  });

  it("rejects an invalid email", () => {
    expect(registerSchema.safeParse({ ...base, email: "not-an-email" }).success).toBe(false);
  });

  it("rejects a password under 8 characters", () => {
    const result = registerSchema.safeParse({ ...base, password: "short", confirmPassword: "short" });
    expect(result.success).toBe(false);
  });

  it("rejects when confirmPassword does not match", () => {
    const result = registerSchema.safeParse({ ...base, confirmPassword: "different1" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toBeTruthy();
    }
  });

  it("rejects an empty name", () => {
    expect(registerSchema.safeParse({ ...base, name: "   " }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("accepts an email + any non-empty password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "x" }).success).toBe(true);
  });
  it("rejects a blank password", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("requires the new password and its confirmation to match", () => {
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "old",
        newPassword: "brandnew1",
        confirmPassword: "brandnew1",
      }).success,
    ).toBe(true);
    expect(
      changePasswordSchema.safeParse({
        currentPassword: "old",
        newPassword: "brandnew1",
        confirmPassword: "mismatch1",
      }).success,
    ).toBe(false);
  });
});
