import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { prisma } from "@/lib/db";
import { SESSION_COOKIE_NAME, readSessionToken } from "@/lib/auth/session";

export type CurrentUser = { id: string; email: string; name: string };

// `cache()` dedupes within one request render tree, so a page + its data calls + the layout can
// all call getCurrentUser() and only one User row is fetched. Returns null when there's no valid
// session or the user has since been deleted — callers redirect (see requireUser) or 401.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies();
  const session = readSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) return null;

  return prisma.user.findUnique({
    where: { id: session.uid },
    select: { id: true, email: true, name: true },
  });
});

// For Server Components / Server Actions that need an owner id. src/proxy.ts already blocks
// unauthenticated requests, so this redirect is belt-and-braces (and covers a deleted user).
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
