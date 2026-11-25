import { createSign } from "node:crypto";

import { refreshAccessToken } from "@/lib/sheets/google-oauth";

// Minimal Google Sheets REST client. Hand-rolled — an access token, then plain fetch — rather
// than pulling in the multi-megabyte `googleapis` package for three endpoints.
//
// Two ways to authenticate (SheetsAuth):
// - "user": the user's own Google account via "Connect Google account" (OAuth refresh token).
//   Preferred — the app acts as the user, so no sheet sharing is needed.
// - "service": a service account (bot email) the user shares their sheet with. Legacy fallback,
//   used only when the user hasn't connected Google and the server has the bot configured.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const SCOPE = "https://www.googleapis.com/auth/spreadsheets";

export type SheetsAuth =
  | { kind: "user"; userId: string; refreshToken: string }
  | { kind: "service" };

export class SheetsError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "SheetsError";
  }
}

// --- service account ---

type ServiceAccount = { email: string; privateKey: string };

export function getServiceAccountEmail(): string | null {
  return process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim() || null;
}

function getServiceAccount(): ServiceAccount | null {
  const email = getServiceAccountEmail();
  // Env files / Vercel store the PEM on one line with literal "\n" sequences.
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  return email && privateKey ? { email, privateKey } : null;
}

export function isServiceAccountConfigured(): boolean {
  return getServiceAccount() !== null;
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

type CachedToken = { token: string; expiresAt: number };
let serviceToken: CachedToken | null = null;
// Per-user access tokens, keyed by userId + refresh token tail (a reconnect gets a fresh entry).
const userTokens = new Map<string, CachedToken>();

function isFresh(cached: CachedToken | null | undefined): cached is CachedToken {
  return Boolean(cached && cached.expiresAt > Date.now() + 60_000);
}

async function getServiceAccessToken(): Promise<string> {
  if (isFresh(serviceToken)) return serviceToken.token;

  const account = getServiceAccount();
  if (!account) throw new SheetsError("Connect your Google account in Settings to sync your sheet.");

  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({ iss: account.email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }),
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = base64url(signer.sign(account.privateKey));

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  if (!response.ok) {
    throw new SheetsError("Couldn't authenticate with Google — check the service account key.", response.status);
  }
  const body = (await response.json()) as { access_token: string; expires_in: number };
  serviceToken = { token: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return body.access_token;
}

async function getAccessToken(auth: SheetsAuth): Promise<string> {
  if (auth.kind === "service") return getServiceAccessToken();
  const key = `${auth.userId}:${auth.refreshToken.slice(-16)}`;
  const cached = userTokens.get(key);
  if (isFresh(cached)) return cached.token;
  const fresh = await refreshAccessToken(auth.refreshToken);
  userTokens.set(key, fresh);
  return fresh.token;
}

// Translate Google's status codes into something a user can act on from /settings.
function describeFailure(status: number, auth: SheetsAuth): string {
  if (status === 403) {
    return auth.kind === "user"
      ? "Your connected Google account can't edit this sheet. Use a sheet that account owns or can edit."
      : "The sheet isn't shared with the sync account. Connect your Google account instead, or share the sheet as an Editor.";
  }
  if (status === 404) return "Sheet not found — check the link.";
  if (status === 401) return "Google access expired — reconnect your Google account in Settings.";
  return `Google Sheets returned an error (HTTP ${status}).`;
}

async function sheetsFetch<T>(auth: SheetsAuth, path: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken(auth);
  const response = await fetch(`${SHEETS_API}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) throw new SheetsError(describeFailure(response.status, auth), response.status);
  return (await response.json()) as T;
}

export type SheetTab = {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
};

type SpreadsheetMeta = {
  sheets: {
    properties: {
      sheetId: number;
      title: string;
      gridProperties?: { rowCount?: number; columnCount?: number };
    };
  }[];
};

export async function listTabs(auth: SheetsAuth, spreadsheetId: string): Promise<SheetTab[]> {
  const meta = await sheetsFetch<SpreadsheetMeta>(
    auth,
    `${encodeURIComponent(spreadsheetId)}?fields=sheets.properties`,
  );
  return meta.sheets.map(({ properties }) => ({
    sheetId: properties.sheetId,
    title: properties.title,
    rowCount: properties.gridProperties?.rowCount ?? 0,
    columnCount: properties.gridProperties?.columnCount ?? 0,
  }));
}

type BatchUpdateResponse = {
  replies?: { addSheet?: { properties: SpreadsheetMeta["sheets"][number]["properties"] } }[];
};

export async function batchUpdate(
  auth: SheetsAuth,
  spreadsheetId: string,
  requests: object[],
): Promise<BatchUpdateResponse> {
  return sheetsFetch<BatchUpdateResponse>(auth, `${encodeURIComponent(spreadsheetId)}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({ requests }),
  });
}

export async function addTab(auth: SheetsAuth, spreadsheetId: string, title: string): Promise<SheetTab> {
  const result = await batchUpdate(auth, spreadsheetId, [{ addSheet: { properties: { title } } }]);
  const properties = result.replies?.[0]?.addSheet?.properties;
  if (!properties) throw new SheetsError("Couldn't create the month tab in the sheet.");
  return {
    sheetId: properties.sheetId,
    title: properties.title,
    rowCount: properties.gridProperties?.rowCount ?? 1000,
    columnCount: properties.gridProperties?.columnCount ?? 26,
  };
}
