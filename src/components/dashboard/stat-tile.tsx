import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// A quiet metric readout: mono label, large number, optional context line. The tile is a filled
// panel with a soft shadow; `accent` picks one of three design.md-green tints so tiles group by
// the kind of metric they carry (hours / counts / completed) rather than all reading the same.
const ACCENT_SURFACE = {
  primary: "bg-secondary",
  success: "bg-success/25",
  info: "bg-accent/15",
} as const;

export function StatTile({
  label,
  value,
  hint,
  accent = "primary",
}: {
  label: string;
  value: string;
  hint?: string;
  // Accepted for call-site stability; not currently rendered.
  icon?: LucideIcon;
  accent?: keyof typeof ACCENT_SURFACE;
}) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-lg p-4 shadow-sm", ACCENT_SURFACE[accent])}>
      <p className="eyebrow">{label}</p>
      <p className="text-foreground text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}
