/** Hall layout: rows of 9 cabinets, the founder (#0001) front-centre, numbers fanning outwards. */
export const COLS = 9;
export const SPACING = 1.62;
export const ROW_GAP = 4.2;
const ORDER = [0, -1, 1, -2, 2, -3, 3, -4, 4];

export interface Slot { x: number; z: number; rot: number; row: number }

export function slot(index: number): Slot {
  const row = Math.floor(index / COLS);
  const off = ORDER[index % COLS];
  const x = off * SPACING;
  // rows curve gently towards the viewer, cabinets turn slightly inwards
  const z = -row * ROW_GAP - 0.045 * x * x;
  return { x, z, rot: -Math.atan2(x, 20), row };
}
export const rowsFor = (count: number) => Math.max(1, Math.ceil(count / COLS));
export const hallDepth = (count: number) => rowsFor(count) * ROW_GAP;
export const pad = (n: number) => `#${String(n).padStart(4, "0")}`;
