"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { getLocalISODate } from "@/lib/domain/date";

// Client component so "today" is the browser's local calendar date, not the server's UTC
// date — matters near midnight, and this app deliberately never does timezone conversion
// (see CLAUDE.md §3).
export default function WorkLogIndexPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace(`/worklog/${getLocalISODate(new Date())}`);
  }, [router]);

  return null;
}
