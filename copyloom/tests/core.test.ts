import test from "node:test";
import assert from "node:assert/strict";

import { creditsForUsage, weightedTokens, estimateCredits } from "../src/lib/credits";
import {
  GENERATORS,
  getGenerator,
  validateInputs,
  deriveTitle,
  brandBlock,
} from "../src/lib/generators";
import { parseBrandInput } from "../src/lib/validate";
import { PLANS, PLAN_ORDER, planFor, isPlanId, BRAND_LIMIT } from "../src/lib/plans";
import type { BrandKit } from "../src/lib/types";

/* ------------------------------- credits -------------------------------- */

test("weights output tokens 8x input", () => {
  assert.equal(weightedTokens({ input_tokens: 1000, output_tokens: 0 }), 1000);
  assert.equal(weightedTokens({ input_tokens: 0, output_tokens: 1000 }), 8000);
});

test("cache reads are far cheaper than fresh input", () => {
  const fresh = weightedTokens({ input_tokens: 10000 });
  const cached = weightedTokens({ input_tokens: 0, cache_read_input_tokens: 10000 });
  assert.ok(cached < fresh / 5, "cached input should cost roughly a tenth");
});

test("every generation costs at least one credit", () => {
  assert.equal(creditsForUsage({ input_tokens: 1, output_tokens: 1 }), 1);
  assert.equal(creditsForUsage({}), 1);
});

test("a typical generation lands in a sane credit range", () => {
  // ~2k in, ~1.5k out is a representative newsletter run.
  const credits = creditsForUsage({ input_tokens: 2000, output_tokens: 1500 });
  assert.equal(credits, 14);
  // The free tier should therefore be worth a meaningful number of runs.
  assert.ok(PLANS.free.credits / credits >= 14);
});

test("missing usage fields are treated as zero rather than NaN", () => {
  const credits = creditsForUsage({ input_tokens: null, output_tokens: undefined });
  assert.ok(Number.isFinite(credits));
});

test("estimates scale with the output ceiling", () => {
  assert.ok(estimateCredits(32000) > estimateCredits(8000));
});

/* ------------------------------- plans ---------------------------------- */

test("plan catalog is internally consistent", () => {
  for (const id of PLAN_ORDER) {
    const plan = PLANS[id];
    assert.equal(plan.id, id);
    assert.ok(plan.credits > 0, `${id} grants credits`);
    assert.ok(plan.features.length > 0, `${id} lists features`);
    assert.ok(id in BRAND_LIMIT, `${id} has a brand limit`);
  }
});

test("paid plans give strictly more credits as they get more expensive", () => {
  for (let i = 1; i < PLAN_ORDER.length; i++) {
    const prev = PLANS[PLAN_ORDER[i - 1]];
    const next = PLANS[PLAN_ORDER[i]];
    assert.ok(next.price > prev.price, `${next.id} costs more than ${prev.id}`);
    assert.ok(next.credits > prev.credits, `${next.id} grants more than ${prev.id}`);
  }
});

test("only the free plan lacks a Stripe price binding", () => {
  assert.equal(PLANS.free.priceEnvVar, undefined);
  for (const id of PLAN_ORDER.filter((p) => p !== "free")) {
    assert.ok(PLANS[id].priceEnvVar, `${id} maps to a Stripe price`);
  }
});

test("unknown plan ids fall back to free rather than throwing", () => {
  assert.equal(planFor("enterprise").id, "free");
  assert.equal(planFor(undefined).id, "free");
  assert.equal(isPlanId("pro"), true);
  assert.equal(isPlanId("nope"), false);
});

/* ----------------------------- generators ------------------------------- */

test("generator ids are unique and resolvable", () => {
  const ids = GENERATORS.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.ok(getGenerator(id));
  assert.equal(getGenerator("does-not-exist"), null);
});

test("every generator is fully specified", () => {
  for (const g of GENERATORS) {
    assert.ok(g.name && g.blurb && g.icon, `${g.id} has display metadata`);
    assert.ok(g.maxTokens >= 4000, `${g.id} has room to answer`);
    assert.ok(g.fields.length > 0, `${g.id} takes input`);
    assert.ok(
      g.fields.some((f) => f.required),
      `${g.id} has at least one required field`,
    );
    for (const field of g.fields) {
      if (field.type === "select") {
        assert.ok(field.options?.length, `${g.id}.${field.name} lists options`);
      }
    }
  }
});

test("required fields are enforced", () => {
  const newsletter = getGenerator("newsletter")!;
  const missing = validateInputs(newsletter, {});
  assert.equal(missing.ok, false);

  const ok = validateInputs(newsletter, {
    topic: "We shipped scheduled reports",
    goal: "Announce a feature",
    length: "Standard (350-500 words)",
  });
  assert.equal(ok.ok, true);
});

test("select fields reject values that are not on the list", () => {
  const newsletter = getGenerator("newsletter")!;
  const result = validateInputs(newsletter, {
    topic: "x",
    goal: "Delete the database",
    length: "Standard (350-500 words)",
  });
  assert.equal(result.ok, false);
});

