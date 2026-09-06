import type { AccountView } from "@/lib/types";
import { Meter } from "./ui/meter";
import { cn } from "./ui/styles";
import { daysUntil, formatDate, formatNumber, pluralise } from "./format";

export function creditTone(remaining: number, granted: number) {
  if (granted <= 0) return "danger" as const;
  const ratio = remaining / granted;
  if (ratio <= 0.1) return "danger" as const;
  if (ratio <= 0.25) return "warning" as const;
  return "accent" as const;
}

/** Compact meter for the app sidebar. */
export function CreditMeter({
  account,
  className,
}: {
  account: AccountView;
  className?: string;
}) {
  const used = Math.max(0, account.creditsGranted - account.credits);
  const days = daysUntil(account.periodEnd);
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-medium tracking-wide text-faint uppercase">
          Credits
        </span>
        <span className="text-[13px] font-medium tabular-nums">
          {formatNumber(account.credits)}
          <span className="text-faint">
            {" / "}
            {formatNumber(account.creditsGranted)}
          </span>
        </span>
      </div>
      <Meter
        value={account.credits}
        max={account.creditsGranted}
        label={`${formatNumber(account.credits)} credits remaining of ${formatNumber(account.creditsGranted)}`}
        tone={creditTone(account.credits, account.creditsGranted)}
      />
      <p className="text-[12px] text-faint">
        {formatNumber(used)} used · resets in {days} {pluralise(days, "day")}
      </p>
    </div>
  );
}

/** Full-width card used on the dashboard and billing pages. */
export function CreditSummary({
  account,
  className,
}: {
  account: AccountView;
  className?: string;
}) {
  const used = Math.max(0, account.creditsGranted - account.credits);
  const days = daysUntil(account.periodEnd);
  const stats: Array<[string, string]> = [
    ["Plan", account.planName],
    ["Used this period", formatNumber(used)],
    ["Remaining", formatNumber(account.credits)],
    [
      "Resets",
      `${formatDate(account.periodEnd)} · ${days} ${pluralise(days, "day")}`,
    ],
  ];

  return (
    <div className={cn("rounded-xl border border-border bg-surface", className)}>
      <div className="grid gap-px overflow-hidden rounded-t-xl bg-border sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="bg-surface px-5 py-4">
            <p className="text-[12px] font-medium tracking-wide text-faint uppercase">
              {label}
            </p>
            <p className="mt-1 text-[15px] font-semibold tracking-tight">
              {value}
            </p>
          </div>
        ))}
      </div>
      <div className="px-5 py-4">
        <Meter
          value={account.credits}
          max={account.creditsGranted}
          label={`${formatNumber(account.credits)} credits remaining of ${formatNumber(account.creditsGranted)}`}
          tone={creditTone(account.credits, account.creditsGranted)}
        />
      </div>
    </div>
  );
}
