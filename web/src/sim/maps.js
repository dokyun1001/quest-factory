// World layouts (TEST layouts — final world size/generation is undecided).
import { World, mulberry32, TERRAIN } from './world.js';

const blob = (rnd, n) => {
  const t = [[0, 0], [1, 0], [0, 1], [1, 1]]; const set = new Set(t.map((p) => p.join(',')));
  while (t.length < n) {
    const [x, y] = t[Math.floor(rnd() * t.length)];
    const d = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(rnd() * 4)];
    const k = `${x + d[0]},${y + d[1]}`; if (!set.has(k)) { set.add(k); t.push([x + d[0], y + d[1]]); }
  }
  return t;
};
const DEP = { iron_ore: 1, gold_ore: 2, coal: 3, stone: 4, copper_ore: 5 };
const NODE = { herb: 1, fiber: 2, berry: 3 };

function base(w, rnd) { for (let i = 0; i < w.ground.length; i++) w.ground[i] = rnd() < 0.12 ? 1 + Math.floor(rnd() * 3) : 0; }
function deposit(w, rnd, type, cx, cy, n) {
  for (const [dx, dy] of blob(rnd, n)) { const x = cx + dx, y = cy + dy; if (!w.inBounds(x, y)) continue; const i = w.idx(x, y); if (w.terrain[i]) continue; w.deposit[i] = DEP[type]; w.tree[i] = 0; }
}
function lake(w, cx, cy, rx, ry) {
  for (let y = cy - ry - 2; y <= cy + ry + 2; y++) for (let x = cx - rx - 2; x <= cx + rx + 2; x++) {
    if (!w.inBounds(x, y)) continue;
    const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; const i = w.idx(x, y);
    if (d <= 1) w.terrain[i] = TERRAIN.WATER; else if (d <= 1.45 && w.terrain[i] !== TERRAIN.WATER) w.terrain[i] = TERRAIN.SAND;
  }
}
function forest(w, rnd, x0, y0, x1, y1, density) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!w.inBounds(x, y)) continue; const i = w.idx(x, y);
    if (w.terrain[i] || w.deposit[i] || w.staticSolid[i] || w.node[i]) continue;
    w.ground[i] = 4; if (rnd() < density) w.tree[i] = 1;
  }
}
function nodes(w, rnd, type, cx, cy, r, n) {
  for (let k = 0; k < n; k++) {
    const x = Math.round(cx + (rnd() * 2 - 1) * r), y = Math.round(cy + (rnd() * 2 - 1) * r);
    if (!w.inBounds(x, y)) continue; const i = w.idx(x, y);
    if (w.terrain[i] || w.deposit[i] || w.tree[i] || w.staticSolid[i]) continue; w.node[i] = NODE[type];
  }
}
function clearAround(w, x0, y0, x1, y1) { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (w.inBounds(x, y)) { const i = w.idx(x, y); w.tree[i] = 0; w.node[i] = 0; } }
function guild(w, x, y) {
  for (let yy = y; yy < y + 3; yy++) for (let xx = x; xx < x + 4; xx++) { w.staticSolid[w.idx(xx, yy)] = 1; w.tree[w.idx(xx, yy)] = 0; }
  w.landmarks.push({ kind: 'guild', x, y, w: 4, h: 3 });
}
const region = (w, id, name, cx, cy) => w.regions.push({ id, name, cx, cy, found: false });
const habitat = (w, type, x, y, r, max, rg) => w.habitats.push({ type, x, y, r, max, region: rg, found: false, alive: 0, respawnT: 0 });

