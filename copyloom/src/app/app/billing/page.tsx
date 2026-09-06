import type { Metadata } from "next";
import { getSessionUser } from "@/lib/session";
import { ensureUserRecord, toAccountView } from "@/lib/firestore";
import { PageHeader } from "@/components/page-header";
import { CreditSummary } from "@/components/credit-meter";
import { BillingClient } from "@/components/billing-client";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (!user) return null;

  const [record, params] = await Promise.all([
    ensureUserRecord(user),
    searchParams,
  ]);
  const account = toAccountView(record);

  const raw = params.checkout;
  const checkout = Array.isArray(raw) ? raw[0] : raw;

  return (
    <>
      <PageHeader
        title="Billing"
        description="Your plan, your credit usage and when the allowance refills."
      />

      <div className="space-y-8 px-5 py-6 lg:px-8">
        {checkout === "success" ? (
          <Alert tone="success" title="Payment received">
            Your plan is being updated. Credits refresh within a few seconds — if
            the numbers below look stale, reload the page.
          </Alert>
        ) : checkout === "cancelled" ? (
          <Alert tone="warning" title="Checkout cancelled">
            No charge was made and your plan has not changed.
          </Alert>
        ) : null}

        <section aria-labelledby="usage-heading">
          <h2
            id="usage-heading"
            className="mb-3 text-lg font-semibold tracking-tight"
          >
            This period
          </h2>
          <CreditSummary account={account} />
        </section>

        <section aria-labelledby="plans-heading">
          <h2
            id="plans-heading"
            className="mb-3 text-lg font-semibold tracking-tight"
          >
            Plans
          </h2>
          <BillingClient account={account} />
        </section>
      </div>
    </>
  );
}
