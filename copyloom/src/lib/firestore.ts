import "server-only";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "./firebase-admin";
import { BRAND_LIMIT, PLANS, planFor, type PlanId } from "./plans";
import { isBillingEnabled } from "./env";
import type {
  AccountView,
  Asset,
  BrandKit,
  BrandKitInput,
  UserRecord,
} from "./types";
import type { SessionUser } from "./session";

/** Free-tier credits refill on a rolling 30-day window. */
const FREE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/*
 * Every path below is rooted at users/{uid}, and every accessor takes the uid
 * from the verified session cookie rather than from request input. That is what
 * keeps tenants isolated: there is no code path where one user's uid can be
 * used to read another's subcollection.
 */
const userDoc = (uid: string) => db().collection("users").doc(uid);
const brandsCol = (uid: string) => userDoc(uid).collection("brands");
const assetsCol = (uid: string) => userDoc(uid).collection("assets");

/* -------------------------------------------------------------------------- */
/* Users                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Loads the account, creating it on first sign-in and refilling credits when a
 * free period has rolled over. Runs in a transaction so two concurrent requests
 * from a brand-new user cannot both grant a starting balance.
 */
export async function ensureUserRecord(user: SessionUser): Promise<UserRecord> {
  const ref = userDoc(user.uid);
  const now = Date.now();

  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);

    if (!snap.exists) {
      const record: UserRecord = {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        plan: "free",
        credits: PLANS.free.credits,
        creditsGranted: PLANS.free.credits,
        periodEnd: now + FREE_PERIOD_MS,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        subscriptionStatus: null,
        createdAt: now,
        updatedAt: now,
      };
      tx.set(ref, record);
      return record;
    }

    const record = snap.data() as UserRecord;

    // Refill free accounts when their window has elapsed. Paid periods are
    // driven by Stripe's invoice webhook; this is only a safety net for them.
    if (record.plan === "free" && now > record.periodEnd) {
      const grant = PLANS.free.credits;
      const updated: UserRecord = {
        ...record,
        credits: grant,
        creditsGranted: grant,
        periodEnd: now + FREE_PERIOD_MS,
        updatedAt: now,
      };
      tx.update(ref, {
        credits: grant,
        creditsGranted: grant,
        periodEnd: updated.periodEnd,
        updatedAt: now,
      });
      return updated;
    }

    // Keep the denormalised profile fields in step with the auth record.
    if (record.email !== user.email || record.displayName !== user.displayName) {
      tx.update(ref, {
        email: user.email,
        displayName: user.displayName,
        updatedAt: now,
      });
      return { ...record, email: user.email, displayName: user.displayName };
    }

    return record;
  });
}

export async function getUserRecord(uid: string): Promise<UserRecord | null> {
  const snap = await userDoc(uid).get();
  return snap.exists ? (snap.data() as UserRecord) : null;
}

export function toAccountView(record: UserRecord): AccountView {
  const plan = planFor(record.plan);
  return {
    uid: record.uid,
    email: record.email,
    displayName: record.displayName,
    plan: plan.id,
    planName: plan.name,
    credits: record.credits,
    creditsGranted: record.creditsGranted,
    periodEnd: record.periodEnd,
    subscriptionStatus: record.subscriptionStatus,
    hasSubscription: Boolean(record.stripeSubscriptionId),
    billingEnabled: isBillingEnabled(),
  };
}

/**
 * Atomically spends credits. Called after a generation completes, with the cost
 * derived from real token usage.
 *
 * The balance floors at zero rather than going negative: a single generation
 * can legitimately cost more than the user had left, and we would rather absorb
 * that overshoot once than present a negative balance.
 */
export async function debitCredits(uid: string, amount: number): Promise<number> {
  if (amount <= 0) {
    const record = await getUserRecord(uid);
    return record?.credits ?? 0;
  }
  const ref = userDoc(uid);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return 0;
    const current = (snap.data() as UserRecord).credits ?? 0;
    const next = Math.max(0, current - amount);
    tx.update(ref, { credits: next, updatedAt: Date.now() });
    return next;
  });
}

/** Records a usage event for the account's history. Best-effort. */
export async function recordUsage(
  uid: string,
  event: {
    generatorId: string;
    creditsUsed: number;
    inputTokens: number;
    outputTokens: number;
    assetId: string;
  },
): Promise<void> {
  await userDoc(uid)
    .collection("usage")
    .add({ ...event, createdAt: Date.now() });
}

/* -------------------------------------------------------------------------- */
/* Billing linkage                                                             */
/* -------------------------------------------------------------------------- */

export async function attachStripeCustomer(
  uid: string,
  customerId: string,
): Promise<void> {
  await userDoc(uid).update({
    stripeCustomerId: customerId,
    updatedAt: Date.now(),
  });
}

