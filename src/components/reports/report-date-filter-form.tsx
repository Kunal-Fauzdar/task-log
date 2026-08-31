import { Filter } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Plain native GET form — no client JS, mirrors the Export page's ExportRangeForm. Submits to
// /reports?from=...&to=..., which the page reads as searchParams and falls back to the current
// month for on missing/invalid values (spec §31: "Reports should support date filtering").
export function ReportDateFilterForm({ from, to }: { from: string; to: string }) {
  return (
    <form
      method="GET"
      action="/reports"
      className="border-border bg-card flex flex-wrap items-end gap-3 rounded-lg border p-4 shadow-sm"
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="report-from">From</Label>
        <Input id="report-from" name="from" type="date" defaultValue={from} required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="report-to">To</Label>
        <Input id="report-to" name="to" type="date" defaultValue={to} required />
      </div>
      <Button type="submit">
        <Filter /> Apply Filter
      </Button>
    </form>
  );
}
