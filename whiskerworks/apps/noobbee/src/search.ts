export interface SearchItem { kind: "level" | "handle"; key: string; label: string; sub: string; terms: string[] }

export const normalize = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/^@+/, "").trim();

function lev(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      rowMin = Math.min(rowMin, cur[j]);
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length];
}

/** Ranked matches: exact > prefix > word-prefix > substring > typo-tolerant ("Did you mean"). Handles win ties. */
export function search(items: SearchItem[], q: string, limit = 8): { results: SearchItem[]; didYouMean: SearchItem | null } {
  const raw = q.trim();
  const n = normalize(raw);
  if (!n) return { results: [], didYouMean: null };
  const wantsHandle = raw.startsWith("@");
  const level = /^(lv|level|#)?\s*(\d+)$/i.exec(raw);
  const scored: [number, SearchItem][] = [];
  for (const it of items) {
    if (wantsHandle && it.kind !== "handle") continue;
    let best = 0;
    if (level && it.kind === "level" && it.key === level[2]) best = 120;
    for (const t of it.terms) {
      if (t === n) best = Math.max(best, 100);
      else if (t.startsWith(n)) best = Math.max(best, 80 - Math.min(20, t.length - n.length));
      else if (t.split(/[\s._-]+/).some((w) => w.startsWith(n))) best = Math.max(best, 55);
      else if (n.length >= 2 && t.includes(n)) best = Math.max(best, 40);
    }
    if (best) scored.push([best + (it.kind === "handle" ? 2 : 0) - (it.kind === "level" ? Number(it.key) / 1e6 : 0), it]);
  }
  scored.sort((a, b) => b[0] - a[0] || a[1].label.localeCompare(b[1].label));
  let didYouMean: SearchItem | null = null;
  if (!scored.length && n.length >= 3) {
    let bd = Infinity;
    const max = n.length <= 5 ? 1 : n.length <= 9 ? 2 : 3;
    for (const it of items) {
      if (wantsHandle && it.kind !== "handle") continue;
      for (const t of it.terms) {
        const d = lev(n, t.slice(0, Math.max(n.length, t.length)), max);
        if (d < bd || (d === bd && it.kind === "handle" && didYouMean?.kind !== "handle")) { bd = d; didYouMean = it; }
      }
    }
    if (bd > max) didYouMean = null;
  }
  return { results: scored.slice(0, limit).map((s) => s[1]), didYouMean };
}
