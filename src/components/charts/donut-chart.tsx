// Dependency-free SVG donut with a centre label and an optional legend.
export type DonutSlice = { label: string; value: number; color: string };

export function DonutChart({
  slices,
  centerValue,
  centerLabel,
  size = 132,
  legend = true,
}: {
  slices: DonutSlice[];
  centerValue: string;
  centerLabel: string;
  size?: number;
  legend?: boolean;
}) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const r = 46;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 120 120" width={size} height={size} role="img" aria-label={centerLabel}>
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--border)" strokeWidth="12" />
          {total > 0 &&
            slices
              .filter((s) => s.value > 0)
              .map((s) => {
                const len = (s.value / total) * c;
                const el = (
                  <circle
                    key={s.label}
                    cx="60"
                    cy="60"
                    r={r}
                    fill="none"
                    stroke={s.color}
                    strokeWidth="12"
                    strokeDasharray={`${Math.max(0, len - 1.5)} ${c}`}
                    strokeDashoffset={-offset}
                    transform="rotate(-90 60 60)"
                  />
                );
                offset += len;
                return el;
              })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-foreground text-xl leading-none font-semibold tabular-nums">
            {centerValue}
          </span>
          <span className="text-muted-foreground mt-1 text-[11px]">{centerLabel}</span>
        </div>
      </div>
      {legend && (
        <ul className="flex min-w-32 flex-1 flex-col gap-1.5 text-xs">
          {slices.map((s) => (
            <li key={s.label} className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="text-foreground min-w-0 flex-1 truncate">{s.label}</span>
              <span className="text-muted-foreground tabular-nums">
                {s.value}
                {total > 0 ? ` (${Math.round((s.value / total) * 100)}%)` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
