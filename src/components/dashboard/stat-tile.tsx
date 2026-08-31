import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// A quiet metric readout: mono label, large number, optional context line. No glass, no
// gradient wash, no hover lift. The accent only tints a thin top rule and the icon glyph so
// related tiles group visually — it never fills the card.
const ACCENT_RULE = {
  primary: "bg-foreground/20",
  success: "bg-success",
  warning: "bg-warning",
  info: "bg-accent",
} as const;

const ACCENT_GLYPH = {
  primary: "text-muted-foreground",
  success: "text-link",
  warning: "text-warning",
  info: "text-link",
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
  accent?: keyof typeof ACCENT_RULE;
}) {
  return (
    <div className="border-border bg-card relative flex flex-col gap-2 overflow-hidden rounded-lg border p-4">
      <span className={cn("absolute inset-x-0 top-0 h-0.5", ACCENT_RULE[accent])} />
      <div className="flex items-start justify-between gap-2">
        <p className="eyebrow">{label}</p>
        {Icon && <Icon className={cn("size-4 shrink-0", ACCENT_GLYPH[accent])} aria-hidden />}
      </div>
      <p className="text-foreground text-[1.75rem] leading-none font-semibold tracking-tight tabular-nums">
        {value}
      </p>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}