/** Resolves a Stripe customer back to an account for webhook handling. */
export async function findUidByStripeCustomer(
  customerId: string,
): Promise<string | null> {
  const snap = await db()
    .collection("users")
    .where("stripeCustomerId", "==", customerId)
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}

/**
 * Applies a subscription state change from Stripe.
 *
 * `resetCredits` is set when a new billing period starts (checkout completed or
 * an invoice was paid) so the allowance refills exactly once per period, rather
 * than on every subscription.updated event.
 */
export async function applySubscriptionState(
  uid: string,
  state: {
    plan: PlanId;
    status: string | null;
    subscriptionId: string | null;
    periodEnd: number | null;
    resetCredits: boolean;
  },
): Promise<void> {
  const now = Date.now();
  const update: Record<string, unknown> = {
    plan: state.plan,
    subscriptionStatus: state.status,
    stripeSubscriptionId: state.subscriptionId,
    updatedAt: now,
  };
  if (state.periodEnd) update.periodEnd = state.periodEnd;
  if (state.resetCredits) {
    const grant = PLANS[state.plan].credits;
    update.credits = grant;
    update.creditsGranted = grant;
  }
  await userDoc(uid).update(update);
}

/**
 * Marks a Stripe event as seen. Returns false if it was already processed.
 *
 * Stripe retries webhooks and can deliver the same event more than once; without
 * this a retry of `invoice.paid` would grant a second month of credits.
 */
export async function claimStripeEvent(eventId: string): Promise<boolean> {
  const ref = db().collection("stripeEvents").doc(eventId);
  try {
    await ref.create({ processedAt: Date.now() });
    return true;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Brand kits                                                                  */
/* -------------------------------------------------------------------------- */

export async function listBrands(uid: string): Promise<BrandKit[]> {
  const snap = await brandsCol(uid).orderBy("createdAt", "asc").get();
  return snap.docs.map((d) => ({ ...(d.data() as Omit<BrandKit, "id">), id: d.id }));
}

export async function getBrand(uid: string, id: string): Promise<BrandKit | null> {
  const snap = await brandsCol(uid).doc(id).get();
  if (!snap.exists) return null;
  return { ...(snap.data() as Omit<BrandKit, "id">), id: snap.id };
}

export async function createBrand(
  uid: string,
  plan: PlanId,
  input: BrandKitInput,
): Promise<{ ok: true; brand: BrandKit } | { ok: false; error: string }> {
  const limit = BRAND_LIMIT[plan];
  if (limit !== -1) {
    const existing = await brandsCol(uid).count().get();
    if (existing.data().count >= limit) {
      return {
        ok: false,
        error: `Your ${PLANS[plan].name} plan includes ${limit} brand kit${limit === 1 ? "" : "s"}. Upgrade to add more.`,
      };
    }
  }
  const now = Date.now();
  const ref = await brandsCol(uid).add({ ...input, createdAt: now, updatedAt: now });
  return { ok: true, brand: { ...input, id: ref.id, createdAt: now, updatedAt: now } };
}

export async function updateBrand(
  uid: string,
  id: string,
  input: BrandKitInput,
): Promise<BrandKit | null> {
  const ref = brandsCol(uid).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return null;
  const now = Date.now();
  await ref.update({ ...input, updatedAt: now });
  const existing = snap.data() as BrandKit;
  return { ...input, id, createdAt: existing.createdAt, updatedAt: now };
}

export async function deleteBrand(uid: string, id: string): Promise<void> {
  await brandsCol(uid).doc(id).delete();
}

/* -------------------------------------------------------------------------- */
/* Assets                                                                      */
/* -------------------------------------------------------------------------- */

export async function createAsset(
  uid: string,
  asset: Omit<Asset, "id">,
): Promise<string> {
  const ref = await assetsCol(uid).add(asset);
  return ref.id;
}

export async function listAssets(
  uid: string,
  options: { limit?: number; before?: number } = {},
): Promise<Asset[]> {
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);
  let query = assetsCol(uid).orderBy("createdAt", "desc").limit(limit);
  if (options.before) query = query.startAfter(options.before);
  const snap = await query.get();
  return snap.docs.map((d) => ({ ...(d.data() as Omit<Asset, "id">), id: d.id }));
}

export async function getAsset(uid: string, id: string): Promise<Asset | null> {
  const snap = await assetsCol(uid).doc(id).get();
  if (!snap.exists) return null;
  return { ...(snap.data() as Omit<Asset, "id">), id: snap.id };
}

export async function deleteAsset(uid: string, id: string): Promise<void> {
  await assetsCol(uid).doc(id).delete();
}

export async function countAssets(uid: string): Promise<number> {
  const snap = await assetsCol(uid).count().get();
  return snap.data().count;
}

export { FieldValue };
