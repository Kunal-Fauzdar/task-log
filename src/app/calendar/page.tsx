"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { getLocalMonth } from "@/lib/domain/date";

// Client component so the initial month is the browser's local "this month" — same reasoning
// as /worklog/page.tsx.
export default function CalendarIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/calendar/${getLocalMonth(new Date())}`);
  }, [router]);

  return null;
}
