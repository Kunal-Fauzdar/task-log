import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSessionToken, isValidSessionToken } from "@/lib/auth/session";

describe("session tokens", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", "test-secret-do-not-use-in-real-env");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("a freshly created token is valid", () => {
    expect(isValidSessionToken(createSessionToken())).toBe(true);
  });

  it("rejects a missing token", () => {
    expect(isValidSessionToken(undefined)).toBe(false);
    expect(isValidSessionToken(null)).toBe(false);
    expect(isValidSessionToken("")).toBe(false);
  });

  it("rejects a malformed token", () => {
    expect(isValidSessionToken("not-a-real-token")).toBe(false);
    expect(isValidSessionToken("only-one-part")).toBe(false);
  });

  it("rejects a token whose signature was tampered with", () => {
    const token = createSessionToken();
    const [payload] = token.split(".");
    expect(isValidSessionToken(`${payload}.tamperedSignatureValue`)).toBe(false);
  });

  it("rejects a token whose payload was tampered with", () => {
    const token = createSessionToken();
    const [, signature] = token.split(".");
    const forgedPayload = Buffer.from(JSON.stringify({ iat: Date.now() + 999999 })).toString(
      "base64url",
    );
    expect(isValidSessionToken(`${forgedPayload}.${signature}`)).toBe(false);
  });

  it("rejects a token signed with a different secret", () => {
    const token = createSessionToken();
    vi.stubEnv("SESSION_SECRET", "a-different-secret");
    expect(isValidSessionToken(token)).toBe(false);
  });

  it("rejects an expired token", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = createSessionToken();

    vi.setSystemTime(new Date("2026-02-15T00:00:00Z")); // 45 days later — past the 30-day max age
    expect(isValidSessionToken(token)).toBe(false);
  });

  it("stays valid just under the 30-day max age", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = createSessionToken();

    vi.setSystemTime(new Date("2026-01-29T00:00:00Z")); // 28 days later
    expect(isValidSessionToken(token)).toBe(true);
  });

  it("fails closed when SESSION_SECRET is unset", () => {
    const token = createSessionToken();
    // vi.unstubAllEnvs() would revert to whatever real process.env.SESSION_SECRET already is
    // (e.g. loaded from the real .env by a `dotenv/config` import elsewhere in this worker) —
    // deleting outright is the only way to deterministically test "unset" regardless of test
    // execution order.
    const original = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    try {
      expect(isValidSessionToken(token)).toBe(false);
    } finally {
      if (original !== undefined) process.env.SESSION_SECRET = original;
    }
  });
});
