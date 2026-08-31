"use client";

import { CalendarCheck, Download, Zap } from "lucide-react";

import { useLocalISODateValue, useLocalMonthValue } from "@/hooks/use-local-date";
import { Button } from "@/components/ui/button";

export function ExportQuickLinks() {
  const today = useLocalISODateValue();
  const month = useLocalMonthValue();

  return (
    <section className="border-border bg-card flex flex-col gap-2.5 rounded-lg border p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Zap className="text-link size-5" />
        Quick Export
      </h2>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <a href={today ? `/api/export?type=day&date=${today}` : undefined}>
            <Download /> Export Today
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={month ? `/api/export?type=month&month=${month}` : undefined}>
            <CalendarCheck /> Export This Month
          </a>
        </Button>
      </div>
    </section>
  );
}
