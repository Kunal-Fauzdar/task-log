import { cn } from "@/lib/utils";

// WorkLog Manager mark: a bound ledger — a spine on the left, three logged entries of
// decreasing length beside it. Geometric, flat, legible down to 16px. Colours are theme
// tokens (deepest green tile, primary-green glyph) so the mark stays in the palette.
// Decorative next to the wordmark, so aria-hidden.
export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("shrink-0", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect width="32" height="32" rx="7" className="fill-brand-strong" />
      <rect x="7" y="8" width="3" height="16" rx="1.5" className="fill-success" />
      <rect x="12" y="8.5" width="13" height="3" rx="1.5" className="fill-success" />
      <rect x="12" y="14.5" width="10" height="3" rx="1.5" className="fill-success" />
      <rect x="12" y="20.5" width="5.5" height="3" rx="1.5" className="fill-success" />
    </svg>
  );
}
