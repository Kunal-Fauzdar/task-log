"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { ExportQuickLinks } from "@/components/export/export-quick-links";
import { ExportRangeForm } from "@/components/export/export-range-form";
import { cn } from "@/lib/utils";

const INCLUDED = [
  "One row per task",
  "Date, day, check in/out, break",
  "Task details and duration",
  "Real Excel hyperlinks for task links",
  "Daily notes and holiday rows",
  "All configured working days",
];

// The reference's single export card: Quick Export / Custom Range tabs, then the shared
// "What's included" checklist underneath.
export function ExportPanel({ projects }: { projects: { id: string; name: string }[] }) {
  const [tab, setTab] = useState<"quick" | "range">("quick");

  return (
    <section className="panel flex max-w-xl flex-col gap-5 p-5">
      <div role="tablist" aria-label="Export type" className="border-border flex w-fit gap-1 rounded-lg border p-1">
        {(
          [
            ["quick", "Quick Export"],
            ["range", "Custom Range"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "rounded-md px-3.5 py-1.5 text-sm transition-colors",
              tab === id
                ? "bg-primary/15 text-link font-medium"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "quick" ? (
        <ExportQuickLinks projects={projects} />
      ) : (
        <ExportRangeForm projects={projects} />
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">What&apos;s included</h2>
        <ul className="text-muted-foreground flex flex-col gap-1.5 text-sm">
          {INCLUDED.map((item) => (
            <li key={item} className="flex items-center gap-2">
              <Check className="text-link size-3.5" />
              {item}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
