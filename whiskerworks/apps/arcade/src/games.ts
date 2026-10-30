/**
 * The six looping retro mini-games shown on cabinet screens. Each draws one frame into a
 * (w × h) box at time t (seconds). The same functions feed the shared WebGL screen atlas
 * and the little live preview in the machine panel.
 */
export const GAMES = ["Pyramid Climb", "Stripe Bounce", "Night Drive", "Block Drop", "Neon Pong", "Rock Blaster"] as const;

type Draw = (c: CanvasRenderingContext2D, w: number, h: number, t: number) => void;

const frac = (x: number) => x - Math.floor(x);
const scan = (c: CanvasRenderingContext2D, w: number, h: number) => {
  c.fillStyle = "rgba(0,0,0,0.16)";
  for (let y = 0; y < h; y += 3) c.fillRect(0, y, w, 1);
};
const ball = (c: CanvasRenderingContext2D, x: number, y: number, r: number, col = "#e8f6ff") => {
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
  g.addColorStop(0, "#fff"); g.addColorStop(1, col);
  c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
};

const pyramid: Draw = (c, w, h, t) => {
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, "#0f4a4f"); g.addColorStop(1, "#06262b");
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.strokeStyle = "#5ff7ff"; c.lineWidth = Math.max(1.5, w / 90); c.shadowColor = "#5ff7ff"; c.shadowBlur = 6;
  const top = h * 0.12, base = h * 0.9;
  c.beginPath(); c.moveTo(w * 0.5, top); c.lineTo(w * 0.1, base); c.moveTo(w * 0.5, top); c.lineTo(w * 0.9, base); c.stroke();
  for (let i = 1; i <= 5; i++) {
    const y = top + (base - top) * (i / 5.6) + 6;
    const half = (y - top) / (base - top) * w * 0.4 + w * 0.08;
    c.beginPath(); c.moveTo(w * 0.5 - half, y); c.lineTo(w * 0.5 + half, y); c.stroke();
  }
  c.shadowBlur = 0;
  const p = frac(t / 3.2), y = base - (base - top - 18) * p;
  c.fillStyle = "#f2f2f2"; c.fillRect(w * 0.5 - w * 0.05, y - h * 0.11, w * 0.1, h * 0.11);
  c.fillStyle = "#ffcf3f";
  for (let i = 0; i < 3; i++) { const cy = top + (base - top) * (0.25 + i * 0.25); if (cy < y - 10) { c.beginPath(); c.arc(w * 0.5 + (i % 2 ? 12 : -10), cy, w * 0.025, 0, 7); c.fill(); } }
  ball(c, w * 0.32 + Math.sin(t * 2) * w * 0.05, base - 2, w * 0.07);
  scan(c, w, h);
};

const stripes: Draw = (c, w, h, t) => {
  c.fillStyle = "#1b1206"; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 5; i++) {
    const y = h * (0.18 + i * 0.16);
    c.fillStyle = i % 2 ? "#fff3cf" : "#ffc23d";
    c.beginPath();
    for (let x = 0; x <= w; x += 4) {
      const yy = y + Math.sin(x / w * 6 + t * 3 + i) * h * 0.035;
      x === 0 ? c.moveTo(x, yy) : c.lineTo(x, yy);
    }
    for (let x = w; x >= 0; x -= 4) c.lineTo(x, y + h * 0.07 + Math.sin(x / w * 6 + t * 3 + i + 0.6) * h * 0.035);
    c.fill();
  }
  const bx = w * (0.15 + 0.7 * Math.abs(Math.sin(t * 0.9))), by = h * (0.88 - 0.6 * Math.abs(Math.sin(t * 2.4)));
  ball(c, bx, by, w * 0.065, "#ffe7a3");
  scan(c, w, h);
};

const drive: Draw = (c, w, h, t) => {
  c.fillStyle = "#06140b"; c.fillRect(0, 0, w, h);
  const hz = h * 0.28;
  const g = c.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, "#0c3a1c"); g.addColorStop(1, "#2b8a4a");
  c.fillStyle = g; c.fillRect(0, 0, w, hz);
  c.fillStyle = "#0e2a16";
  c.beginPath(); c.moveTo(w * 0.47, hz); c.lineTo(w * 0.53, hz); c.lineTo(w * 0.98, h); c.lineTo(w * 0.02, h); c.fill();
  c.fillStyle = "#e9ffe9";
  for (let i = 0; i < 6; i++) {
    const p = frac(i / 6 + t * 0.7), y0 = hz + (h - hz) * p * p, y1 = hz + (h - hz) * Math.min(1, (p + 0.06) ** 2);
    const s = 0.004 + p * 0.02;
    c.fillRect(w * (0.5 - s), y0, w * s * 2, y1 - y0);
  }
  const cx = w * (0.5 + Math.sin(t * 1.3) * 0.18);
  c.fillStyle = "#4dff88"; c.shadowColor = "#4dff88"; c.shadowBlur = 8;
  c.fillRect(cx - w * 0.07, h * 0.72, w * 0.14, h * 0.16);
  c.shadowBlur = 0; c.fillStyle = "#0b2a14"; c.fillRect(cx - w * 0.045, h * 0.75, w * 0.09, h * 0.05);
  ball(c, w * 0.42, h * 0.9, w * 0.05);
  scan(c, w, h);
};

