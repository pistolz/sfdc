/**
 * Date and number formatting.
 *
 * Everything is pinned to en-US/UTC so a value rendered on the server matches
 * the one React produces during hydration — otherwise timestamps flicker and
 * throw hydration mismatches.
 */

const DATE = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const DATE_TIME = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

export function formatDate(epochMs: number): string {
  if (!epochMs) return "—";
  return DATE.format(new Date(epochMs));
}

export function formatDateTime(epochMs: number): string {
  if (!epochMs) return "—";
  return DATE_TIME.format(new Date(epochMs));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(value));
}

/** Whole days from now until an epoch timestamp, floored at zero. */
export function daysUntil(epochMs: number, now = Date.now()): number {
  if (!epochMs) return 0;
  return Math.max(0, Math.ceil((epochMs - now) / 86_400_000));
}

export function pluralise(count: number, one: string, many?: string): string {
  return count === 1 ? one : (many ?? `${one}s`);
}
