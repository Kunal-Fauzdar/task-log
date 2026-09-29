import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// Metric tile from the dark reference: an icon chip on the left, the value and its label stacked
// on the right, inside a slightly lifted panel.
const ACCENT_ICON = {
  primary: "bg-primary/15 text-link",
  success: "bg-success/20 text-emerald-400",
  info: "bg-accent/15 text-link",
} as const;

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  accent = "primary",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  accent?: keyof typeof ACCENT_ICON;
}) {
  return (
    <div className="bg-secondary border-border flex items-center gap-3 rounded-lg border p-3.5">
      {Icon && (
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-lg",
            ACCENT_ICON[accent],
          )}
        >
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <div className="min-w-0">
        <p className="text-foreground text-xl leading-tight font-semibold tabular-nums">{value}</p>
        <p className="text-muted-foreground text-xs">{label}</p>
        {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
      </div>
    </div>
  );
}
