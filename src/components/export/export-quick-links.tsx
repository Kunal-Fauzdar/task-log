"use client";

import { useLocalISODateValue, useLocalMonthValue } from "@/hooks/use-local-date";
import { Button } from "@/components/ui/button";

export function ExportQuickLinks() {
  const today = useLocalISODateValue();
  const month = useLocalMonthValue();

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight">Quick Export</h2>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <a href={today ? `/api/export?type=day&date=${today}` : undefined}>Export Today</a>
        </Button>
        <Button asChild variant="outline">
          <a href={month ? `/api/export?type=month&month=${month}` : undefined}>
            Export This Month
          </a>
        </Button>
      </div>
    </section>
  );
}
