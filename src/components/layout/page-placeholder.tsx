export function PagePlaceholder({
  title,
  phase,
}: {
  title: string;
  phase: string;
}) {
  return (
    <div className="border-border flex flex-col gap-2 rounded-lg border border-dashed p-8">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <p className="text-muted-foreground text-sm">Built in {phase}.</p>
    </div>
  );
}
