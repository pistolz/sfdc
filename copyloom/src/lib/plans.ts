/**
 * Plan catalog.
 *
 * Credits are the user-facing unit of consumption. One credit is billed per
 * 1,000 "weighted tokens", where weighted = input + 5 x output. The 5x factor
 * mirrors Claude's output:input price ratio, so a credit maps to a roughly
 * constant real cost regardless of whether a generation is prompt-heavy or
 * output-heavy.
 *
 * At Opus-tier pricing one credit costs on the order of half a cent to serve,
 * so the allowances below leave roughly a 70% gross margin. Retune
 * `credits` here if you change model or pricing; nothing else needs to move.
 *
 * A typical single generation (~2k in, ~1.5k out) costs about 10 credits.
 */

export type PlanId = "free" | "starter" | "pro" | "agency";

export interface Plan {
  id: PlanId;
  name: string;
  /** Monthly price in USD. 0 for the free tier. */
  price: number;
  /** Credits granted at the start of each billing period. */
  credits: number;
  /** Env var holding the Stripe price ID. Absent for the free tier. */
  priceEnvVar?: string;
  blurb: string;
  features: string[];
  highlight?: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    credits: 200,
    blurb: "Kick the tyres on your own brand voice.",
    features: [
      "200 credits per month (~20 generations)",
      "1 brand kit",
      "All 8 content generators",
      "Asset library",
    ],
  },
  starter: {
    id: "starter",
    name: "Starter",
    price: 29,
    credits: 1500,
    priceEnvVar: "STRIPE_PRICE_STARTER",
    blurb: "For solo founders and one-person marketing teams.",
    features: [
      "1,500 credits per month (~150 generations)",
      "3 brand kits",
      "All 8 content generators",
      "Export to HTML, Markdown and plain text",
      "Email support",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 99,
    credits: 6000,
    priceEnvVar: "STRIPE_PRICE_PRO",
    blurb: "For marketers shipping campaigns every week.",
    features: [
      "6,000 credits per month (~600 generations)",
      "10 brand kits",
      "All 8 content generators",
      "Campaign builder (multi-asset briefs)",
      "Priority email support",
    ],
    highlight: true,
  },
  agency: {
    id: "agency",
    name: "Agency",
    price: 299,
    credits: 20000,
    priceEnvVar: "STRIPE_PRICE_AGENCY",
    blurb: "For agencies running many client brands at once.",
    features: [
      "20,000 credits per month (~2,000 generations)",
      "Unlimited brand kits",
      "All 8 content generators",
      "Campaign builder (multi-asset briefs)",
      "Priority support",
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ["free", "starter", "pro", "agency"];

/** Brand-kit cap per plan. -1 means unlimited. */
export const BRAND_LIMIT: Record<PlanId, number> = {
  free: 1,
  starter: 3,
  pro: 10,
  agency: -1,
};

export function isPlanId(value: unknown): value is PlanId {
  // hasOwnProperty, not `in`: `"constructor" in PLANS` is true via the
  // prototype chain, which would let junk input resolve to Object's
  // constructor and flow onward as if it were a Plan.
  return (
    typeof value === "string" && Object.prototype.hasOwnProperty.call(PLANS, value)
  );
}

export function planFor(id: unknown): Plan {
  return isPlanId(id) ? PLANS[id] : PLANS.free;
}

/** Resolve the Stripe price ID for a paid plan, or null if unconfigured. */
export function stripePriceId(planId: PlanId): string | null {
  const envVar = PLANS[planId].priceEnvVar;
  if (!envVar) return null;
  return process.env[envVar] || null;
}

/** Reverse lookup used by the Stripe webhook to map a price back to a plan. */
export function planIdForStripePrice(priceId: string): PlanId | null {
  for (const id of PLAN_ORDER) {
    if (stripePriceId(id) === priceId) return id;
  }
  return null;
}
