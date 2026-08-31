import type { LucideIcon } from "lucide-react";

// One page title treatment for every top-level page: a small mono eyebrow, a Playfair display
// title, an optional supporting line, and an optional actions slot on the right. No gradient
// icon badge, no per-page decorative hue — the reference palette is monochrome and the title
// itself carries the page, not a colored square next to it. The icon is a quiet outlined mark.
export function PageHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  actions,
}: {
  icon: LucideIcon;
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="border-border flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b pb-5">
      <div className="min-w-0">
        <p className="eyebrow flex items-center gap-2">
          <Icon className="text-muted-foreground size-3.5" aria-hidden />
          {eyebrow ?? "Work Log Manager"}
        </p>
        <h1 className="font-display text-foreground mt-2 text-3xl leading-tight sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground mt-2 max-w-prose text-sm">{description}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
