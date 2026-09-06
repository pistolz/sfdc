import Stripe from "stripe";
import { stripeConfig } from "./env";
import { planIdForStripePrice, type PlanId } from "./plans";

/**
 * Stripe client and the small pure helpers that translate Stripe objects into
 * the shape our Firestore layer wants.
 *
 * Nothing here imports `./firestore` at module scope: that module pulls in
 * `server-only` and firebase-admin, neither of which loads outside the Next
 * server runtime. The one place we need it (`ensureCustomer`) imports it
 * lazily instead, so the pure helpers below stay unit-testable.
 */

/**
 * Pinned so a Stripe-side default upgrade can never silently change the shape
 * of the objects this code reads. Matches the version the installed
 * `stripe@18` typings are generated from.
 */
const STRIPE_API_VERSION = "2025-08-27.basil";

let client: Stripe | null = null;

/**
 * Lazily-constructed singleton.
 *
 * Lazy because `stripeConfig()` throws when STRIPE_SECRET_KEY is absent, and
 * `next build` (and any route that never touches billing) must not require it.
 * Cached because each Stripe instance holds its own HTTP agent.
 */
export function stripeClient(): Stripe {
  if (!client) {
    client = new Stripe(stripeConfig().secretKey, {
      apiVersion: STRIPE_API_VERSION,
      typescript: true,
    });
  }
  return client;
}

/**
 * Returns the account's Stripe customer, creating and persisting one on first
 * use. `metadata.uid` lets us recover the account from any Stripe-side object
 * even if the Firestore lookup index is unavailable.
 */
export async function ensureCustomer(
  uid: string,
  email: string,
  existingCustomerId: string | null,
): Promise<string> {
  if (existingCustomerId) return existingCustomerId;

  const customer = await stripeClient().customers.create({
    email: email || undefined,
    metadata: { uid },
  });

  // Lazy import: see the module comment above.
  const { attachStripeCustomer } = await import("./firestore");
  await attachStripeCustomer(uid, customer.id);

  return customer.id;
}

/* -------------------------------------------------------------------------- */
/* Pure mapping helpers (no network, no Firestore — unit tested directly)      */
/* -------------------------------------------------------------------------- */

/**
 * Subscription statuses that mean the customer is no longer entitled to a paid
 * plan. `past_due` is deliberately absent: the subscription is still live and
 * Stripe is retrying, so we keep the plan and only flag the status.
 */
const ENTITLEMENT_ENDING_STATUSES = new Set([
  "canceled",
  "unpaid",
  "incomplete_expired",
]);

export function isEntitlementEndingStatus(status: string | null): boolean {
  return status !== null && ENTITLEMENT_ENDING_STATUSES.has(status);
}

/**
 * Maps a Stripe subscription status plus the plan implied by its price onto
 * the plan/status pair we store.
 *
 * `pricedPlan` comes from the Stripe price ID, never from client input, so a
 * user cannot talk their way onto a plan they are not paying for. An unknown
 * price (a legacy or manually created one) falls back to "free" rather than
 * granting an arbitrary allowance.
 */
export function subscriptionStateFor(
  status: string | null,
  pricedPlan: PlanId | null,
): { plan: PlanId; status: string | null } {
  if (isEntitlementEndingStatus(status)) return { plan: "free", status };
  return { plan: pricedPlan ?? "free", status };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

/** Stripe expands references inline; accept either an ID or the object. */
export function stripeIdOf(value: unknown): string | null {
  if (typeof value === "string") return value || null;
  const record = asRecord(value);
  const id = record?.id;
  return typeof id === "string" ? id : null;
}

/** Seconds (Stripe) to milliseconds (our Firestore records). */
function secondsToMs(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value * 1000)
    : null;
}

/**
 * Current period end, in epoch **milliseconds**.
 *
 * As of the 2025 API versions the period fields live on the subscription
 * *item* (`items.data[].current_period_end`), not on the subscription root, so
 * we read the first item and only fall back to the legacy root field. Both
 * lookups are defensive because the root field no longer exists in the v18
 * typings at all.
 */
export function subscriptionPeriodEndMs(subscription: unknown): number | null {
  const sub = asRecord(subscription);
  if (!sub) return null;

  const items = asRecord(sub.items);
  const data = Array.isArray(items?.data) ? items.data : [];
  for (const entry of data) {
    const end = secondsToMs(asRecord(entry)?.current_period_end);
    if (end !== null) return end;
  }

  return secondsToMs(sub.current_period_end);
}

/** Price ID driving a subscription, taken from its first item. */
export function subscriptionPriceId(subscription: unknown): string | null {
  const sub = asRecord(subscription);
  const items = asRecord(sub?.items);
  const data = Array.isArray(items?.data) ? items.data : [];
  for (const entry of data) {
    const priceId = stripeIdOf(asRecord(entry)?.price);
    if (priceId) return priceId;
  }
  return null;
}

/**
 * Price ID on an invoice line. In the 2025 API the price moved under
 * `pricing.price_details.price`; older payloads carried `price.id`.
 */
export function invoiceLinePriceId(line: unknown): string | null {
  const record = asRecord(line);
  if (!record) return null;

  const priceDetails = asRecord(asRecord(record.pricing)?.price_details);
  const nested = priceDetails?.price;
  if (typeof nested === "string" && nested) return nested;

  return stripeIdOf(record.price);
}

/** First line of an invoice that maps to one of our plans. */
export function invoicePlan(invoice: unknown): {
  plan: PlanId | null;
  periodEndMs: number | null;
} {
  const record = asRecord(invoice);
  const lines = asRecord(record?.lines);
  const data = Array.isArray(lines?.data) ? lines.data : [];

  for (const line of data) {
    const priceId = invoiceLinePriceId(line);
    const plan = priceId ? planIdForStripePrice(priceId) : null;
    if (!plan) continue;
    const period = asRecord(asRecord(line)?.period);
    return { plan, periodEndMs: secondsToMs(period?.end) };
  }

  return { plan: null, periodEndMs: null };
}

/** Subscription the invoice was generated for, if any. */
export function invoiceSubscriptionId(invoice: unknown): string | null {
  const record = asRecord(invoice);
  const parent = asRecord(record?.parent);
  const details = asRecord(parent?.subscription_details);
  return (
    stripeIdOf(details?.subscription) ??
    // Pre-2025 invoices referenced the subscription at the root.
    stripeIdOf(record?.subscription)
  );
}
