// World layouts. The main game starts SMALL (guild placeholder + player only).
// The test layout is a separate world/save used only for logistics and performance checks.
import { World, mulberry32 } from './world.js';
import { OPP } from '../core/dir.js';

const blob = (rnd, n) => {
  const t = [[0, 0], [1, 0], [0, 1], [1, 1]];
  const set = new Set(t.map((p) => p.join(',')));
  while (t.length < n) {
    const [x, y] = t[Math.floor(rnd() * t.length)];
    const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rnd() * 4)];
    const k = `${x + d[0]},${y + d[1]}`;
    if (!set.has(k)) { set.add(k); t.push([x + d[0], y + d[1]]); }
  }
  return t;
};

function paintGround(w, rnd) {
  for (let i = 0; i < w.ground.length; i++) w.ground[i] = rnd() < 0.12 ? 1 + Math.floor(rnd() * 3) : 0;
}

export function createMainWorld(seed = 20261125) {
  const rnd = mulberry32(seed);
  const w = new World({ w: 64, h: 44, seed, kind: 'main' });
  paintGround(w, rnd);
  // Guild hall placeholder (4x3), solid
  const gx = 8, gy = 18;
  for (let y = gy; y < gy + 3; y++) for (let x = gx; x < gx + 4; x++) w.staticSolid[w.idx(x, y)] = 1;
  w.landmarks.push({ kind: 'guild', x: gx, y: gy, w: 4, h: 3 });
  w.spawn = { x: gx + 2, y: gy + 4 };
  // Deposits (undiscovered until the guild master walks near). Positions are TEST layout.
  w.addCluster(1, 18, 22, blob(rnd, 9));
  w.addCluster(1, 30, 10, blob(rnd, 10));
  w.addCluster(2, 44, 30, blob(rnd, 7));
  w.addCluster(1, 52, 14, blob(rnd, 9));
  w.addCluster(2, 26, 36, blob(rnd, 6));
  // Trees: scattered groves, kept away from the guild and deposits
  for (let k = 0; k < 14; k++) {
    const cx = Math.floor(rnd() * w.w), cy = Math.floor(rnd() * w.h);
    for (const [dx, dy] of blob(rnd, 3 + Math.floor(rnd() * 6))) {
      const x = cx + dx, y = cy + dy;
      if (!w.inBounds(x, y)) continue;
      if (Math.abs(x - (gx + 2)) < 8 && Math.abs(y - (gy + 2)) < 7) continue;
      const i = w.idx(x, y);
      if (w.staticSolid[i]) continue;
      let nearDeposit = false; // keep a 2-tile clearing around deposits for machines and belts
      for (let dy = -2; dy <= 2 && !nearDeposit; dy++) for (let dx = -2; dx <= 2; dx++) if (w.inBounds(x + dx, y + dy) && w.deposit[w.idx(x + dx, y + dy)]) { nearDeposit = true; break; }
      if (nearDeposit) continue;
      w.tree[i] = 1;
    }
  }
  w.discoverAround(w.spawn.x, w.spawn.y);
  return w;
}

// Places a belt path. `dirs` lists the travel direction of each belt in order.
export function placePath(w, x, y, dirs) {
  let cx = x, cy = y;
  const V = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  for (const d of dirs) { w.placeBelt(cx, cy, d); cx += V[d][0]; cy += V[d][1]; }
  return [cx, cy];
}
const rep = (d, n) => Array(n).fill(d);

