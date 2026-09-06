/**
 * Usage metering.
 *
 * Credits are charged against real token usage rather than a flat per-generation
 * fee, so a one-line social post costs a fraction of a full landing page and the
 * unit economics hold no matter what mix of generators people use.
 *
 * weighted = input + 8 x output, because Gemini 2.5 Pro on Vertex bills roughly
 * $1.25 per 1M input tokens against ~$10 per 1M output — an 8:1 ratio. At those
 * rates 1000 weighted tokens is on the order of a tenth of a cent, so a credit
 * is cheap enough to hand out generously and still price well above cost.
 *
 * The cache weights are kept for callers that report cache tokens, but the Gen
 * AI SDK folds implicitly cached input into `promptTokenCount` rather than
 * splitting it out, so in practice today they stay zero.
 */

export const TOKENS_PER_CREDIT = 1000;
const OUTPUT_WEIGHT = 8;
const CACHE_WRITE_WEIGHT = 1.25;
const CACHE_READ_WEIGHT = 0.1;

export interface TokenUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export function weightedTokens(usage: TokenUsage): number {
  const input = usage.input_tokens ?? 0;
  const output = usage.output_tokens ?? 0;
  const cacheWrite = usage.cache_creation_input_tokens ?? 0;
  const cacheRead = usage.cache_read_input_tokens ?? 0;
  return (
    input +
    output * OUTPUT_WEIGHT +
    cacheWrite * CACHE_WRITE_WEIGHT +
    cacheRead * CACHE_READ_WEIGHT
  );
}

/** Credits to charge for one generation. Always at least 1 so nothing is free. */
export function creditsForUsage(usage: TokenUsage): number {
  const weighted = weightedTokens(usage);
  return Math.max(1, Math.ceil(weighted / TOKENS_PER_CREDIT));
}

/** Rough pre-flight estimate shown in the UI before a run. */
export function estimateCredits(maxTokens: number): number {
  // Assume a generation lands near half its output ceiling.
  return Math.max(1, Math.ceil((2000 + (maxTokens / 2) * OUTPUT_WEIGHT) / TOKENS_PER_CREDIT));
}
