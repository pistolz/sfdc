import { NextResponse } from "next/server";
import { jsonError, readJson, withAuth } from "@/lib/api";
import { appUrl, isBillingEnabled } from "@/lib/env";
import { isPlanId, planFor, stripePriceId, type PlanId } from "@/lib/plans";
import { ensureCustomer, stripeClient } from "@/lib/stripe";

export const runtime = "nodejs";

/** Pulls a plan ID out of an untrusted JSON body. */
function planIdFrom(body: unknown): PlanId | null {
  if (typeof body !== "object" || body === null) return null;
  const value = (body as Record<string, unknown>).planId;
  return isPlanId(value) ? value : null;
}

/**
 * Starts a Stripe Checkout session for a paid plan.
 *
 * `withAuth` wraps a zero-argument handler, so the body is read here — from the
 * route's own `request` — and closed over. Auth still runs before anything is
 * done with it, and `withAuth` supplies the uniform error handling.
 */
export async function POST(request: Request): Promise<Response> {
  const body = await readJson(request);

  return withAuth(async ({ user, account }) => {
    if (!isBillingEnabled()) {
      return jsonError("Billing is not enabled on this deployment.", 503);
    }

    const planId = planIdFrom(body);
    if (!planId) {
      return jsonError("Unknown plan.", 400);
    }
    if (planId === "free") {
      return jsonError("The free plan does not need a checkout session.", 400);
    }

    // The price always comes from our own env config, never from the client.
    const price = stripePriceId(planId);
    if (!price) {
      return jsonError(
        `The ${planFor(planId).name} plan is not available for purchase yet.`,
        400,
      );
    }

    const customer = await ensureCustomer(
      user.uid,
      user.email || account.email,
      account.stripeCustomerId,
    );

    const session = await stripeClient().checkout.sessions.create({
      mode: "subscription",
      customer,
      line_items: [{ price, quantity: 1 }],
      // Both of these let the webhook resolve the account without trusting the
      // browser: client_reference_id on the session, uid on the subscription.
      client_reference_id: user.uid,
      subscription_data: { metadata: { uid: user.uid } },
      success_url: `${appUrl()}/app/billing?checkout=success`,
      cancel_url: `${appUrl()}/app/billing?checkout=cancelled`,
      allow_promotion_codes: true,
    });

    if (!session.url) {
      return jsonError("Stripe did not return a checkout URL.", 502);
    }

    return NextResponse.json({ url: session.url });
  })();
}
