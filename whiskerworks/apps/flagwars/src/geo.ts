import type { GeoData, GeoCountry } from "./types";

const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** Unit vector of Fibonacci point `i` of `n`, in globe space (y = north, east to the right when seen from outside). */
export function fibVector(i: number, n: number, out: [number, number, number] = [0, 0, 0]): [number, number, number] {
  const y = 1 - (2 * (i + 0.5)) / n;
  const r = Math.sqrt(1 - y * y);
  const t = GOLDEN * i;
  out[0] = Math.cos(t) * r;
  out[1] = y;
  out[2] = -Math.sin(t) * r; // mirrored so longitude grows eastward on screen
  return out;
}

export interface Hex { point: number; owner: number; v: [number, number, number] }
export interface World {
  N: number;
  hexes: Hex[];
  countries: GeoCountry[];
  byCode: Map<string, { index: number; country: GeoCountry; anchor: [number, number, number]; hexIds: number[] }>;
}

export function decodeWorld(g: GeoData): World {
  const hexes: Hex[] = [];
  let p = 0;
  for (let k = 0; k < g.points.length; k++) {
    p = k === 0 ? g.points[0] : p + g.points[k];
    hexes.push({ point: p, owner: g.owner[k], v: fibVector(p, g.N) });
  }
  const byCode: World["byCode"] = new Map();
  g.countries.forEach((country, index) => {
    const anchor = fibVector(country.anchor, g.N);
    const ids: number[] = [];
    hexes.forEach((h, i) => { if (h.owner === index) ids.push(i); });
    // sort by distance from the flag so conquest spreads outward
    // angular distance + smooth noise → organic, blobby borders instead of perfect circles
    const key = new Map<number, number>();
    for (const i of ids) {
      const v = hexes[i].v;
      const cos = Math.min(1, v[0] * anchor[0] + v[1] * anchor[1] + v[2] * anchor[2]);
      const noise = Math.sin(v[0] * 23 + v[1] * 7) * Math.sin(v[1] * 19 - v[2] * 11) + 0.5 * Math.sin(v[2] * 41 + v[0] * 29);
      key.set(i, Math.acos(cos) * (1 + 0.17 * noise));
    }
    ids.sort((a, b) => key.get(a)! - key.get(b)!);
    byCode.set(country.code, { index, country, anchor, hexIds: ids });
  });
  return { N: g.N, hexes, countries: g.countries, byCode };
}

export function flagEmoji(code: string): string {
  if (!/^[A-Z]{2}$/.test(code) || code === "XK") return "🏳️";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
