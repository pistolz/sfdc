import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { jsonError } from "@/lib/api";
import { stripeConfig } from "@/lib/env";
import {
  applySubscriptionState,
  claimStripeEvent,
  findUidByStripeCustomer,
  getUserRecord,
} from "@/lib/firestore";
import { planIdForStripePrice } from "@/lib/plans";
import {
  invoicePlan,
  invoiceSubscriptionId,
  stripeClient,
  stripeIdOf,
  subscriptionPeriodEndMs,
  subscriptionPriceId,
  subscriptionStateFor,
} from "@/lib/stripe";

/**
 * Stripe webhook receiver.
 *
 * Runs on the Node runtime because signature verification needs Node crypto,
 * and because we must read the body as raw text: Stripe signs the exact bytes
 * it sent, so `request.json()` (which re-encodes) would break verification.
 */
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return jsonError("Missing stripe-signature header.", 400);
    }

    // Raw body — never request.json(). See the runtime note above.
    const rawBody = await request.text();
    const { webhookSecret } = stripeConfig();

    let event: Stripe.Event;
    try {
      event = stripeClient().webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (error) {
      // Unsigned or replayed-with-a-stale-timestamp payload: reject outright.
      console.warn("[stripe] signature verification failed", error);
      return jsonError("Invalid signature.", 400);
    }

    /*
     * Idempotency guard, before any side effect.
     *
     * Stripe retries a delivery until it sees a 2xx, and can also deliver the
     * same event more than once. `claimStripeEvent` writes the event ID with a
     * create-only write and returns false if it was already there, so a retry
     * of `invoice.paid` cannot grant a second month of credits. It is claimed
     * before handling (not after) so that two concurrent deliveries of the same
     * event cannot both get past this point.
     */
    if (!(await claimStripeEvent(event.id))) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    await handleEvent(event);
    return NextResponse.json({ received: true });
  } catch (error) {
    // Genuine failure (Firestore down, Stripe API error): 500 so Stripe retries.
    console.error("[stripe] webhook handler failed", error);
    return jsonError("Webhook handler failed.", 500);
  }
}

/**
 * Resolves the account a Stripe object belongs to. Prefers an ID we put there
 * ourselves (client_reference_id / metadata.uid) and falls back to the customer
 * lookup for events raised outside a checkout we started.
 */
async function resolveUid(
  preferred: string | null | undefined,
  customer: unknown,
): Promise<string | null> {
  if (preferred) return preferred;
  const customerId = stripeIdOf(customer);
  return customerId ? findUidByStripeCustomer(customerId) : null;
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const uid = await resolveUid(session.client_reference_id, session.customer);
      const subscriptionId = stripeIdOf(session.subscription);
      if (!uid || !subscriptionId) {
        console.warn("[stripe] checkout.session.completed without account", {
          eventId: event.id,
          uid,
          subscriptionId,
        });
        return;
      }

      // Re-fetch rather than trusting the session payload: the subscription is
      // the source of truth for which price the customer actually bought.
      const subscription =
        await stripeClient().subscriptions.retrieve(subscriptionId);
      const priceId = subscriptionPriceId(subscription);
      const state = subscriptionStateFor(
        subscription.status,
        priceId ? planIdForStripePrice(priceId) : null,
      );

      await applySubscriptionState(uid, {
        plan: state.plan,
        status: state.status,
        subscriptionId: subscription.id,
        periodEnd: subscriptionPeriodEndMs(subscription),
        // A new paid period just started: grant the allowance.
        resetCredits: true,
      });
      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const subscription = event.data.object;
      const uid = await resolveUid(
        subscription.metadata?.uid,
        subscription.customer,
      );
      if (!uid) {
        console.warn("[stripe] subscription event for unknown customer", {
          eventId: event.id,
          subscriptionId: subscription.id,
        });
        return;
      }

      const priceId = subscriptionPriceId(subscription);
      const state = subscriptionStateFor(
        subscription.status,
        priceId ? planIdForStripePrice(priceId) : null,
      );

      await applySubscriptionState(uid, {
        plan: state.plan,
        status: state.status,
        subscriptionId: subscription.id,
        periodEnd: subscriptionPeriodEndMs(subscription),
        // Plan changes arrive here constantly (payment method updates, trial
        // transitions, proration). Credits refill on invoice.paid only.
        resetCredits: false,
      });
      return;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const uid = await resolveUid(
        subscription.metadata?.uid,
        subscription.customer,
      );
      if (!uid) return;

      await applySubscriptionState(uid, {
        plan: "free",
        status: "canceled",
        subscriptionId: null,
        periodEnd: subscriptionPeriodEndMs(subscription),
        resetCredits: false,
      });
      return;
    }

    case "invoice.paid": {
      const invoice = event.data.object;
      const uid = await resolveUid(null, invoice.customer);
      if (!uid) return;

      // The plan comes from the price on the invoice line, so a one-off invoice
      // for something else can never move the customer onto a paid plan.
      const { plan, periodEndMs } = invoicePlan(invoice);
      if (!plan) return;

      await applySubscriptionState(uid, {
        plan,
        status: "active",
        subscriptionId: invoiceSubscriptionId(invoice),
        periodEnd: periodEndMs,
        // A new period was paid for: this is the one place credits refill.
        resetCredits: true,
      });
      return;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const uid = await resolveUid(null, invoice.customer);
      if (!uid) return;

      // Keep whatever plan they are on — Stripe is still retrying the payment,
      // and cancellation (if it comes) arrives as its own subscription event.
      const record = await getUserRecord(uid);
      if (!record) return;

      await applySubscriptionState(uid, {
        plan: record.plan,
        status: "past_due",
        subscriptionId:
          record.stripeSubscriptionId ?? invoiceSubscriptionId(invoice),
        periodEnd: null,
        resetCredits: false,
      });
      return;
    }

    default:
      // Everything else is acknowledged and ignored.
      return;
  }
}