// ---------------- TEST A: main game world ----------------
export function createMainWorld(seed = 7001) {
  const rnd = mulberry32(seed);
  const w = new World({ w: 112, h: 80, seed, kind: 'main' });
  base(w, rnd);
  lake(w, 34, 56, 7, 5);
  // ruins: rock ring with an opening on the west side
  for (let y = 20; y <= 40; y++) for (let x = 88; x <= 108; x++) {
    const edge = x === 88 || x === 108 || y === 20 || y === 40;
    if (edge && !(x === 88 && y >= 28 && y <= 32)) w.terrain[w.idx(x, y)] = TERRAIN.ROCK;
    else if (!edge) w.ground[w.idx(x, y)] = 5;
  }
  forest(w, rnd, 28, 3, 62, 17, 0.45);
  forest(w, rnd, 2, 60, 22, 78, 0.35);
  forest(w, rnd, 66, 64, 86, 78, 0.3);
  guild(w, 16, 36);
  clearAround(w, 8, 30, 30, 46);
  deposit(w, rnd, 'stone', 10, 31, 8);
  deposit(w, rnd, 'iron_ore', 26, 30, 9);
  deposit(w, rnd, 'coal', 12, 44, 8);
  deposit(w, rnd, 'stone', 42, 26, 7);
  deposit(w, rnd, 'copper_ore', 52, 22, 8);
  deposit(w, rnd, 'iron_ore', 62, 46, 8);
  deposit(w, rnd, 'coal', 48, 64, 7);
  deposit(w, rnd, 'gold_ore', 76, 56, 7);
  nodes(w, rnd, 'herb', 30, 46, 6, 10);
  nodes(w, rnd, 'herb', 58, 38, 6, 8);
  nodes(w, rnd, 'fiber', 22, 26, 6, 10);
  nodes(w, rnd, 'fiber', 56, 32, 6, 8);
  nodes(w, rnd, 'berry', 36, 20, 6, 8);
  nodes(w, rnd, 'berry', 12, 58, 6, 6);
  for (let k = 0; k < 18; k++) {   // scattered trees, kept clear of the start area and deposits
    const cx = Math.floor(rnd() * w.w), cy = Math.floor(rnd() * w.h);
    for (const [dx, dy] of blob(rnd, 3 + Math.floor(rnd() * 5))) {
      const x = cx + dx, y = cy + dy; if (!w.inBounds(x, y)) continue; const i = w.idx(x, y);
      if (x > 6 && x < 32 && y > 28 && y < 48) continue;
      if (w.terrain[i] || w.deposit[i] || w.node[i] || w.staticSolid[i] || w.ground[i] === 5) continue;
      let near = false; for (let yy = -2; yy <= 2 && !near; yy++) for (let xx = -2; xx <= 2; xx++) if (w.inBounds(x + xx, y + yy) && w.deposit[w.idx(x + xx, y + yy)]) { near = true; break; }
      if (!near) w.tree[i] = 1;
    }
  }
  for (let x = 22; x < 28; x++) for (let y = 34; y < 42; y++) w.tree[w.idx(x, y)] = 0;
  // a few trees near the guild for first wood
  for (const [x, y] of [[8, 38], [9, 40], [7, 41], [28, 40], [29, 42], [27, 44]]) if (!w.deposit[w.idx(x, y)]) w.tree[w.idx(x, y)] = 1;
  region(w, 'r_guild', '길드 평원', 18, 38); region(w, 'r_lake', '호수', 34, 56); region(w, 'r_meadow', '슬라임 초원', 58, 36);
  region(w, 'r_forest', '늑대 숲', 44, 10); region(w, 'r_hills', '광산 언덕', 52, 22); region(w, 'r_ruins', '골렘 유적', 98, 30);
  habitat(w, 'slime', 40, 44, 3, 5, 'r_lake');
  habitat(w, 'slime', 58, 36, 3, 6, 'r_meadow');
  habitat(w, 'wolf', 44, 10, 3, 4, 'r_forest');
  habitat(w, 'wolf', 72, 70, 3, 4, 'r_forest');
  habitat(w, 'golem', 98, 30, 1, 1, 'r_ruins');
  for (const h of w.habitats) clearAround(w, h.x - 2, h.y - 2, h.x + 2, h.y + 2);
  w.treasures.push({ x: 84, y: 12, gold: 60 }, { x: 6, y: 72, gold: 40 }, { x: 104, y: 70, gold: 80 });
  w.spawn = { x: 18, y: 40 };
  return w;
}

// ---------------- TEST B: combat lab ----------------
export function createCombatLab() {
  const rnd = mulberry32(7002);
  const w = new World({ w: 64, h: 40, seed: 7002, kind: 'combat' });
  base(w, rnd);
  guild(w, 4, 17);
  region(w, 'r_guild', '훈련장', 6, 18); region(w, 'r_ruins', '보스 투기장', 46, 20);
  habitat(w, 'slime', 22, 8, 3, 6, 'r_meadow');
  habitat(w, 'wolf', 22, 31, 3, 5, 'r_forest');
  for (let y = 8; y <= 32; y++) for (let x = 36; x <= 58; x++) {
    const edge = x === 36 || x === 58 || y === 8 || y === 32;
    if (edge && !(x === 36 && y >= 17 && y <= 23)) w.terrain[w.idx(x, y)] = TERRAIN.ROCK; else if (!edge) w.ground[w.idx(x, y)] = 5;
  }
  w.explored.fill(1); w.exploredCount = w.explored.length;
  for (const r of w.regions) r.found = true; for (const h of w.habitats) h.found = true;
  w.spawn = { x: 10, y: 20 }; w.arena = { x: 47, y: 20 };
  return w;
}

// ---------------- TEST E: performance lab ----------------
export function createPerfLab() {
  const rnd = mulberry32(7005);
  const w = new World({ w: 240, h: 170, seed: 7005, kind: 'perf' });
  base(w, rnd);
  guild(w, 10, 80);
  region(w, 'r_guild', '성능 시험장', 12, 82);
  for (let k = 0; k < 10; k++) habitat(w, k % 3 ? 'slime' : 'wolf', 30 + (k % 5) * 16, 60 + Math.floor(k / 5) * 40, 4, 8, 'r_meadow');
  for (let k = 0; k < 6; k++) deposit(w, rnd, ['iron_ore', 'coal', 'stone'][k % 3], 20 + k * 6, 70, 6);
  w.explored.fill(1); w.exploredCount = w.explored.length; for (const r of w.regions) r.found = true; for (const h of w.habitats) h.found = true;
  w.spawn = { x: 14, y: 86 }; w.benchArea = { x0: 112, y0: 2, x1: 236, y1: 166 };
  return w;
}

// belt benchmark: N belts in lanes of 50 with a supplier-free design: a chest at the head feeds each lane
export function placePath(w, x, y, dirs, tier = 0) {
  let cx = x, cy = y; const V = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] };
  for (const d of dirs) { w.placeBelt(cx, cy, d, tier); cx += V[d][0]; cy += V[d][1]; }
  return [cx, cy];
}
export function buildBeltBench(w, n, tier = 1) {
  const a = w.benchArea; w.clearArea(a.x0, a.y0, a.x1, a.y1);
  const lane = 60; let placed = 0, row = 0, col = 0;
  while (placed < n) {
    const x = a.x0 + col * (lane + 3), y = a.y0 + row;
    if (y > a.y1) break;
    const len = Math.min(lane, n - placed);
    const src = w.placeFacility('chest', x, y, 'E', { outputOn: true });
    if (src) src.stock = { iron_ore: 100000 };
    const [ex, ey] = placePath(w, x + 1, y, Array(len).fill('E'), tier);
    const sink = w.placeFacility('chest', ex, ey, 'S'); if (sink) sink.level = 1e6;
    placed += len; col++;
    if (a.x0 + col * (lane + 3) + lane + 2 > a.x1) { col = 0; row++; }
  }
  return placed;
}
