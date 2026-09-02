"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  FileDown,
  FileUp,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  NotebookPen,
  Settings as SettingsIcon,
  ChartColumn,
  GraduationCap,
  X,
} from "lucide-react";

import { logoutAction } from "@/lib/actions/auth-actions";
import { Logo } from "@/components/layout/logo";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/worklog", label: "Work Log", icon: NotebookPen },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/skills", label: "Skills", icon: GraduationCap },
  { href: "/reports", label: "Reports", icon: ChartColumn },
  { href: "/export", label: "Export", icon: FileDown },
  { href: "/import", label: "Import", icon: FileUp },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

function Wordmark() {
  return (
    <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
      <Logo className="size-8" />
      <span className="text-sm font-semibold tracking-tight">WorkLog Manager</span>
    </Link>
  );
}

function NavList({
  isActiveHref,
  onNavigate,
}: {
  isActiveHref: (href: string) => boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = isActiveHref(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150",
              "focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
              active
                ? "bg-secondary text-foreground font-semibold after:absolute after:top-1/2 after:left-0 after:h-5 after:w-0.5 after:-translate-y-1/2 after:rounded-full after:bg-accent"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground font-medium",
            )}
          >
            <Icon className="size-4 shrink-0" />
            {item.label}
          </Link>
        );
      })}
    </>
  );
}

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Close the mobile drawer on every route change — "adjust state during render" pattern
  // (CLAUDE.md §3), not effect + setState.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
  }

  function isActiveHref(href: string) {
    return pathname === href || pathname?.startsWith(`${href}/`);
  }

  return (
    <>
      {/* Desktop: fixed vertical sidebar. */}
      <aside className="border-border bg-background fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r lg:flex">
        <div className="border-border flex h-16 items-center border-b px-5">
          <Wordmark />
        </div>
        <nav
          aria-label="Primary"
          className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3"
        >
          <NavList isActiveHref={isActiveHref} />
        </nav>
        <form action={logoutAction} className="border-border border-t p-3">
          <button
            type="submit"
            className="text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-ring flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:ring-2 focus-visible:outline-none"
          >
            <LogOut className="size-4" />
            Log Out
          </button>
        </form>
      </aside>

      {/* Mobile: top bar + slide-in drawer. */}
      <header className="border-border bg-background sticky top-0 z-40 border-b lg:hidden">
        <div className="flex h-16 items-center justify-between px-4 sm:px-6">
          <Wordmark />
          <button
            type="button"
            className="border-border text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:ring-ring flex size-9 items-center justify-center rounded-full border transition-colors focus-visible:ring-2 focus-visible:outline-none"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </header>

      {/* Drawer backdrop */}
      <button
        type="button"
        aria-label="Close menu"
        tabIndex={-1}
        onClick={() => setMobileOpen(false)}
        className={cn(
          "bg-foreground/20 fixed inset-0 z-40 transition-opacity duration-200 lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <div
        className={cn(
          "border-border bg-background fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r transition-transform duration-200 ease-out lg:hidden",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="border-border flex h-16 items-center justify-between border-b px-5">
          <Wordmark />
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
            className="text-muted-foreground hover:text-foreground flex size-8 items-center justify-center rounded-md transition-colors"
          >
            <X className="size-5" />
          </button>
        </div>
        <nav aria-label="Primary mobile" className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3">
          <NavList isActiveHref={isActiveHref} onNavigate={() => setMobileOpen(false)} />
        </nav>
        <form action={logoutAction} className="border-border border-t p-3">
          <button
            type="submit"
            className="text-muted-foreground hover:bg-secondary hover:text-foreground flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors"
          >
            <LogOut className="size-4" />
            Log Out
          </button>
        </form>
      </div>
    </>
  );
}
