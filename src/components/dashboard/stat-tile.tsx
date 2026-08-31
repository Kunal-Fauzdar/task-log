import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const ACCENT_STYLES = {
  primary: {
    icon: "from-primary/25 to-accent/25 text-link bg-gradient-to-br",
    bar: "from-primary to-accent bg-gradient-to-b",
    wash: "from-primary/[0.06]",
  },
  success: {
    icon: "from-success/25 to-success/10 text-success bg-gradient-to-br",
    bar: "from-success to-success/70 bg-gradient-to-b",
    wash: "from-success/[0.06]",
  },
  warning: {
    icon: "from-warning/30 to-warning/10 text-warning-foreground bg-gradient-to-br",
    bar: "from-warning to-warning/70 bg-gradient-to-b",
    wash: "from-warning/[0.08]",
  },
  info: {
    icon: "from-info/25 to-info/10 text-info bg-gradient-to-br",
    bar: "from-info to-info/70 bg-gradient-to-b",
    wash: "from-info/[0.06]",
  },
} as const;

export function StatTile({
  label,
  value,
  icon: Icon,
  accent = "primary",
}: {
  label: string;
  value: string;
  icon?: LucideIcon;
  accent?: keyof typeof ACCENT_STYLES;
}) {
  return (
    <div
      className={cn(
        // bg-card/80 + backdrop-blur (a "light glass" surface, not fully opaque) rather than a
        // flat solid card — enough opacity that label/value text stays fully legible over the
        // background image, while still reading as glass rather than a plain block.
        "border-border bg-card/80 group relative flex flex-col gap-1.5 overflow-hidden rounded-lg border bg-gradient-to-br to-transparent p-3.5 shadow-sm backdrop-blur-md transition-all hover:-translate-y-0.5 hover:shadow-lg",
        ACCENT_STYLES[accent].wash,
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", ACCENT_STYLES[accent].bar)} />
      <div className="flex items-center justify-between gap-2 pl-1.5">
        <p className="text-muted-foreground text-sm font-medium">{label}</p>
        {Icon && (
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-lg shadow-sm",
              ACCENT_STYLES[accent].icon,
            )}
          >
            <Icon className="size-3.5" />
          </span>
        )}
      </div>
      <p className="pl-1.5 text-2xl font-semibold tracking-tight tabular-nums">
        {value}
      </p>
    </div>
  );
}
