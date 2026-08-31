import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// One consistent icon-badge + title treatment for every top-level page, instead of each page
// hand-rolling its own copy of the same markup (found during the UI/UX audit: ~7 pages had
// near-identical but subtly-drifted inline versions of this block). `accent` picks from the
// small fixed set of hues in design.md's palette (primary #2B44D1 / accent #435EF0 — both blue,
// no hue variety by design) plus the semantic status tokens. The `teal`/`cyan`/`violet` accent
// names are kept only so existing call sites (Calendar, Import, Skills) don't need to change —
// each now just resolves to a different intensity of the same primary/accent blue rather than a
// literal teal/cyan/violet.
const ACCENT_ICON_CLASS = {
  primary: "from-primary/30 to-accent/20 text-link bg-gradient-to-br shadow-primary/15",
  teal: "from-accent/30 to-primary/15 text-accent bg-gradient-to-br shadow-accent/15",
  violet: "from-primary/25 to-primary/10 text-link bg-gradient-to-br shadow-primary/15",
  cyan: "from-accent/25 to-accent/10 text-accent bg-gradient-to-br shadow-accent/15",
  success: "from-success/25 to-success/10 text-success bg-gradient-to-br shadow-success/15",
  warning: "from-warning/30 to-warning/10 text-warning-foreground bg-gradient-to-br shadow-warning/15",
  info: "from-info/25 to-info/10 text-info bg-gradient-to-br shadow-info/15",
} as const;

export function PageHeader({
  icon: Icon,
  title,
  description,
  accent = "primary",
  actions,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  accent?: keyof typeof ACCENT_ICON_CLASS;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-lg shadow-md",
            ACCENT_ICON_CLASS[accent],
          )}
        >
          <Icon className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
