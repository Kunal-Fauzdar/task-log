import { createHmac, timingSafeEqual } from "node:crypto";

// A session is a signed, stateless token: "<payload>.<hmac>", verified with SESSION_SECRET.
// No next-auth/iron-session dependency and no server-side session store — rotating
// SESSION_SECRET is the only way to force-invalidate every session at once. The payload carries
// the user id (`uid`) so the app can load the current user without a session table.
export const SESSION_COOKIE_NAME = "worklog_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_SECONDS * 1000;

type SessionPayload = { uid: string; iat: number };

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

export function createSessionToken(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ uid: userId, iat: Date.now() })).toString(
    "base64url",
  );
  return `${payload}.${sign(payload)}`;
}

// Verified parse: returns the payload only if the signature matches, it hasn't expired, and it
// carries a real `uid`. Returns null on anything malformed — never throws (runs on every request
// via src/proxy.ts and getCurrentUser).
export function readSessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  let expectedSignature: string;
  try {
    expectedSignature = sign(payload);
  } catch {
    return null;
  }

  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return null;
  }

  try {
    const decoded: unknown = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    const { uid, iat } = decoded as { uid?: unknown; iat?: unknown };
    if (typeof uid !== "string" || uid.length === 0) return null;
    if (typeof iat !== "number" || Date.now() - iat >= SESSION_MAX_AGE_MS || Date.now() < iat) {
      return null;
    }
    return { uid, iat };
  } catch {
    return null;
  }
}

// Signature/expiry/`uid` check with no database lookup — used by the proxy for a fast gate on
// every request. `getCurrentUser` (src/lib/auth/current-user.ts) does the actual user load.
export function isValidSessionToken(token: string | undefined | null): boolean {
  return readSessionToken(token) !== null;
}
