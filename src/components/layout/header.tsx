"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  FileDown,
  FileUp,
  LayoutDashboard,
  LogOut,
  Menu,
  NotebookPen,
  Settings as SettingsIcon,
  ChartColumn,
  Sparkles,
  Timer,
  X,
} from "lucide-react";

import { logoutAction } from "@/lib/actions/auth-actions";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/worklog", label: "Work Log", icon: NotebookPen },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/skills", label: "Skills", icon: Sparkles },
  { href: "/reports", label: "Reports", icon: ChartColumn },
  { href: "/export", label: "Export", icon: FileDown },
  { href: "/import", label: "Import", icon: FileUp },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile panel on every route change (a Link click always changes pathname, even
  // when navigating to the page already shown) — same "adjust state during render" pattern used
  // elsewhere in this app (TimeTrackingCard, WorkDayHeader — see CLAUDE.md §3) rather than an
  // effect + setState, which would trip react-hooks/set-state-in-effect and cost an extra render.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
  }

  // The login page is its own full-screen layout — showing nav (all of it unreachable pre-auth
  // anyway, per src/proxy.ts) would just be noise.
  if (pathname === "/login") return null;

  function isActiveHref(href: string) {
    return pathname === href || pathname?.startsWith(`${href}/`);
  }

  return (
    <header className="bg-background/85 sticky top-0 z-40 shadow-xs backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link href="/dashboard" className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <span className="from-primary to-accent text-primary-foreground flex size-7 items-center justify-center rounded-lg bg-gradient-to-br shadow-sm shadow-primary/30">
            <Timer className="size-4" />
          </span>
          <span className="text-gradient-brand hidden sm:inline">WorkLog Manager</span>
        </Link>

        {/* Desktop/tablet nav — a horizontal bar fits comfortably at md+ widths; overflow-x-auto
            stays as a safety net rather than the primary interaction pattern it used to be, and
            no-scrollbar keeps that fallback from ever showing a visible scrollbar track. */}
        <nav
          aria-label="Primary"
          className="no-scrollbar hidden flex-1 items-center gap-0.5 overflow-x-auto md:flex"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActiveHref(item.href) ? "page" : undefined}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium whitespace-nowrap transition-colors",
                  "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                  isActiveHref(item.href)
                    ? "bg-primary/10 text-link"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <form action={logoutAction} className="hidden md:block">
          <button
            type="submit"
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:outline-none"
          >
            <LogOut className="size-4" />
            <span className="hidden sm:inline">Log Out</span>
          </button>
        </form>

        {/* Mobile nav trigger — below md, a horizontally-scrolling tab bar is a weak, undiscoverable
            primary-navigation pattern, so narrow viewports get a proper menu instead. */}
        <button
          type="button"
          className="text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring ml-auto flex size-9 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      <div className="from-primary to-accent h-1 bg-gradient-to-r" />

      {mobileOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            tabIndex={-1}
            className="fixed inset-0 top-14 z-30 bg-black/20 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <div className="border-border bg-background absolute inset-x-0 top-full z-40 border-b p-2 shadow-lg md:hidden">
            <nav aria-label="Primary mobile" className="flex flex-col gap-0.5">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActiveHref(item.href) ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
                      isActiveHref(item.href)
                        ? "bg-primary/10 text-link"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
              <form action={logoutAction} className="border-border mt-1 border-t pt-1">
                <button
                  type="submit"
                  className="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2.5 rounded-md px-3 py-2.5 text-sm font-medium transition-colors"
                >
                  <LogOut className="size-4" />
                  Log Out
                </button>
              </form>
            </nav>
          </div>
        </>
      )}
    </header>
  );
}
