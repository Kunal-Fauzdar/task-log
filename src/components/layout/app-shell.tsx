"use client";

import { usePathname } from "next/navigation";

import type { CurrentUser } from "@/lib/auth/current-user";
import { Header } from "@/components/layout/header";

// Chrome-free routes: the auth pages (everything else is behind the gate — src/proxy.ts).
const BARE_ROUTES = new Set(["/login", "/register"]);

// Owns the top-level page frame so the sidebar offset and the auth pages' full-bleed layout
// stay in one place.
export function AppShell({
  user,
  children,
}: {
  user: CurrentUser | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  if (BARE_ROUTES.has(pathname)) {
    return <main className="min-h-screen px-4 py-8">{children}</main>;
  }

  return (
    <>
      <Header user={user} />
      <div className="lg:pl-60">
        <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-10">
          {/* keyed on the route so the content replays a short fade on each client navigation */}
          <div key={pathname} className="route-fade">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
