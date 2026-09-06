import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import test from "node:test";

/*
 * These tests run under `node --test --experimental-strip-types`, whose ESM
 * resolver (unlike the Next bundler) requires explicit file extensions. The
 * hook below re-adds the `.ts` extension for the app's own relative imports so
 * `src/lib/stripe.ts` can be loaded directly. Nothing else is stubbed: every
 * function exercised here is pure, so there is no network and no Firestore.
 */
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      // Only retry our own extensionless relative imports; anything else
      // (a genuinely missing dependency) keeps its original error.
      if (specifier.startsWith(".")) return nextResolve(`${specifier}.ts`, context);
      throw error;
    }
  },
});

const PRICES = {
  STRIPE_PRICE_STARTER: "price_starter_test",
  STRIPE_PRICE_PRO: "price_pro_test",
  STRIPE_PRICE_AGENCY: "price_agency_test",
} as const;

for (const [name, value] of Object.entries(PRICES)) {
  process.env[name] = value;
}

const { isPlanId, PLAN_ORDER, planIdForStripePrice, stripePriceId } =
  await import("../src/lib/plans");
type PlanId = import("../src/lib/plans").PlanId;
const {
  invoiceLinePriceId,
  invoicePlan,
  invoiceSubscriptionId,
  isEntitlementEndingStatus,
  stripeIdOf,
  subscriptionPeriodEndMs,
  subscriptionPriceId,
  subscriptionStateFor,
} = await import("../src/lib/stripe");

/* -------------------------------------------------------------------------- */
/* Plan <-> Stripe price mapping                                               */
/* -------------------------------------------------------------------------- */

test("every paid plan round-trips price ID -> plan ID", () => {
  for (const planId of PLAN_ORDER) {
    const priceId = stripePriceId(planId);
    if (planId === "free") {
      assert.equal(priceId, null, "the free plan has no Stripe price");
      continue;
    }
    assert.ok(priceId, `${planId} should have a configured price`);
    assert.equal(planIdForStripePrice(priceId), planId);
  }
});

test("prices resolve to the configured env values", () => {
  assert.equal(stripePriceId("starter"), PRICES.STRIPE_PRICE_STARTER);
  assert.equal(stripePriceId("pro"), PRICES.STRIPE_PRICE_PRO);
  assert.equal(stripePriceId("agency"), PRICES.STRIPE_PRICE_AGENCY);
});

test("unknown price IDs map to no plan", () => {
  assert.equal(planIdForStripePrice("price_not_ours"), null);
  assert.equal(planIdForStripePrice(""), null);
});

test("an unconfigured plan price yields null rather than a stale match", () => {
  const saved = process.env.STRIPE_PRICE_PRO;
  delete process.env.STRIPE_PRICE_PRO;
  try {
    assert.equal(stripePriceId("pro"), null);
    assert.equal(planIdForStripePrice(PRICES.STRIPE_PRICE_PRO), null);
  } finally {
    process.env.STRIPE_PRICE_PRO = saved;
  }
});

test("isPlanId rejects junk", () => {
  for (const junk of ["", "FREE", "enterprise", "starter "]) {
    assert.equal(isPlanId(junk), false, `${junk} is not a plan`);
  }
  for (const junk of [null, undefined, 0, 1, {}, [], { id: "pro" }]) {
    assert.equal(isPlanId(junk), false);
  }
  assert.equal(isPlanId("pro"), true);
});

test("inherited object keys can never resolve to a Stripe price", () => {
  /*
   * `isPlanId` is an `in` check, so keys inherited from Object.prototype
   * ("constructor", "toString", ...) currently pass it. Checkout stays safe
   * regardless because it only ever proceeds on a configured price ID, and no
   * prototype key has one — this test pins that second line of defence.
   */
  for (const inherited of ["constructor", "toString", "hasOwnProperty"]) {
    assert.equal(stripePriceId(inherited as PlanId), null, inherited);
    assert.equal(planIdForStripePrice(inherited), null);
  }
});

/* -------------------------------------------------------------------------- */
/* Subscription status -> stored state                                         */
/* -------------------------------------------------------------------------- */

test("live statuses keep the plan implied by the price", () => {
  for (const status of ["active", "trialing", "past_due", "incomplete"]) {
    assert.deepEqual(subscriptionStateFor(status, "pro"), {
      plan: "pro",
      status,
    });
  }
});

