import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Playfair_Display, JetBrains_Mono } from "next/font/google";

import { AppShell } from "@/components/layout/app-shell";

import "./globals.css";

// Type system rebuilt on the supplied "Aether" reference (design.md + the two screenshots):
//  - Plus Jakarta Sans  — all UI text, body copy, tables, headings. One workhorse family.
//  - Playfair Display    — reserved for "display moments" only: page-header titles and the
//    date on a work-day's own page. Italic, the way the reference uses it on card titles.
//  - JetBrains Mono      — technical metadata: Task IDs, ISO dates, section eyebrow labels.
// All three are exposed as CSS variables so components never hard-code a font-family.
const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});
const display = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-display",
  style: ["normal", "italic"],
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WorkLog Manager",
  description: "Daily work log, time tracking, and skill map for personal productivity.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${mono.variable}`}>
      <body className="min-h-screen antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
