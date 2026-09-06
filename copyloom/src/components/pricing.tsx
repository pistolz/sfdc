import type { ReactNode } from "react";
import { PLANS, PLAN_ORDER, type Plan, type PlanId } from "@/lib/plans";
import { Badge } from "./ui/badge";
import { cn } from "./ui/styles";

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="mt-[3px] size-4 shrink-0 text-accent-text"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}

export function PlanCard({
  plan,
  action,
  current = false,
  emphasise = false,
}: {
  plan: Plan;
  action: ReactNode;
  current?: boolean;
  emphasise?: boolean;
}) {
  const featured = emphasise && !current;
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border bg-surface p-6",
        featured
          ? "border-accent-soft-border ring-1 ring-accent/25"
          : "border-border",
        current && "border-accent-soft-border bg-accent-soft/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[15px] font-semibold tracking-tight">{plan.name}</h3>
        {current ? (
          <Badge tone="accent">Current</Badge>
        ) : featured ? (
          <Badge tone="accent">Most popular</Badge>
        ) : null}
      </div>

      <p className="mt-3 flex items-baseline gap-1">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">
          ${plan.price}
        </span>
        <span className="text-sm text-faint">/month</span>
      </p>
      <p className="mt-2 text-sm text-muted">{plan.blurb}</p>

      <ul className="mt-5 mb-6 flex-1 space-y-2.5 text-sm text-muted">
        {plan.features.map((feature) => (
          <li key={feature} className="flex gap-2.5">
            <CheckIcon />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto">{action}</div>
    </div>
  );
}

export function PricingGrid({
  renderAction,
  currentPlan,
}: {
  renderAction: (plan: Plan) => ReactNode;
  currentPlan?: PlanId;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {PLAN_ORDER.map((id) => {
        const plan = PLANS[id];
        return (
          <PlanCard
            key={id}
            plan={plan}
            current={currentPlan === id}
            emphasise={Boolean(plan.highlight)}
            action={renderAction(plan)}
          />
        );
      })}
    </div>
  );
}
