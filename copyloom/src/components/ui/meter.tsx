import { cn } from "./styles";

/**
 * Credit meter. Renders as a real <progress>-equivalent via role="meter" so
 * screen readers announce the remaining balance, not just a coloured bar.
 */
export function Meter({
  value,
  max,
  label,
  className,
  tone = "accent",
}: {
  value: number;
  max: number;
  label: string;
  className?: string;
  tone?: "accent" | "warning" | "danger";
}) {
  const safeMax = max > 0 ? max : 1;
  const pct = Math.max(0, Math.min(100, (value / safeMax) * 100));
  const fill =
    tone === "danger"
      ? "bg-danger"
      : tone === "warning"
        ? "bg-warning"
        : "bg-accent";

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuetext={`${Math.round(value)} of ${safeMax}`}
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full bg-surface-3",
        className,
      )}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-500", fill)}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
