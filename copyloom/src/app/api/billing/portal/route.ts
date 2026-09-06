import { NextResponse } from "next/server";
import { jsonError, withAuth } from "@/lib/api";
import { appUrl, isBillingEnabled } from "@/lib/env";
import { stripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

/**
 * Sends the customer to the Stripe billing portal, where they can change
 * payment method, download invoices or cancel. Everything that happens there
 * comes back to us as a webhook, so there is no state to update here.
 */
export const POST = withAuth(async ({ account }) => {
  if (!isBillingEnabled()) {
    return jsonError("Billing is not enabled on this deployment.", 503);
  }

  if (!account.stripeCustomerId) {
    return jsonError("No billing account yet.", 400);
  }

  const session = await stripeClient().billingPortal.sessions.create({
    customer: account.stripeCustomerId,
    return_url: `${appUrl()}/app/billing`,
  });

  return NextResponse.json({ url: session.url });
});
