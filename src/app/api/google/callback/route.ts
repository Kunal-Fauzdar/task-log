import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import { getServerToday } from "@/lib/data/export-data";
import { getSheetSettings, saveGoogleConnection } from "@/lib/data/settings";
import {
  callbackUrl,
  exchangeCode,
  GoogleAuthError,
  OAUTH_STATE_COOKIE,
  verifyOAuthState,
} from "@/lib/sheets/google-oauth";
import { syncMonthToSheet } from "@/lib/sheets/sync";

// Step 2 of "Connect Google account": Google redirects back here with ?code&state. Verify the
// state belongs to this logged-in user + browser, exchange the code, store the (encrypted)
// refresh token, then return to /settings with a status flag the page turns into a message.
export async function GET(request: NextRequest) {
  const settingsUrl = (status: string) => {
    const url = new URL("/settings", request.url);
    url.searchParams.set("google", status);
    return url;
  };

  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const params = request.nextUrl.searchParams;
  const nonce = request.cookies.get(OAUTH_STATE_COOKIE)?.value;
  const finish = (status: string) => {
    const response = NextResponse.redirect(settingsUrl(status));
    response.cookies.delete({ name: OAUTH_STATE_COOKIE, path: "/api/google" });
    return response;
  };

  // User clicked "Cancel" on Google's consent screen.
  if (params.get("error")) return finish("cancelled");

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state || !verifyOAuthState(state, user.id, nonce)) return finish("invalid");

  try {
    const { refreshToken, email } = await exchangeCode(code, callbackUrl(request.nextUrl.origin));
    await saveGoogleConnection(user.id, refreshToken, email);
  } catch (error) {
    console.error("[google-oauth]", error);
    return finish(error instanceof GoogleAuthError && error.message.includes("allow access") ? "scope" : "failed");
  }

  // Already have a sheet linked? Write this month right away so the user sees it working.
  const { googleSheetId } = await getSheetSettings(user.id);
  if (googleSheetId) await syncMonthToSheet(user.id, getServerToday());

  return finish("connected");
}
