import type { LucideIcon } from "lucide-react";

// Page title block from the dark reference: a bold sans title, one muted supporting line, and an
// optional actions slot (date pickers, primary CTA) aligned to the right.
export function PageHeader({
  title,
  description,
  actions,
}: {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="min-w-0">
        <h1 className="text-foreground text-2xl leading-tight font-semibold tracking-tight">
          {title}
        </h1>
        {description && <p className="text-muted-foreground mt-1 text-sm">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