const BLOCK_COLS = ["#ff3df0", "#3df5ff", "#ffd23f", "#4dff88", "#ff8a3d", "#a07bff"];
const blocks: Draw = (c, w, h, t) => {
  c.fillStyle = "#0b0718"; c.fillRect(0, 0, w, h);
  const cell = w / 8;
  for (let r = 0; r < 4; r++) for (let k = 0; k < 8; k++) {
    if ((r * 3 + k * 5) % 7 === 0) continue;
    c.fillStyle = BLOCK_COLS[(r + k) % BLOCK_COLS.length];
    c.fillRect(k * cell + 1, h - (r + 1) * cell + 1, cell - 2, cell - 2);
  }
  const p = frac(t / 2.4), y = -cell * 2 + (h - cell * 5.5) * p, x = cell * (2 + Math.floor(frac(t / 7.2) * 4));
  c.fillStyle = BLOCK_COLS[Math.floor(t / 2.4) % BLOCK_COLS.length];
  for (const [dx, dy] of [[0, 0], [1, 0], [2, 0], [1, 1]]) c.fillRect(x + dx * cell + 1, y + dy * cell + 1, cell - 2, cell - 2);
  scan(c, w, h);
};

const pong: Draw = (c, w, h, t) => {
  c.fillStyle = "#080b1c"; c.fillRect(0, 0, w, h);
  c.strokeStyle = "rgba(160,123,255,.6)"; c.setLineDash([4, 5]); c.beginPath(); c.moveTo(w / 2, 0); c.lineTo(w / 2, h); c.stroke(); c.setLineDash([]);
  const p = frac(t / 1.8), dir = Math.floor(t / 1.8) % 2;
  const bx = w * (0.1 + 0.8 * (dir ? 1 - p : p)), by = h * (0.5 + 0.38 * Math.sin(t * 2.7));
  c.fillStyle = "#a07bff"; c.shadowColor = "#a07bff"; c.shadowBlur = 8;
  c.fillRect(w * 0.05, by - h * 0.14 + Math.sin(t * 3) * 6, w * 0.035, h * 0.28);
  c.fillRect(w * 0.915, by - h * 0.14 - Math.sin(t * 2.2) * 6, w * 0.035, h * 0.28);
  c.shadowBlur = 0;
  ball(c, bx, by, w * 0.04);
  c.fillStyle = "#cbb8ff"; c.font = `800 ${Math.round(h * 0.16)}px monospace`; c.textAlign = "center";
  c.fillText(String(3 + (Math.floor(t / 3.6) % 7)), w * 0.3, h * 0.2); c.fillText(String(2 + (Math.floor(t / 5) % 8)), w * 0.7, h * 0.2);
  scan(c, w, h);
};

const rocks: Draw = (c, w, h, t) => {
  c.fillStyle = "#14060c"; c.fillRect(0, 0, w, h);
  c.fillStyle = "#fff";
  for (let i = 0; i < 18; i++) c.fillRect(frac(i * 0.137) * w, frac(i * 0.371 + t * 0.05 * (1 + (i % 3))) * h, 1.5, 1.5);
  c.strokeStyle = "#ff8a3d"; c.lineWidth = Math.max(1.5, w / 80); c.shadowColor = "#ff8a3d"; c.shadowBlur = 6;
  for (let i = 0; i < 4; i++) {
    const x = frac(i * 0.29 + t * 0.06 * (i % 2 ? 1 : -1)) * w, y = frac(i * 0.43 + t * 0.09) * h * 0.7, r = w * (0.05 + (i % 3) * 0.025);
    c.beginPath();
    for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2 + t; const rr = r * (0.75 + 0.25 * Math.sin(k * 2.1 + i)); c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath(); c.stroke();
  }
  const sx = w * (0.5 + Math.sin(t * 1.1) * 0.3), sy = h * 0.82;
  c.strokeStyle = "#ffe1c4"; c.beginPath(); c.moveTo(sx, sy - h * 0.09); c.lineTo(sx - w * 0.05, sy + h * 0.05); c.lineTo(sx + w * 0.05, sy + h * 0.05); c.closePath(); c.stroke();
  c.shadowBlur = 0; c.fillStyle = "#ffd23f";
  const shot = frac(t * 1.6); c.fillRect(sx - 1, sy - h * 0.1 - shot * h * 0.6, 2, h * 0.06);
  scan(c, w, h);
};

export const DRAW: Draw[] = [pyramid, stripes, drive, blocks, pong, rocks];
export const drawGame = (i: number, c: CanvasRenderingContext2D, w: number, h: number, t: number) => DRAW[((i % DRAW.length) + DRAW.length) % DRAW.length](c, w, h, t);
