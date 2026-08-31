import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";

import { Header } from "@/components/layout/header";

import "./globals.css";

// Per design.md: Inter for both display and body copy (one family, weight does the work of
// distinguishing headings — no separate display face), JetBrains Mono for labels/technical
// metadata (Task IDs, status pills). Both applied globally via CSS variables so individual
// components never need to reach for a font-family class themselves.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const jetbrainsMono = JetBrains_Mono({
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
    // Dark is this app's only real theme — a single-user personal tool, not a light/dark toggle
    // product. Forced via this class rather than `prefers-color-scheme` so it's consistent
    // regardless of OS setting.
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen antialiased">
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>
      </body>
    </html>
  );
}
