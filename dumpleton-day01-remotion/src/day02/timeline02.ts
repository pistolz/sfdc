// Day 02 timing — everything comes from data/timeline_day02.json (word timestamps measured on day02_mix.wav,
// text = the official script). frame = t * 30.
import TL from "../data/timeline_day02.json";
import type { Word } from "../timeline";

export const TOTAL2: number = TL.total; // 112.55 s
export const DURATION2 = Math.round(TOTAL2 * 30); // 3377 frames
type Marks2 = Record<
  | "hook" | "yesterday" | "boats" | "welcome" | "crowd" | "lizz" | "vip3r" | "rule3" | "comment" | "alloc" | "builds" | "sunset"
  | "done" | "listen" | "eyes" | "imps" | "torches" | "fight" | "ran" | "reflect" | "morning" | "carly" | "cta" | "end" | "twist",
  [number, number]
>;
export const M2 = TL.marks as unknown as Marks2;
export const WORDS2 = TL.words as unknown as Word[];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9']/g, "");
/** first word (normalised) starting at/after `after` */
export const wt2 = (word: string, after = 0): number => {
  for (const [w, a] of WORDS2) if (norm(w) === word && a >= after - 1e-3) return a;
  throw new Error(`Day02 word not found: ${word} after ${after}`);
};

// key beats
export const B = {
  river: wt2("river"),
  boats: wt2("boats"),
  yesterday: wt2("yesterday"),
  n272: wt2("272"),
  steamer: wt2("steamer"),
  boat1: wt2("one", 12),
  boat2: wt2("two", 13),
  boat3: wt2("three", 14),
  welcome: wt2("welcome"),
  findMe: wt2("find"),
  lizz: wt2("lizz"),
  hired: wt2("hired"),
  vip3r: wt2("vip3r"),
  done1: wt2("done"),
  rule3: wt2("rule"),
  most: wt2("most"),
  sphinx: wt2("sphinx"),
  likes: wt2("likes"),
  casino: wt2("casino"),
  buildIt: wt2("build"),
  n150: wt2("150"),
  n40: wt2("40"),
  jordan: wt2("jordan"),
  scientist: wt2("scientist"),
  iker: wt2("iker's"),
  cannons: wt2("cannons"),
  avnish: wt2("avnish's"),
  sunny: wt2("sunny"),
  witch: wt2("witch", 49),
  food: wt2("food"),
  sunDown: wt2("sun's"),
  casinoUp: wt2("casino", 55),
  wallUp: wt2("wall", 55.5),
  lastRoof: wt2("roof"),
  done2: wt2("done", 57),
  wait: wt2("wait"),
  listen: wt2("listen"),
  red: wt2("red"),
  chili: wt2("chili"),
  north: wt2("north", 65),
  south2: wt2("south", 68),
  torches: wt2("torches"),
  burning: wt2("burning"),
  bao: wt2("bao"),
  knights: wt2("knights"),
  push: wt2("push"),
  ran: wt2("ran"),
  counting: wt2("counting"),
  morning: wt2("morning"),
  n23: wt2("23"),
  carly: wt2("carly's"),
  n98: wt2("98"),
  same: wt2("same"),
  oneFollow: wt2("one", 98),
  most2: wt2("most", 100),
  bakery: wt2("bakery"),
  bridge: wt2("bridge"),
  southWall: wt2("south", 105),
  decide: wt2("decide"),
  day3: wt2("day", 108),
  now: wt2("now"),
  wait2: wt2("wait", 109),
  two2: wt2("two", 111),
};

/** beats that shake the camera / split RGB (the twist reveal) */
export const STEPS2 = [B.wait2, B.two2];