export function createTestWorld() {
  const w = new World({ w: 112, h: 80, seed: 6006, kind: 'test' });
  paintGround(w, mulberry32(6006));
  w.spawn = { x: 14, y: 30 };
  // 1) Long straight, 20 tiles W->E
  w.placeFacility('supplier', 3, 3, 'E', { item: 'wood' });
  let [ex, ey] = placePath(w, 4, 3, rep('E', 20));
  w.placeFacility('storage', ex, ey);
  // 1b) Reverse straight E->W
  w.placeFacility('supplier', 26, 5, 'W', { item: 'paper' });
  [ex, ey] = placePath(w, 25, 5, rep('W', 20));
  w.placeFacility('storage', ex, ey);
  // 2) Vertical 10 tiles N->S and S->N
  w.placeFacility('supplier', 32, 2, 'S', { item: 'iron_ore' });
  [ex, ey] = placePath(w, 32, 3, rep('S', 10));
  w.placeFacility('storage', ex, ey);
  w.placeFacility('supplier', 34, 14, 'N', { item: 'ink' });
  [ex, ey] = placePath(w, 34, 13, rep('N', 10));
  w.placeFacility('storage', ex, ey);
  // 3) Zigzag eastward (corners WS, NE, WN, SE)
  w.placeFacility('supplier', 3, 9, 'E', { item: 'gold_ore' });
  [ex, ey] = placePath(w, 4, 9, [...rep('E', 3), ...rep('S', 3), ...rep('E', 3), ...rep('N', 3), ...rep('E', 3), ...rep('S', 3), ...rep('E', 2)]);
  w.placeFacility('storage', ex, ey);
  // 3b) Zigzag westward (corners ES, NW, EN, SW)
  w.placeFacility('supplier', 28, 18, 'W', { item: 'quest' });
  [ex, ey] = placePath(w, 27, 18, [...rep('W', 3), ...rep('S', 3), ...rep('W', 3), ...rep('N', 3), ...rep('W', 3), ...rep('S', 3), ...rep('W', 2)]);
  w.placeFacility('storage', ex, ey);
  // 4) Parallel belts (3 lanes, different items)
  ['iron_ingot', 'slime', 'wood'].forEach((it, k) => {
    w.placeFacility('supplier', 3, 25 + k, 'E', { item: it });
    const [px, py] = placePath(w, 4, 25 + k, rep('E', 16));
    w.placeFacility('storage', px, py);
  });
  // 5) Blocking / recovery: dead end + closable storage
  w.placeFacility('supplier', 3, 31, 'E', { item: 'paper' });
  placePath(w, 4, 31, rep('E', 8));                       // dead end: items queue and wait
  w.placeFacility('supplier', 3, 33, 'E', { item: 'ink' });
  [ex, ey] = placePath(w, 4, 33, rep('E', 8));
  const gate = w.placeFacility('storage', ex, ey); gate.open = false; // click to open -> recovery
  // 6) Miner -> belt -> smelter -> belt -> storage (iron)
  w.addCluster(1, 40, 24, [[0, 0], [1, 0], [0, 1], [1, 1], [2, 1]], true);
  w.placeFacility('miner', 40, 24);
  [ex, ey] = placePath(w, 42, 25, rep('E', 3));
  w.placeFacility('smelter', ex, ey - 1);
  [ex, ey] = placePath(w, ex + 2, ey, rep('E', 4));
  w.placeFacility('storage', ex, ey);
  // 6b) Gold miner -> corner path -> storage
  w.addCluster(2, 40, 30, [[0, 0], [1, 0], [0, 1], [1, 1]], true);
  w.placeFacility('miner', 40, 30);
  [ex, ey] = placePath(w, 42, 31, [...rep('E', 3), ...rep('S', 3), ...rep('E', 3)]);
  w.placeFacility('storage', ex, ey);
  // Undiscovered deposit for discovery test
  w.addCluster(1, 60, 30, [[0, 0], [1, 0], [0, 1], [1, 1], [1, 2]]);
  w.benchArea = { x0: 4, y0: 40, x1: 108, y1: 78 };
  w.reshapeAll();
  return w;
}

// Benchmark: N belts in lanes of 25 inside the bench area, each lane fed by a supplier.
export function buildBeltBench(w, n) {
  const a = w.benchArea;
  w.clearArea(a.x0, a.y0, a.x1, a.y1);
  const lane = 25;
  let placed = 0, row = 0, col = 0;
  while (placed < n) {
    const x = a.x0 + col * (lane + 3), y = a.y0 + row * 2;
    if (y > a.y1) break;
    const len = Math.min(lane, n - placed);
    w.placeFacility('supplier', x, y, 'E', { item: ['wood', 'iron_ore', 'paper', 'slime'][(row + col) % 4] });
    const [ex, ey] = placePath(w, x + 1, y, rep('E', len));
    w.placeFacility('storage', ex, ey);
    placed += len;
    col++;
    if (a.x0 + col * (lane + 3) + lane + 2 > a.x1) { col = 0; row++; }
  }
  return placed;
}
export { OPP };
