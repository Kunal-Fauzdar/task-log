"use client";

import Form from "next/form";
import { CalendarRange } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export type MonthOption = { value: string; label: string };

// The month picker for the Dashboard's "Total hours" figure.
//
// It uses next/form's <Form>, not a bare <form> or router.push: a plain GET <form> only applies
// on an explicit button click (users didn't click, so the number looked stuck), and
// router.push("/dashboard?month=X") does NOT re-run the page's server component when only the
// query string changes on the same path (a known App Router gotcha) — so after the first pick
// every later month showed the same stale total. <Form action="/dashboard"> does a real
// client-side navigation that re-renders the server component with the new searchParam every
// time. `onChange` -> requestSubmit() makes the dropdown apply immediately; the "Show" button
// stays as a no-JS fallback.
export function MonthHoursPanel({
  months,
  selected,
  totalHours,
}: {
  months: MonthOption[];
  selected: string;
  totalHours: string;
}) {
  return (
    <div className="bg-secondary flex flex-wrap items-end justify-between gap-4 rounded-lg p-4 shadow-sm">
      <Form action="/dashboard" className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="dashboard-month">Month</Label>
          <select
            key={selected}
            id="dashboard-month"
            name="month"
            defaultValue={selected}
            onChange={(event) => event.currentTarget.form?.requestSubmit()}
            className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/50 h-9 rounded-md border px-3 py-1 text-sm outline-none focus-visible:ring-[3px]"
          >
            {months.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit" size="sm">
          <CalendarRange className="size-3.5" /> Show
        </Button>
      </Form>
      <div className="text-right">
        <p className="eyebrow">Total hours</p>
        <p
          data-testid="month-total-hours"
          className="text-foreground text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums"
        >
          {totalHours}
        </p>
      </div>
    </div>
  );
}
