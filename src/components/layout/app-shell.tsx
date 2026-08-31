"use client";

import { usePathname } from "next/navigation";

import { Header } from "@/components/layout/header";

// Owns the top-level page frame so the sidebar offset and the login page's full-bleed layout
// stay in one place. Login is the only route with no chrome (everything else is behind the auth
// gate anyway — src/proxy.ts).
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/login") {
    return <main className="min-h-screen px-4 py-8">{children}</main>;
  }

  return (
    <>
      <Header />
      <div className="lg:pl-64">
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
