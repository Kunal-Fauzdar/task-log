import { cn } from "@/lib/utils";

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: "bg-destructive/15 text-destructive",
  MEDIUM: "bg-amber-500/15 text-amber-400",
  LOW: "bg-primary/15 text-link",
};
const PRIORITY_LABELS: Record<string, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

export function PriorityBadge({ priority, className }: { priority: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
        PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.MEDIUM,
        className,
      )}
    >
      {PRIORITY_LABELS[priority] ?? "Medium"}
    </span>
  );
}
