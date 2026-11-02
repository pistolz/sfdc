// Arrival paths: cubic Bézier curves in the water plane (x, z).
import { berth as berthAt } from './layout.js';

export function bezier(P0, P1, P2, P3) {
  const at = (u) => {
    const a = 1 - u;
    return {
      x: a * a * a * P0[0] + 3 * a * a * u * P1[0] + 3 * a * u * u * P2[0] + u * u * u * P3[0],
      z: a * a * a * P0[1] + 3 * a * a * u * P1[1] + 3 * a * u * u * P2[1] + u * u * u * P3[1],
    };
  };
  const tangent = (u) => {
    const a = 1 - u;
    return {
      x: 3 * a * a * (P1[0] - P0[0]) + 6 * a * u * (P2[0] - P1[0]) + 3 * u * u * (P3[0] - P2[0]),
      z: 3 * a * a * (P1[1] - P0[1]) + 6 * a * u * (P2[1] - P1[1]) + 3 * u * u * (P3[1] - P2[1]),
    };
  };
  return {
    at,
    heading(u) {
      const d = tangent(Math.min(0.999, Math.max(0.001, u)));
      return Math.atan2(-d.z, d.x);
    },
  };
}

/** Path from the open sea to berth i, coming up the fairway beside the pier. */
export function berthPath(i, size) {
  const b = berthAt(i);
  const zStart = size.pierLength + 28;
  return bezier(
    [b.fairwayX, zStart],
    [b.fairwayX, b.z + 3.0],
    [b.x + b.side * 4.2, b.z],
    [b.x, b.z],
  );
}

/** Path from the sea to the VIP berth alongside the quay (ends bow-west). */
export function vipPath(vip, size) {
  const startX = vip.x + 16;
  return bezier(
    [startX, size.pierLength + 34],
    [startX, vip.z + 12],
    [vip.x + 14, vip.z],
    [vip.x, vip.z],
  );
}

/** Deceleration curve: fast arrival, gentle stop. */
export const arrivalEase = (s) => 1 - Math.pow(1 - Math.min(1, Math.max(0, s)), 2.4);
