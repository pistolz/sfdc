import type { PlanId } from "./plans";

/** A user's stored brand context, injected into every generation. */
export interface BrandKit {
  id: string;
  name: string;
  website: string;
  oneLiner: string;
  audience: string;
  tone: string;
  valueProps: string;
  differentiators: string;
  bannedWords: string;
  exampleCopy: string;
  defaultCta: string;
  createdAt: number;
  updatedAt: number;
}

export type BrandKitInput = Omit<BrandKit, "id" | "createdAt" | "updatedAt">;

export const EMPTY_BRAND: BrandKitInput = {
  name: "",
  website: "",
  oneLiner: "",
  audience: "",
  tone: "",
  valueProps: "",
  differentiators: "",
  bannedWords: "",
  exampleCopy: "",
  defaultCta: "",
};

/** A generated piece of content. */
export interface Asset {
  id: string;
  generatorId: string;
  title: string;
  content: string;
  format: "markdown" | "html";
  brandId: string | null;
  inputs: Record<string, string>;
  creditsUsed: number;
  createdAt: number;
}

/** The account record backing every request. */
export interface UserRecord {
  uid: string;
  email: string;
  displayName: string;
  plan: PlanId;
  /** Credits remaining in the current period. */
  credits: number;
  /** Credits granted at the start of the current period. */
  creditsGranted: number;
  /** Epoch ms when the current period ends and credits refill. */
  periodEnd: number;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionStatus: string | null;
  createdAt: number;
  updatedAt: number;
}

/** Serialisable view of the account sent to the browser. */
export interface AccountView {
  uid: string;
  email: string;
  displayName: string;
  plan: PlanId;
  planName: string;
  credits: number;
  creditsGranted: number;
  periodEnd: number;
  subscriptionStatus: string | null;
  hasSubscription: boolean;
  billingEnabled: boolean;
}
