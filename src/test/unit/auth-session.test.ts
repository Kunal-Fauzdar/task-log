import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createSessionToken, isValidSessionToken, readSessionToken } from "@/lib/auth/session";

const UID = "usr_test_0000000000000000";

describe("session tokens", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", "test-secret-do-not-use-in-real-env");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
  });

  it("a freshly created token is valid and round-trips the user id", () => {
    const token = createSessionToken(UID);
    expect(isValidSessionToken(token)).toBe(true);
    expect(readSessionToken(token)?.uid).toBe(UID);
  });

  it("rejects a missing token", () => {
    expect(isValidSessionToken(undefined)).toBe(false);
    expect(isValidSessionToken(null)).toBe(false);
    expect(isValidSessionToken("")).toBe(false);
    expect(readSessionToken(undefined)).toBeNull();
  });

  it("rejects a malformed token", () => {
    expect(isValidSessionToken("not-a-real-token")).toBe(false);
    expect(isValidSessionToken("only-one-part")).toBe(false);
  });

  it("rejects a token whose signature was tampered with", () => {
    const token = createSessionToken(UID);
    const [payload] = token.split(".");
    expect(isValidSessionToken(`${payload}.tamperedSignatureValue`)).toBe(false);
  });

  it("rejects a token whose payload was tampered with", () => {
    const token = createSessionToken(UID);
    const [, signature] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({ uid: "attacker", iat: Date.now() }),
    ).toString("base64url");
    expect(isValidSessionToken(`${forgedPayload}.${signature}`)).toBe(false);
  });

  it("rejects a token that carries no uid", () => {
    // Hand-sign a payload with the test secret but no `uid` (the shape old single-user tokens
    // had) — it must not be accepted now.
    const token = createSessionToken(UID);
    const [, signature] = token.split(".");
    const noUid = Buffer.from(JSON.stringify({ iat: Date.now() })).toString("base64url");
    expect(isValidSessionToken(`${noUid}.${signature}`)).toBe(false);
  });

  it("rejects a token signed with a different secret", () => {
    const token = createSessionToken(UID);
    vi.stubEnv("SESSION_SECRET", "a-different-secret");
    expect(isValidSessionToken(token)).toBe(false);
  });

  it("rejects an expired token", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = createSessionToken(UID);

    vi.setSystemTime(new Date("2026-02-15T00:00:00Z")); // 45 days later — past the 30-day max age
    expect(isValidSessionToken(token)).toBe(false);
  });

  it("stays valid just under the 30-day max age", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = createSessionToken(UID);

    vi.setSystemTime(new Date("2026-01-29T00:00:00Z")); // 28 days later
    expect(isValidSessionToken(token)).toBe(true);
  });

  it("fails closed when SESSION_SECRET is unset", () => {
    const token = createSessionToken(UID);
    const original = process.env.SESSION_SECRET;
    delete process.env.SESSION_SECRET;
    try {
      expect(isValidSessionToken(token)).toBe(false);
    } finally {
      if (original !== undefined) process.env.SESSION_SECRET = original;
    }
  });
});
