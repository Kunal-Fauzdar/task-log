import { formatSecondsToDuration } from "@/lib/domain/duration";

// The reference's "Day Summary" card: four small stat cells next to the Time Tracking card.
export function DaySummary({
  taskCount,
  taskSeconds,
  breakSeconds,
}: {
  taskCount: number;
  taskSeconds: number;
  breakSeconds: number;
}) {
  const cells = [
    { label: "Total Tasks", value: String(taskCount) },
    { label: "Task Duration", value: formatSecondsToDuration(taskSeconds) },
    { label: "Break Time", value: formatSecondsToDuration(breakSeconds) },
  ];
  return (
    <section className="panel flex flex-col gap-3 p-5">
      <h2 className="text-sm font-semibold">Day Summary</h2>
      <div className="grid grid-cols-2 gap-3">
        {cells.map((cell) => (
          <div key={cell.label} className="bg-secondary border-border rounded-lg border p-3">
            <p className="text-muted-foreground text-xs">{cell.label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums">{cell.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
