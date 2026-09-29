"use client";

import { useState } from "react";
import { CalendarCheck, Download } from "lucide-react";

import { useLocalISODateValue, useLocalMonthValue } from "@/hooks/use-local-date";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export function ExportQuickLinks({ projects }: { projects: { id: string; name: string }[] }) {
  const today = useLocalISODateValue();
  const month = useLocalMonthValue();
  const [projectId, setProjectId] = useState("");

  const projectQuery = projectId ? `&projectId=${projectId}` : "";

  return (
    <div className="flex flex-col gap-3.5">
      {projects.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="quick-export-project">Project</Label>
          <select
            id="quick-export-project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="border-input bg-card focus-visible:border-ring focus-visible:ring-ring/50 h-10 w-full rounded-md border px-3 py-1 text-sm outline-none focus-visible:ring-[3px]"
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="quick-export-format">Format</Label>
        <select
          id="quick-export-format"
          disabled
          className="border-input bg-card h-10 w-full rounded-md border px-3 py-1 text-sm opacity-80"
        >
          <option>Excel (.xlsx)</option>
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <Button asChild className="w-full">
          <a href={today ? `/api/export?type=day&date=${today}${projectQuery}` : undefined}>
            <Download className="size-4" /> Export Today
          </a>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <a href={month ? `/api/export?type=month&month=${month}${projectQuery}` : undefined}>
            <CalendarCheck className="size-4" /> Export This Month
          </a>
        </Button>
      </div>
    </div>
  );
}
