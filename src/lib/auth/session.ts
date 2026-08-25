import { createHmac, timingSafeEqual } from "node:crypto";

// Single-user app, no session table (CLAUDE.md §3: "no userId foreign keys... auth gates the
// whole app, not per-user rows") — a session is just a signed, stateless token: "<payload>.
// <hmac>", verified with SESSION_SECRET. No next-auth/iron-session dependency; this app has
// exactly one credential and no OAuth/multi-provider need, so a minimal HMAC cookie is
// proportionate (see CLAUDE.md's "no state-management library added by default" precedent).
export const SESSION_COOKIE_NAME = "worklog_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createSessionToken(): string {
  const payload = Buffer.from(JSON.stringify({ iat: Date.now() })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

// Fails closed on any malformed input, missing SESSION_SECRET, tampered signature, or expiry —
// every branch returns false rather than throwing, since this runs on every request in
// src/proxy.ts and a thrown error there must not accidentally fall through to "authenticated".
export function isValidSessionToken(token: string | undefined | null): boolean {
  if (!token) return false;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  let expectedSignature: string;
  try {
    expectedSignature = sign(payload);
  } catch {
    return false;
  }

  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return false;
  }

  try {
    const decoded: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const iat = (decoded as { iat?: unknown }).iat;
    return typeof iat === "number" && Date.now() - iat < SESSION_MAX_AGE_MS && Date.now() >= iat;
  } catch {
    return false;
  }
}
