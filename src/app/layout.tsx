import type { Metadata } from "next";

import { Header } from "@/components/layout/header";

import "./globals.css";

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
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Header />
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