test("entitlement-ending statuses downgrade to free", () => {
  for (const status of ["canceled", "unpaid", "incomplete_expired"]) {
    assert.equal(isEntitlementEndingStatus(status), true);
    assert.deepEqual(subscriptionStateFor(status, "agency"), {
      plan: "free",
      status,
    });
  }
});

test("past_due keeps the paid plan", () => {
  assert.equal(isEntitlementEndingStatus("past_due"), false);
  assert.equal(subscriptionStateFor("past_due", "starter").plan, "starter");
});

test("an unrecognised price falls back to free, never to a guess", () => {
  assert.deepEqual(subscriptionStateFor("active", null), {
    plan: "free",
    status: "active",
  });
  assert.equal(subscriptionStateFor(null, null).plan, "free");
});

/* -------------------------------------------------------------------------- */
/* Defensive Stripe object readers                                             */
/* -------------------------------------------------------------------------- */

test("stripeIdOf accepts an ID or an expanded object", () => {
  assert.equal(stripeIdOf("cus_123"), "cus_123");
  assert.equal(stripeIdOf({ id: "cus_123" }), "cus_123");
  assert.equal(stripeIdOf(null), null);
  assert.equal(stripeIdOf(""), null);
  assert.equal(stripeIdOf({}), null);
  assert.equal(stripeIdOf(42), null);
});

test("period end reads the subscription item and converts to milliseconds", () => {
  const subscription = {
    id: "sub_1",
    items: { data: [{ current_period_end: 1_700_000_000, price: { id: "price_pro_test" } }] },
  };
  assert.equal(subscriptionPeriodEndMs(subscription), 1_700_000_000_000);
  assert.equal(subscriptionPriceId(subscription), "price_pro_test");
});

test("period end falls back to the legacy root field", () => {
  assert.equal(
    subscriptionPeriodEndMs({ items: { data: [] }, current_period_end: 1_700_000_000 }),
    1_700_000_000_000,
  );
});

test("period end degrades to null instead of throwing", () => {
  assert.equal(subscriptionPeriodEndMs(null), null);
  assert.equal(subscriptionPeriodEndMs({}), null);
  assert.equal(subscriptionPeriodEndMs({ items: {} }), null);
  assert.equal(subscriptionPeriodEndMs({ items: { data: [{}] } }), null);
  assert.equal(subscriptionPriceId({ items: { data: [{}] } }), null);
});

test("invoice line price is read from the 2025 pricing shape and the legacy one", () => {
  assert.equal(
    invoiceLinePriceId({ pricing: { price_details: { price: "price_pro_test" } } }),
    "price_pro_test",
  );
  assert.equal(invoiceLinePriceId({ price: { id: "price_pro_test" } }), "price_pro_test");
  assert.equal(invoiceLinePriceId({ pricing: null }), null);
  assert.equal(invoiceLinePriceId(undefined), null);
});

test("invoicePlan resolves the first line that maps to one of our plans", () => {
  const invoice = {
    lines: {
      data: [
        { pricing: { price_details: { price: "price_someone_elses" } }, period: { end: 1 } },
        {
          pricing: { price_details: { price: PRICES.STRIPE_PRICE_AGENCY } },
          period: { end: 1_700_000_000 },
        },
      ],
    },
  };
  assert.deepEqual(invoicePlan(invoice), {
    plan: "agency",
    periodEndMs: 1_700_000_000_000,
  });
});

test("invoicePlan yields no plan for invoices unrelated to our prices", () => {
  assert.deepEqual(invoicePlan({ lines: { data: [{ price: { id: "price_x" } }] } }), {
    plan: null,
    periodEndMs: null,
  });
  assert.deepEqual(invoicePlan({}), { plan: null, periodEndMs: null });
});

test("invoice subscription ID is read from parent details or the legacy root", () => {
  assert.equal(
    invoiceSubscriptionId({
      parent: { subscription_details: { subscription: "sub_new" } },
    }),
    "sub_new",
  );
  assert.equal(invoiceSubscriptionId({ subscription: "sub_old" }), "sub_old");
  assert.equal(invoiceSubscriptionId({ parent: null }), null);
});
