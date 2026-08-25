import { hash } from "bcryptjs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { verifyPassword } from "@/lib/auth/password";

// AUTH_PASSWORD_HASH is base64-encoded, not the raw "$2b$..." string — see the comment in
// src/lib/auth/password.ts for why (Next.js's .env loader mangles "$" characters).
async function encodedHashFor(password: string): Promise<string> {
  const bcryptHash = await hash(password, 4);
  return Buffer.from(bcryptHash, "utf8").toString("base64");
}

describe("verifyPassword", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts the correct password against its own hash", async () => {
    vi.stubEnv("AUTH_PASSWORD_HASH", await encodedHashFor("correct-horse-battery-staple"));
    expect(await verifyPassword("correct-horse-battery-staple")).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    vi.stubEnv("AUTH_PASSWORD_HASH", await encodedHashFor("correct-horse-battery-staple"));
    expect(await verifyPassword("wrong-password")).toBe(false);
  });

  it("fails closed when AUTH_PASSWORD_HASH is unset", async () => {
    const original = process.env.AUTH_PASSWORD_HASH;
    delete process.env.AUTH_PASSWORD_HASH;
    try {
      expect(await verifyPassword("anything")).toBe(false);
    } finally {
      if (original !== undefined) process.env.AUTH_PASSWORD_HASH = original;
    }
  });

  it("fails closed when AUTH_PASSWORD_HASH is not validly-encoded base64 of a bcrypt hash", async () => {
    vi.stubEnv("AUTH_PASSWORD_HASH", Buffer.from("not-a-bcrypt-hash", "utf8").toString("base64"));
    expect(await verifyPassword("anything")).toBe(false);
  });
});
