// Marina layout: where every pier, berth and the VIP berth sit.
//
// Axes: +x = east (screen right), +z = south (towards the open sea / camera), y = up.
// The quay edge runs along z = 0; land is z < 0, water z > 0.
// Piers start at the quay and extend south. Yachts moor perpendicular to a pier
// (bow pointing at the pier), one berth per "row" on each side.
//
// Berth numbering is stable forever: berth i never moves when the marina grows,
// so a follower's yacht stays where it was parked on day 1.

export const PIERS = 5;
export const PIER_SPACING = 23;
export const PIER_WIDTH = 1.6;
export const ROW_SPACING = 3.4;
export const FIRST_ROW_Z = 4.2;
export const BOAT_OFFSET = 4.5; // pier centre → yacht centre
export const MIN_ROWS = 9;
export const QUAY_HEIGHT = 1.2;
export const PIER_HEIGHT = 0.75;

// Fill order: centre piers first so the marina grows symmetrically.
const PIER_ORDER = [2, 1, 3, 0, 4];

export const pierX = (p) => (p - (PIERS - 1) / 2) * PIER_SPACING;

export function berth(i) {
  const perRow = PIERS * 2;
  const row = Math.floor(i / perRow);
  const k = i % perRow;
  const pier = PIER_ORDER[k >> 1];
  const side = k & 1 ? 1 : -1;
  const px = pierX(pier);
  const x = px + side * BOAT_OFFSET;
  const z = FIRST_ROW_Z + row * ROW_SPACING;
  // Moored bow-in: bow points at the pier.
  const heading = side > 0 ? Math.PI : 0; // angle of the bow direction around +y (0 = +x)
  return { i, row, pier, side, x, z, heading, fairwayX: px + side * PIER_SPACING / 2 };
}

export function marinaSize(count) {
  const rows = Math.max(MIN_ROWS, Math.ceil(count / (PIERS * 2)) + 1);
  const pierLength = FIRST_ROW_Z + rows * ROW_SPACING;
  return {
    rows,
    pierLength,
    left: pierX(0) - PIER_SPACING / 2,
    right: pierX(PIERS - 1) + PIER_SPACING / 2,
  };
}

// VIP berth: alongside the quay, west of the first pier.
export function vipBerth() {
  const x = pierX(0) - PIER_SPACING / 2 - 15;
  return { x, z: 4.6, heading: Math.PI, length: 19 }; // bow pointing west
}
