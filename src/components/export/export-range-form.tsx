import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// A plain native GET form — no client JS needed. The browser submits it as a normal navigation
// to /api/export?type=range&from=...&to=..., and the Route Handler's Content-Disposition header
// makes the browser download the response instead of navigating to it.
export function ExportRangeForm() {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold tracking-tight">Custom Range</h2>
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
        <Button type="submit">Export Range</Button>
      </form>
    </section>
  );
}
