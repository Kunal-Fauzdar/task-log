// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { decryptSecret, encryptSecret } from "@/lib/auth/crypto";
import {
  buildAuthUrl,
  createOAuthState,
  exchangeCode,
  GoogleAuthError,
  refreshAccessToken,
  SHEETS_SCOPE,
  verifyOAuthState,
} from "@/lib/sheets/google-oauth";

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", "test-secret-for-google-oauth");
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_ID", "client-id.apps.googleusercontent.com");
  vi.stubEnv("GOOGLE_OAUTH_CLIENT_SECRET", "client-secret");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("encryptSecret / decryptSecret", () => {
  it("round-trips, with a fresh IV each time", () => {
    const a = encryptSecret("1//refresh-token");
    const b = encryptSecret("1//refresh-token");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("1//refresh-token");
  });

  it("returns null when tampered with or the secret changed", () => {
    const sealed = encryptSecret("token");
    const parts = sealed.split(".");
    parts[2] = Buffer.from("other").toString("base64url");
    expect(decryptSecret(parts.join("."))).toBeNull();

    vi.stubEnv("SESSION_SECRET", "rotated");
    expect(decryptSecret(sealed)).toBeNull();
    expect(decryptSecret("garbage")).toBeNull();
  });
});

describe("OAuth state", () => {
  it("verifies for the same user + browser nonce", () => {
    const { state, nonce } = createOAuthState("user-1");
    expect(verifyOAuthState(state, "user-1", nonce)).toBe(true);
  });

  it("rejects another user, a missing/wrong nonce, tampering, and expiry", () => {
    const { state, nonce } = createOAuthState("user-1");
    expect(verifyOAuthState(state, "user-2", nonce)).toBe(false);
    expect(verifyOAuthState(state, "user-1", undefined)).toBe(false);
    expect(verifyOAuthState(state, "user-1", "nope")).toBe(false);
    expect(verifyOAuthState(`x${state}`, "user-1", nonce)).toBe(false);

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 11 * 60 * 1000);
    expect(verifyOAuthState(state, "user-1", nonce)).toBe(false);
    vi.useRealTimers();
  });
});

describe("buildAuthUrl", () => {
  it("asks for offline Sheets access with our redirect + state", () => {
    const url = new URL(buildAuthUrl("STATE", "http://localhost:3000/api/google/callback", "me@x.com"));
    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("scope")?.split(" ")).toContain(SHEETS_SCOPE);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:3000/api/google/callback");
    expect(url.searchParams.get("state")).toBe("STATE");
    expect(url.searchParams.get("login_hint")).toBe("me@x.com");
  });
});

function mockTokenEndpoint(status: number, body: object) {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(body), { status })));
}

const idToken = (email: string) =>
  `h.${Buffer.from(JSON.stringify({ email })).toString("base64url")}.s`;

describe("exchangeCode", () => {
  it("returns the refresh token and the account email", async () => {
    mockTokenEndpoint(200, {
      access_token: "a",
      expires_in: 3600,
      refresh_token: "r",
      scope: `openid email ${SHEETS_SCOPE}`,
      id_token: idToken("me@gmail.com"),
    });
    await expect(exchangeCode("code", "http://x/cb")).resolves.toEqual({ refreshToken: "r", email: "me@gmail.com" });
  });

  it("rejects when the Sheets permission was unticked", async () => {
    mockTokenEndpoint(200, { access_token: "a", expires_in: 3600, refresh_token: "r", scope: "openid email" });
    await expect(exchangeCode("code", "http://x/cb")).rejects.toThrow(/allow access to Google Sheets/);
  });
});

describe("refreshAccessToken", () => {
  it("flags a revoked refresh token as permanent", async () => {
    mockTokenEndpoint(400, { error: "invalid_grant" });
    const error = await refreshAccessToken("dead").catch((e) => e);
    expect(error).toBeInstanceOf(GoogleAuthError);
    expect(error.revoked).toBe(true);
  });
});
