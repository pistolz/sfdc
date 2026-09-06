"use client";

import { useState } from "react";
import { PLAN_ORDER, type Plan, type PlanId } from "@/lib/plans";
import type { AccountView } from "@/lib/types";
import { PricingGrid } from "./pricing";
import { Button } from "./ui/button";
import { Alert } from "./ui/alert";
import { ToastViewport, useToasts } from "./ui/toast";
import { BRAND } from "@/lib/brand";

async function postForUrl(path: string, body?: unknown): Promise<string> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => null)) as {
    url?: string;
    error?: string;
  } | null;
  if (!response.ok || !payload?.url) {
    throw new Error(payload?.error ?? "Billing is not available right now.");
  }
  return payload.url;
}

function rank(plan: PlanId): number {
  return PLAN_ORDER.indexOf(plan);
}

export function BillingClient({ account }: { account: AccountView }) {
  const { toasts, show, dismiss } = useToasts();
  const [pending, setPending] = useState<string | null>(null);

  async function checkout(planId: PlanId) {
    setPending(planId);
    try {
      window.location.href = await postForUrl("/api/billing/checkout", {
        planId,
      });
    } catch (caught) {
      show(
        caught instanceof Error ? caught.message : "Could not start checkout.",
        "danger",
      );
      setPending(null);
    }
  }

  async function portal() {
    setPending("portal");
    try {
      window.location.href = await postForUrl("/api/billing/portal");
    } catch (caught) {
      show(
        caught instanceof Error
          ? caught.message
          : "Could not open the billing portal.",
        "danger",
      );
      setPending(null);
    }
  }

  function actionFor(plan: Plan) {
    const current = plan.id === account.plan;

    if (current) {
      return (
        <Button variant="secondary" className="w-full" disabled>
          Current plan
        </Button>
      );
    }

    if (!account.billingEnabled) {
      return (
        <Button variant="secondary" className="w-full" disabled>
          Unavailable
        </Button>
      );
    }

    if (plan.price === 0) {
      // Downgrades to free happen by cancelling in Stripe's portal.
      return account.hasSubscription ? (
        <Button
          variant="secondary"
          className="w-full"
          loading={pending === "portal"}
          disabled={pending !== null}
          onClick={portal}
        >
          Cancel in portal
        </Button>
      ) : (
        <Button variant="secondary" className="w-full" disabled>
          Included
        </Button>
      );
    }

    const downgrade = rank(plan.id) < rank(account.plan);
    return (
      <Button
        variant={plan.highlight && !downgrade ? "primary" : "secondary"}
        className="w-full"
        loading={pending === plan.id}
        disabled={pending !== null}
        onClick={() => checkout(plan.id)}
      >
        {downgrade ? `Switch to ${plan.name}` : `Upgrade to ${plan.name}`}
      </Button>
    );
  }

  return (
    <div className="space-y-6">
      {!account.billingEnabled ? (
        <Alert tone="info" title="Billing is not configured">
          This deployment has no Stripe keys set, so plan changes are disabled.
          You are on {account.planName} with{" "}
          {account.creditsGranted.toLocaleString("en-US")} credits per period.
          Contact {BRAND.supportEmail} if you need more.
        </Alert>
      ) : account.hasSubscription ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface px-5 py-4">
          <div>
            <p className="text-[15px] font-semibold tracking-tight">
              {account.planName} subscription
            </p>
            <p className="mt-0.5 text-[13px] text-muted">
              {account.subscriptionStatus
                ? `Status: ${account.subscriptionStatus}. `
                : ""}
              Update your card, download invoices or cancel in the Stripe portal.
            </p>
          </div>
          <Button
            variant="secondary"
            loading={pending === "portal"}
            disabled={pending !== null}
            onClick={portal}
          >
            Manage billing
          </Button>
        </div>
      ) : null}

      <PricingGrid renderAction={actionFor} currentPlan={account.plan} />

      <p className="text-[13px] text-faint">
        Prices are in USD and billed monthly. Changing plans takes effect
        immediately and your credit allowance resets at the start of the new
        period.
      </p>

      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
