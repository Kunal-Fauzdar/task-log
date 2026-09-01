import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// A plain native GET form — no client JS needed. The browser submits it as a normal navigation
// to /api/export?type=range&from=...&to=..., and the Route Handler's Content-Disposition header
// makes the browser download the response instead of navigating to it.
export function ExportRangeForm() {
  return (
    <section className="bg-accent/15 flex flex-col gap-2.5 rounded-lg p-4 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        Custom Range
      </h2>
      <form method="GET" action="/api/export" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="type" value="range" />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="export-from">From</Label>
          <Input id="export-from" name="from" type="date" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="export-to">To</Label>
          <Input id="export-to" name="to" type="date" required />
        </div>
        <Button type="submit">
          <Download className="size-4" /> Export Range
        </Button>
      </form>
    </section>
  );
}
