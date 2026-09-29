// Dependency-free vertical bar chart (plain divs) for small daily series. The last bar is the
// highlighted (brightest) one, matching the reference's "today" emphasis.
export function BarChart({
  data,
  unit = "h",
  height = 130,
}: {
  data: { label: string; value: number }[];
  unit?: string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const top = Math.ceil(max / 2) * 2 || 2;
  const labelStride = data.length > 16 ? Math.ceil(data.length / 8) : 1;
  const ticks = [top, (top * 3) / 4, top / 2, top / 4, 0];
  return (
    <div className="flex gap-2" role="img" aria-label="Bar chart">
      <div
        className="text-muted-foreground flex flex-col justify-between text-right text-[10px] tabular-nums"
        style={{ height }}
      >
        {ticks.map((t) => (
          <span key={t}>
            {Number.isInteger(t) ? t : t.toFixed(1)}
            {unit}
          </span>
        ))}
      </div>
      <div className="flex-1">
        <div
          className="border-border flex items-end gap-2 border-b"
          style={{ height }}
        >
          {data.map((d, i) => (
            <div key={d.label + i} className="flex flex-1 flex-col items-center justify-end" style={{ height: "100%" }}>
              <div
                title={`${d.label}: ${d.value.toFixed(1)}${unit}`}
                className={
                  i === data.length - 1
                    ? "bg-primary w-full max-w-7 rounded-t-sm"
                    : "bg-primary/55 w-full max-w-7 rounded-t-sm"
                }
                style={{ height: `${(d.value / top) * 100}%`, minHeight: d.value > 0 ? 3 : 0 }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-2">
          {data.map((d, i) => (
            <span
              key={d.label + i}
              className="text-muted-foreground flex-1 text-center text-[10px] tabular-nums"
            >
              {i % labelStride === 0 || i === data.length - 1 ? d.label : ""}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
