"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { logoutAction } from "@/lib/actions/auth-actions";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/worklog", label: "Work Log" },
  { href: "/calendar", label: "Calendar" },
  { href: "/skills", label: "Skills" },
  { href: "/reports", label: "Reports" },
  { href: "/export", label: "Export" },
  { href: "/import", label: "Import" },
  { href: "/settings", label: "Settings" },
] as const;

export function Header() {
  const pathname = usePathname();

  // The login page is its own full-screen layout — showing nav (all of it unreachable pre-auth
  // anyway, per src/proxy.ts) would just be noise.
  if (pathname === "/login") return null;

  return (
    <header className="border-border bg-background/95 sticky top-0 z-40 border-b backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/dashboard" className="text-sm font-semibold tracking-tight">
          WorkLog Manager
        </Link>
        <nav
          aria-label="Primary"
          className="flex flex-1 items-center gap-1 overflow-x-auto"
        >
          {NAV_ITEMS.map((item) => {
            const isActive =
              pathname === item.href || pathname?.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  isActive
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            Log Out
          </button>
        </form>
      </div>
    </header>
  );
}