test("oversized input is rejected before it can reach a prompt", () => {
  const newsletter = getGenerator("newsletter")!;
  const result = validateInputs(newsletter, {
    topic: "x".repeat(5001),
    goal: "Announce a feature",
    length: "Standard (350-500 words)",
  });
  assert.equal(result.ok, false);
});

test("unknown keys are dropped rather than passed through", () => {
  const newsletter = getGenerator("newsletter")!;
  const result = validateInputs(newsletter, {
    topic: "x",
    goal: "Announce a feature",
    length: "Standard (350-500 words)",
    isAdmin: "true",
  });
  assert.equal(result.ok, true);
  if (result.ok) assert.equal("isAdmin" in result.inputs, false);
});

test("generated instructions embed the user's brief", () => {
  const newsletter = getGenerator("newsletter")!;
  const instruction = newsletter.instruction({
    topic: "Scheduled reports",
    goal: "Announce a feature",
    length: "Standard (350-500 words)",
    notes: "Mention the Monday meeting",
  });
  assert.match(instruction, /Scheduled reports/);
  assert.match(instruction, /Monday meeting/);
});

test("titles are derived and length-capped", () => {
  const newsletter = getGenerator("newsletter")!;
  const long = deriveTitle(newsletter, { topic: "a".repeat(200) });
  assert.ok(long.length <= 70);
  assert.match(deriveTitle(newsletter, { topic: "Launch week" }), /Launch week/);
});

test("brand context degrades gracefully when no kit exists", () => {
  const block = brandBlock(null);
  assert.match(block, /No brand kit/);
  assert.doesNotMatch(block, /undefined/);
});

test("brand context includes only the fields that were filled in", () => {
  const brand: BrandKit = {
    id: "b1",
    name: "Northwind Clinic Software",
    website: "",
    oneLiner: "Scheduling for small clinics",
    audience: "Practice managers",
    tone: "Plain and direct",
    valueProps: "",
    differentiators: "",
    bannedWords: "synergy",
    exampleCopy: "",
    defaultCta: "Start free trial",
    createdAt: 0,
    updatedAt: 0,
  };
  const block = brandBlock(brand);
  assert.match(block, /Northwind Clinic Software/);
  assert.match(block, /Never use these words or phrases: synergy/);
  assert.doesNotMatch(block, /Website:/, "empty fields are omitted entirely");
  assert.doesNotMatch(block, /undefined/);
});

/* ------------------------------ brand input ------------------------------ */

test("brand input requires a name", () => {
  assert.equal(parseBrandInput({}).ok, false);
  assert.equal(parseBrandInput({ name: "  " }).ok, false);
  assert.equal(parseBrandInput({ name: "Acme" }).ok, true);
});

test("brand input strips unknown keys and trims values", () => {
  const result = parseBrandInput({ name: "  Acme  ", plan: "agency", credits: 999999 });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.name, "Acme");
    assert.equal("plan" in result.value, false);
    assert.equal("credits" in result.value, false);
  }
});

test("brand input rejects non-string and oversized values", () => {
  assert.equal(parseBrandInput({ name: "Acme", tone: 42 }).ok, false);
  assert.equal(parseBrandInput({ name: "Acme", oneLiner: "x".repeat(4001) }).ok, false);
  assert.equal(parseBrandInput({ name: "Acme", exampleCopy: "x".repeat(4001) }).ok, true);
});

test("plan lookup is not fooled by inherited object keys", () => {
  // `"constructor" in PLANS` is true via the prototype chain; the guard must
  // not let that through as a plan.
  for (const key of ["constructor", "toString", "hasOwnProperty", "__proto__"]) {
    assert.equal(isPlanId(key), false, `${key} is not a plan id`);
    assert.equal(planFor(key).id, "free", `${key} falls back to free`);
    assert.ok(Array.isArray(planFor(key).features));
  }
});

test("advertised generation counts match what a generation actually costs", () => {
  // The pricing page shows "~N generations" per plan. Those strings drifted
  // silently when the credit weighting changed for a different model, so this
  // ties them back to the real cost of a representative run.
  const perRun = creditsForUsage({ input_tokens: 2000, output_tokens: 1500 });
  for (const id of PLAN_ORDER) {
    const plan = PLANS[id];
    const advertised = plan.features
      .map((f) => /~([\d,]+)\s+generations/.exec(f))
      .find((m) => m !== null);
    assert.ok(advertised, `${id} advertises a generation count`);

    const claimed = Number(advertised[1].replace(/,/g, ""));
    const actual = plan.credits / perRun;
    // Allow rounding to a friendly number, but not a misleading one.
    assert.ok(
      Math.abs(claimed - actual) / actual <= 0.05,
      `${id} claims ~${claimed} generations but ${plan.credits} credits at ${perRun}/run gives ${actual.toFixed(0)}`,
    );
  }
});
