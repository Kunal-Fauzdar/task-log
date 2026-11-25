import { NextResponse, type NextRequest } from "next/server";

import { getCurrentUser } from "@/lib/auth/current-user";
import {
  buildAuthUrl,
  callbackUrl,
  createOAuthState,
  isGoogleOAuthConfigured,
  OAUTH_STATE_COOKIE,
} from "@/lib/sheets/google-oauth";

// Step 1 of "Connect Google account": send the user to Google's consent screen. A Route Handler
// (not a Server Action) because it's a plain top-level redirect the browser follows off-site.
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!isGoogleOAuthConfigured()) {
    return NextResponse.redirect(new URL("/settings?google=not-configured", request.url));
  }

  const { state, nonce } = createOAuthState(user.id);
  const response = NextResponse.redirect(
    buildAuthUrl(state, callbackUrl(request.nextUrl.origin), user.email),
  );
  // Binds the callback to this browser. Lax so it's sent on Google's top-level redirect back.
  response.cookies.set(OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/google",
    maxAge: 10 * 60,
  });
  return response;
}
