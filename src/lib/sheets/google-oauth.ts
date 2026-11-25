import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// "Connect Google account" — standard OAuth 2.0 authorization-code flow (web server app).
// The user consents once; we keep their refresh token (encrypted) and mint short-lived access
// tokens from it to write their sheet as them. Hand-rolled like google-client.ts (no googleapis).

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const SCOPES = ["openid", "email", SHEETS_SCOPE];

export const OAUTH_STATE_COOKIE = "worklog_google_oauth";
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

export class GoogleAuthError extends Error {
  constructor(
    message: string,
    // true = the stored refresh token is dead (revoked/expired) and the user must reconnect.
    readonly revoked = false,
  ) {
    super(message);
    this.name = "GoogleAuthError";
  }
}

function getClient(): { id: string; secret: string } | null {
  const id = process.env.GOOGLE_OAUTH_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim();
  return id && secret ? { id, secret } : null;
}

export function isGoogleOAuthConfigured(): boolean {
  return getClient() !== null;
}

function requireClient() {
  const client = getClient();
  if (!client) throw new GoogleAuthError("Google sign-in is not configured on the server.");
  return client;
}

export function callbackUrl(origin: string): string {
  return `${origin}/api/google/callback`;
}

// --- state: binds the callback to (a) the logged-in user and (b) this browser (nonce cookie) ---

function signState(payload: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return createHmac("sha256", secret).update(`google-oauth-state:${payload}`).digest("base64url");
}

export function createOAuthState(userId: string): { state: string; nonce: string } {
  const nonce = randomBytes(16).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ uid: userId, nonce, iat: Date.now() })).toString("base64url");
  return { state: `${payload}.${signState(payload)}`, nonce };
}

export function verifyOAuthState(state: string, userId: string, nonceCookie: string | undefined): boolean {
  const [payload, signature] = state.split(".");
  if (!payload || !signature || !nonceCookie) return false;
  const expected = Buffer.from(signState(payload));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return false;
  try {
    const { uid, nonce, iat } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return uid === userId && nonce === nonceCookie && typeof iat === "number" && Date.now() - iat < STATE_MAX_AGE_MS;
  } catch {
    return false;
  }
}

// --- flow ---

export function buildAuthUrl(state: string, redirectUri: string, loginHint?: string): string {
  const params = new URLSearchParams({
    client_id: requireClient().id,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline", // → refresh token
    prompt: "consent", // always re-issue a refresh token, even on reconnect
    include_granted_scopes: "true",
    state,
  });
  if (loginHint) params.set("login_hint", loginHint);
  return `${AUTH_URL}?${params}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
  id_token?: string;
  error?: string;
};

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const client = requireClient();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: client.id, client_secret: client.secret, ...body }),
  });
  const json = (await response.json()) as TokenResponse;
  if (!response.ok) {
    if (json.error === "invalid_grant") {
      throw new GoogleAuthError("Google access was revoked or expired — reconnect your Google account in Settings.", true);
    }
    throw new GoogleAuthError("Couldn't talk to Google sign-in. Please try again.");
  }
  return json;
}

// The id_token arrives directly from Google's token endpoint over TLS, so reading its payload
// without verifying the signature is fine here (it's not coming from the browser).
function emailFromIdToken(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1], "base64url").toString("utf8"));
    return typeof payload.email === "string" ? payload.email : null;
  } catch {
    return null;
  }
}

export async function exchangeCode(
  code: string,
  redirectUri: string,
): Promise<{ refreshToken: string; email: string | null }> {
  const tokens = await postToken({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
  // Granular consent lets the user untick the Sheets permission — catch that here, not on the
  // first failed sync.
  if (!tokens.scope?.split(" ").includes(SHEETS_SCOPE)) {
    throw new GoogleAuthError("Please allow access to Google Sheets — it's needed to update your sheet.");
  }
  if (!tokens.refresh_token) {
    throw new GoogleAuthError("Google didn't return long-term access. Please try connecting again.");
  }
  return { refreshToken: tokens.refresh_token, email: emailFromIdToken(tokens.id_token) };
}

export async function refreshAccessToken(refreshToken: string): Promise<{ token: string; expiresAt: number }> {
  const tokens = await postToken({ grant_type: "refresh_token", refresh_token: refreshToken });
  return { token: tokens.access_token, expiresAt: Date.now() + tokens.expires_in * 1000 };
}

// Best effort — disconnecting locally must succeed even if Google is unreachable.
export async function revokeToken(token: string): Promise<void> {
  await fetch(REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  }).catch(() => {});
}
