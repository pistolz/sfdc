import { EMPTY_BRAND, type BrandKitInput } from "./types";

const MAX_FIELD = 4000;
const MAX_EXAMPLE = 8000;

/**
 * Coerces untrusted request input into a BrandKitInput.
 *
 * Unknown keys are dropped rather than merged, so a client cannot smuggle extra
 * fields into the stored document, and every value is length-capped before it
 * can reach a prompt.
 */
export function parseBrandInput(
  raw: unknown,
): { ok: true; value: BrandKitInput } | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "Expected a brand object." };
  }
  const source = raw as Record<string, unknown>;
  const value = { ...EMPTY_BRAND };

  for (const key of Object.keys(EMPTY_BRAND) as (keyof BrandKitInput)[]) {
    const incoming = source[key];
    if (incoming === undefined || incoming === null) continue;
    if (typeof incoming !== "string") {
      return { ok: false, error: `"${key}" must be text.` };
    }
    const limit = key === "exampleCopy" ? MAX_EXAMPLE : MAX_FIELD;
    if (incoming.length > limit) {
      return { ok: false, error: `"${key}" is too long (max ${limit} characters).` };
    }
    value[key] = incoming.trim();
  }

  if (!value.name) {
    return { ok: false, error: "A brand name is required." };
  }
  return { ok: true, value };
}
