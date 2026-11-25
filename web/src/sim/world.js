// World + logistics simulation v2 (pure JS, no Phaser). Fixed step, independent of rendering.
import { B } from '../data/balance.js';
import { VEC, OPP, DIRS } from '../core/dir.js';
import { FACILITIES } from '../data/facilities.js';
import { ITEMS } from '../data/items.js';
import { RECIPE_BY_ID, FURNACE } from '../data/recipes.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0; let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export class Emitter {
  constructor() { this.h = {}; }
  on(n, f) { (this.h[n] ||= []).push(f); }
  emit(n, ...a) { const l = this.h[n]; if (l) for (const f of l) f(...a); }
}
// deposit codes
export const DEPOSITS = { 1: 'iron_ore', 2: 'gold_ore', 3: 'coal', 4: 'stone', 5: 'copper_ore' };
export const NODES = { 1: 'herb', 2: 'fiber', 3: 'berry' };
export const TERRAIN = { GRASS: 0, WATER: 1, SAND: 2, ROCK: 3, DARK: 4 };

const itemPool = [];
const newItem = (t, p) => { const it = itemPool.pop() || { t: '', p: 0 }; it.t = t; it.p = p; return it; };
const freeItem = (it) => { itemPool.push(it); };
const add = (m, k, n = 1) => { m[k] = (m[k] || 0) + n; };
const sumCounts = (m) => { let n = 0; for (const k in m) n += m[k]; return n; };

export class World {
  constructor({ w, h, seed, kind }) {
    this.w = w; this.h = h; this.seed = seed; this.kind = kind;
    const n = w * h;
    this.terrain = new Uint8Array(n);
    this.ground = new Uint8Array(n);
    this.deposit = new Uint8Array(n);
    this.node = new Uint8Array(n);            // gather nodes (herb/fiber/berry)
    this.tree = new Uint8Array(n);            // 1 grown, 2 stump (regrowing)
    this.treeTimer = new Map();
    this.staticSolid = new Uint8Array(n);
    this.explored = new Uint8Array(n);
    this.occ = new Int32Array(n);
    this.belts = new Array(n).fill(null);
    this.beltCount = 0;
    this.facilities = new Map();
    this.nextFacId = 1;
    this.order = [];
    this.topoDirty = true;
    this.events = new Emitter();
    this.time = 0;
    this.landmarks = [];
    this.regions = [];
    this.habitats = [];
    this.treasures = [];
    this.made = {};                           // production milestones
    this.power = { supply: 0, demand: 0, sat: 1 };
    this.speedMult = 1;                       // dev: global production speed
    this.exploredCount = 0;
  }
  idx(x, y) { return y * this.w + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  beltAt(x, y) { return this.inBounds(x, y) ? this.belts[y * this.w + x] : null; }
  facAt(x, y) { if (!this.inBounds(x, y)) return null; const id = this.occ[y * this.w + x]; return id ? this.facilities.get(id) : null; }
  solidAt(x, y) {
    if (!this.inBounds(x, y)) return true;
    const i = y * this.w + x;
    return this.tree[i] === 1 || this.staticSolid[i] === 1 || this.occ[i] !== 0 || this.terrain[i] === TERRAIN.WATER || this.terrain[i] === TERRAIN.ROCK;
  }
  buildBlocked(x, y) {
    if (!this.inBounds(x, y)) return true;
    const i = y * this.w + x;
    return this.tree[i] === 1 || this.staticSolid[i] === 1 || this.terrain[i] === TERRAIN.WATER || this.terrain[i] === TERRAIN.ROCK || this.node[i] !== 0;
  }
  nearWater(x, y, fw = 1, fh = 1) {
    for (let dy = -1; dy <= fh; dy++) for (let dx = -1; dx <= fw; dx++) {
      if (this.inBounds(x + dx, y + dy) && this.terrain[this.idx(x + dx, y + dy)] === TERRAIN.WATER) return true;
    }
    return false;
  }

  // ---------- exploration (fog of war) ----------
  reveal(cx, cy, r) {
    const r2 = r * r; let changed = false;
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(this.w - 1, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(this.h - 1, Math.ceil(cy + r));
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * this.w + x;
      if (this.explored[i]) continue;
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy;
      if (dx * dx + dy * dy <= r2) { this.explored[i] = 1; this.exploredCount++; changed = true; }
    }
    if (changed) {
      this.events.emit('reveal', x0, y0, x1, y1);
      for (const rg of this.regions) if (!rg.found && this.explored[this.idx(rg.cx, rg.cy)]) { rg.found = true; this.events.emit('discover', 'region', rg); }
      for (const hb of this.habitats) if (!hb.found && this.explored[this.idx(hb.x, hb.y)]) { hb.found = true; this.events.emit('discover', 'habitat', hb); }
      for (const t of this.treasures) if (!t.found && this.explored[this.idx(t.x, t.y)]) { t.found = true; this.events.emit('discover', 'treasure', t); }
    }
    return changed;
  }
  isExplored(x, y) { return this.inBounds(x, y) && this.explored[this.idx(x, y)] === 1; }
  depositAt(x, y) { return this.inBounds(x, y) ? DEPOSITS[this.deposit[this.idx(x, y)]] || null : null; }

  // ---------- trees ----------
  chopTree(x, y) {
    const i = this.idx(x, y);
    if (this.tree[i] !== 1) return false;
    this.tree[i] = 2; this.treeTimer.set(i, B.world.treeRegrowSec);
    this.events.emit('tree', x, y); return true;
  }
  tickTrees(dt) {
    for (const [i, t] of this.treeTimer) {
      const nt = t - dt;
      if (nt <= 0) {
        this.treeTimer.delete(i);
        const x = i % this.w, y = (i / this.w) | 0;
        if (this.occ[i] || this.belts[i]) continue;      // something was built on the stump
        this.tree[i] = 1; this.events.emit('tree', x, y);
      } else this.treeTimer.set(i, nt);
    }
  }

  // ---------- belts ----------
  canPlaceBelt(x, y) { return this.inBounds(x, y) && !this.buildBlocked(x, y) && this.occ[this.idx(x, y)] === 0; }
  // returns { belt, refund } ; placing a different tier on an existing belt upgrades it in place (items kept)
  placeBelt(x, y, out, tier = 0) {
    if (!this.canPlaceBelt(x, y)) return null;
    const i = this.idx(x, y);
    let b = this.belts[i]; let refund = null;
    if (b) {
      if (b.out === out && b.tier === tier) return { belt: b, refund: null, same: true };
      if (b.tier !== tier) { refund = { [`belt_${b.tier + 1}`]: 1 }; b.tier = tier; }
      b.out = out;
    } else {
      b = { x, y, i, out, in: OPP[out], tier, items: [], nextBelt: null, nextFac: null, prev: null };
      this.belts[i] = b; this.beltCount++;
      if (this.tree[i] === 2) { this.tree[i] = 0; this.treeTimer.delete(i); }
    }
    this.reshapeAround(x, y);
    this.events.emit('belt', b, 'add');
    return { belt: b, refund };
  }
  removeBelt(x, y) {
    const b = this.beltAt(x, y);
    if (!b) return null;
    const refund = { [`belt_${b.tier + 1}`]: 1 };
    for (const it of b.items) { add(refund, it.t); freeItem(it); }   // transported items are returned, not lost
    b.items.length = 0;
    this.belts[b.i] = null; this.beltCount--;
    this.events.emit('belt', b, 'remove');
    this.reshapeAround(x, y);
    return refund;
  }
  feedsFrom(x, y, d) {
    const nx = x + VEC[d][0], ny = y + VEC[d][1];
    const nb = this.beltAt(nx, ny);
    if (nb) return nb.out === OPP[d];
    const f = this.facAt(nx, ny);
    if (f) for (const p of this.portsOf(f)) if (p.kind === 'out' && p.tx === nx && p.ty === ny && p.edge === OPP[d]) return true;
    return false;
  }
  computeInput(b) {
    const back = OPP[b.out];
    if (this.feedsFrom(b.x, b.y, back)) return back;
    let side = null, count = 0;
    for (const d of DIRS) { if (d === b.out || d === back) continue; if (this.feedsFrom(b.x, b.y, d)) { side = d; count++; } }
    return count === 1 ? side : back;
  }
  reshapeAround(x, y) {
    for (const [px, py] of [[x, y], [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
      const b = this.beltAt(px, py); if (!b) continue;
      const ni = this.computeInput(b);
      if (ni !== b.in) { b.in = ni; this.events.emit('belt', b, 'shape'); }
    }
    this.topoDirty = true;
  }
  reshapeAll() { for (const b of this.belts) if (b) b.in = this.computeInput(b); this.topoDirty = true; }
  rebuildTopology() {
    const list = [];
    for (const b of this.belts) if (b) { b.prev = null; b.nextBelt = null; b.nextFac = null; b.nextPort = null; list.push(b); }
    for (const b of list) {
      const tx = b.x + VEC[b.out][0], ty = b.y + VEC[b.out][1];
      const nb = this.beltAt(tx, ty);
      if (nb) { if (nb.in === OPP[b.out]) { b.nextBelt = nb; nb.prev = b; } continue; }
      const f = this.facAt(tx, ty);
      if (f) for (const p of this.portsOf(f)) {
        if (p.kind === 'in' && p.tx === tx && p.ty === ty && p.edge === OPP[b.out]) { b.nextFac = f; b.nextPort = p; break; }
      }
    }
    const order = []; const seen = new Set();
    for (const b of list) { if (b.nextBelt) continue; for (let c = b; c && !seen.has(c); c = c.prev) { seen.add(c); order.push(c); } }
    for (const b of list) { if (seen.has(b)) continue; for (let c = b; c && !seen.has(c); c = c.prev) { seen.add(c); order.push(c); } }
    this.order = order; this.topoDirty = false;
  }
  beltRoom(b) { const n = b.items.length; return n === 0 || b.items[n - 1].p >= B.logistics.itemGap; }

  // ---------- facilities ----------
  portsOf(f) {
    if (f._ports && f._portsRot === f.rot) return f._ports;
    const def = FACILITIES[f.type];
    f._ports = def.ports(f.rot).map((p) => ({ kind: p.kind, role: p.role, tx: f.x + p.tile[0], ty: f.y + p.tile[1], edge: p.edge }));
    f._portsRot = f.rot;
    return f._ports;
  }
  canPlaceFacility(type, x, y, rot = 'E') {
    const def = FACILITIES[type];
    const [fw, fh] = def.footprint;
    let onDeposit = 0;
    for (let dy = 0; dy < fh; dy++) for (let dx = 0; dx < fw; dx++) {
      const tx = x + dx, ty = y + dy;
      if (!this.inBounds(tx, ty) || this.buildBlocked(tx, ty)) return { ok: false, why: '설치할 수 없는 위치' };
      const i = this.idx(tx, ty);
      if (this.occ[i] || this.belts[i]) return { ok: false, why: '다른 구조물과 겹침' };
      if (this.deposit[i] && this.explored[i]) onDeposit++;
    }
    if (def.needsDeposit && !onDeposit) return { ok: false, why: '탐험한 광맥 위에만 설치할 수 있습니다' };
    if (def.needsWater && !this.nearWater(x, y, fw, fh)) return { ok: false, why: '물가 옆에 설치해야 합니다' };
    return { ok: true };
  }
  placeFacility(type, x, y, rot = 'E', extra = {}) {
    if (!this.canPlaceFacility(type, x, y, rot).ok) return null;
    const def = FACILITIES[type];
    const f = { id: this.nextFacId++, type, x, y, rot: def.rotatable ? rot : (rot || 'E'), timer: 0, tier: 0, made: 0,
      inBuf: {}, outBuf: [], stock: {}, fuel: [], ore: [], charge: 0, state: 'off', emberT: 0,
      recipe: extra.recipe || null, filter: extra.filter || null, outputOn: extra.outputOn ?? false, level: 0, rr: 0, carry: {},
      mineType: null };
    if (def.kind === 'miner') {
      const tally = {};
      for (let dy = 0; dy < def.footprint[1]; dy++) for (let dx = 0; dx < def.footprint[0]; dx++) {
        const d = this.depositAt(x + dx, y + dy); if (d && this.explored[this.idx(x + dx, y + dy)]) add(tally, d);
      }
      f.mineType = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
    }
    if (def.kind === 'machine' && !f.recipe) f.recipe = defaultRecipe(def.station);
    for (let dy = 0; dy < def.footprint[1]; dy++) for (let dx = 0; dx < def.footprint[0]; dx++) {
      const i = this.idx(x + dx, y + dy); this.occ[i] = f.id;
      if (this.tree[i] === 2) { this.tree[i] = 0; this.treeTimer.delete(i); }
    }
    this.facilities.set(f.id, f);
    this.reshapeFacilityNeighbors(f);
    this.events.emit('fac', f, 'add');
    return f;
  }
  // returns refund (facility item + all buffered items)
  removeFacility(f) {
    const def = FACILITIES[f.type];
    const refund = { [`fac_${f.type}`]: 1 };
    for (const [k, n] of Object.entries(f.inBuf)) add(refund, k, n);
    for (const t of [...f.outBuf, ...f.ore, ...f.fuel]) add(refund, t);
    for (const [k, n] of Object.entries(f.stock)) add(refund, k, n);
    if (f.node) add(refund, f.node);
    for (let dy = 0; dy < def.footprint[1]; dy++) for (let dx = 0; dx < def.footprint[0]; dx++) this.occ[this.idx(f.x + dx, f.y + dy)] = 0;
    this.facilities.delete(f.id);
    this.reshapeFacilityNeighbors(f);
    this.events.emit('fac', f, 'remove');
    return refund;
  }
  rotateFacility(f) {
    if (!FACILITIES[f.type].rotatable) return;
    f.rot = { N: 'E', E: 'S', S: 'W', W: 'N' }[f.rot];
    this.reshapeFacilityNeighbors(f);
    this.events.emit('fac', f, 'change');
  }
  reshapeFacilityNeighbors(f) {
    const def = FACILITIES[f.type];
    for (let dy = -1; dy <= def.footprint[1]; dy++) for (let dx = -1; dx <= def.footprint[0]; dx++) {
      const b = this.beltAt(f.x + dx, f.y + dy);
      if (b) { const ni = this.computeInput(b); if (ni !== b.in) { b.in = ni; this.events.emit('belt', b, 'shape'); } }
    }
    this.topoDirty = true;
  }
  storageCap(f) { return B.logistics.storageCap + f.level * B.logistics.storageCapPerUpgrade; }
  // can facility f take item t through port p?
  facAccepts(f, t, p) {
    const def = FACILITIES[f.type];
    switch (def.kind) {
      case 'storage': return sumCounts(f.stock) < this.storageCap(f);
      case 'furnace':
        if (p && p.role === 'fuel') return B.industry.fuelValue[t] !== undefined && f.fuel.length < B.industry.furnaceFuelBuf;
        return !!FURNACE[t] && f.ore.length < B.industry.furnaceOreBuf;
      case 'machine': {
        if (def.station === 'crusher') return ITEMS[t]?.cat === 'equip' && sumCounts(f.inBuf) < 2;
        const r = RECIPE_BY_ID[f.recipe]; if (!r || !r.in[t]) return false;
        return (f.inBuf[t] || 0) < r.in[t] * 3;
      }
      case 'splitter': case 'merger': case 'sorter': return f.outBuf.length < B.logistics.nodeBuffer;
      case 'board': return t === 'quest' && (f.stock.quest || 0) < B.quests.maxBoard;
      case 'shop': { const c = ITEMS[t]?.cat; return (c === 'equip' || c === 'consum') && sumCounts(f.stock) < 40; }
      case 'school': return false;
      default: return false;
    }
  }
  facReceive(f, t, p) {
    const def = FACILITIES[f.type];
    switch (def.kind) {
      case 'storage': case 'board': case 'shop': add(f.stock, t); break;
      case 'furnace': if (p && p.role === 'fuel') f.fuel.push(t); else f.ore.push(t); break;
      case 'machine': add(f.inBuf, t); break;
      default: f.outBuf.push(t);
    }
    this.events.emit('facItem', f, t);
  }
  // push one item out through out-ports; returns true if pushed
  tryPush(f, t, filterFn) {
    const ports = this.portsOf(f);
    const n = ports.length;
    for (let k = 0; k < n; k++) {
      const p = ports[(f.rr + k) % n];
      if (p.kind !== 'out' || (filterFn && !filterFn(p))) continue;
      const tx = p.tx + VEC[p.edge][0], ty = p.ty + VEC[p.edge][1];
      const b = this.beltAt(tx, ty);
      if (b) {
        if (b.in === OPP[p.edge] && this.beltRoom(b)) { b.items.push(newItem(t, 0)); f.rr = (f.rr + k + 1) % n; return true; }
        continue;
      }
      const g = this.facAt(tx, ty);
      if (g && g !== f) {
        for (const q of this.portsOf(g)) {
          if (q.kind === 'in' && q.tx === tx && q.ty === ty && q.edge === OPP[p.edge] && this.facAccepts(g, t, q)) {
            this.facReceive(g, t, q); f.rr = (f.rr + k + 1) % n; return true;
          }
        }
      }
    }
    return false;
  }
  mult(f) {
    const def = FACILITIES[f.type];
    const tierMult = B.industry.tiers[f.tier || 0].mult;
    const powered = f.tier > 0 ? this.power.sat : 1;          // basic tier needs no power
    return tierMult * powered * (def.speedMult || 1) * this.speedMult;
  }
  tickFacility(f, dt) {
    const def = FACILITIES[f.type];
    switch (def.kind) {
      case 'miner': {
        if (f.outBuf.length < 2) {
          f.timer += dt * this.mult(f);
          if (f.timer >= B.industry.minerSec) { f.timer = 0; f.outBuf.push(f.mineType); f.made++; add(this.made, `${f.mineType}_mined`); }
          f.state = 'active';
        } else f.state = 'blocked';
        break;
      }
      case 'pump': {
        if (f.outBuf.length < 2) { f.timer += dt * this.mult(f); if (f.timer >= B.industry.pumpSec) { f.timer = 0; f.outBuf.push('water'); f.made++; } f.state = 'active'; }
        else f.state = 'blocked';
        break;
      }
      case 'furnace': {
        // only consumes fuel when an ore is present AND the output has room -> no wasted fuel
        if (f.smelting) {
          f.timer += dt * this.mult(f);
          if (f.timer >= FURNACE[f.smelting].time) {
            f.outBuf.push(FURNACE[f.smelting].out); add(this.made, `${FURNACE[f.smelting].out}_made`); f.made++;
            f.smelting = null; f.timer = 0;
          }
        }
        if (!f.smelting && f.ore.length && f.outBuf.length < B.industry.furnaceOutBuf) {
          if (f.charge <= 0 && f.fuel.length) { f.charge += B.industry.fuelValue[f.fuel.shift()]; }
          if (f.charge > 0) { f.charge--; f.smelting = f.ore.shift(); f.timer = 0; }
        }
        const st = f.smelting ? 'active' : (f.emberT > 0 ? 'ember' : 'off');
        if (f.smelting) f.emberT = 4; else f.emberT = Math.max(0, f.emberT - dt);
        if (st !== f.state) { f.state = st; this.events.emit('fac', f, 'state'); }
        break;
      }
      case 'machine': {
        if (def.station === 'crusher') {
          const eq = Object.keys(f.inBuf).find((k) => f.inBuf[k] > 0);
          if (eq && f.outBuf.length < B.industry.machineOutBuf) {
            f.timer += dt * this.mult(f);
            if (f.timer >= 6) {
              f.timer = 0; f.inBuf[eq]--; if (!f.inBuf[eq]) delete f.inBuf[eq];
              const r = Object.values(RECIPE_BY_ID).find((x) => x.out[eq] && !x.id.startsWith('fac_'));
              if (r) for (const [k, n] of Object.entries(r.in)) {
                f.carry[k] = (f.carry[k] || 0) + n * B.economy.crusherReturn;   // fractional carry, never > 20%
                while (f.carry[k] >= 1) { f.carry[k] -= 1; f.outBuf.push(k); }
              }
              f.made++;
            }
          }
          f.state = eq ? 'active' : 'idle';
          break;
        }
        const r = RECIPE_BY_ID[f.recipe];
        if (!r) { f.state = 'idle'; break; }
        const ready = Object.entries(r.in).every(([k, n]) => (f.inBuf[k] || 0) >= n);
        const outN = Object.values(r.out).reduce((a, b) => a + b, 0);
        if (ready && f.outBuf.length + outN <= B.industry.machineOutBuf + 1) {
          f.timer += dt * this.mult(f); f.state = 'active';
          if (f.timer >= r.time) {
            f.timer = 0;
            for (const [k, n] of Object.entries(r.in)) { f.inBuf[k] -= n; if (!f.inBuf[k]) delete f.inBuf[k]; }
            for (const [k, n] of Object.entries(r.out)) for (let i = 0; i < n; i++) f.outBuf.push(k);
            for (const [k, n] of Object.entries(r.out)) add(this.made, `${k}_made`, n);
            f.made++;
          }
        } else f.state = ready ? 'blocked' : 'waiting';
        break;
      }
      case 'storage': {
        if (f.outputOn) {
          const k = f.filter ? (f.stock[f.filter] ? f.filter : null) : Object.keys(f.stock).find((x) => f.stock[x] > 0);
          if (k && this.tryPush(f, k)) { f.stock[k]--; if (!f.stock[k]) delete f.stock[k]; }
        }
        return;
      }
      case 'sorter': {
        if (f.outBuf.length) {
          const t = f.outBuf[0];
          const match = f.filter && t === f.filter;
          if (this.tryPush(f, t, (p) => (match ? p.role === 'match' : p.role === 'rest'))) f.outBuf.shift();
        }
        return;
      }
      case 'counter': {
        const k = Object.keys(f.stock).find((x) => f.stock[x] > 0);
        if (k && this.tryPush(f, k)) { f.stock[k]--; if (!f.stock[k]) delete f.stock[k]; }
        return;
      }
      default: break;
    }
    if (f.outBuf.length && this.tryPush(f, f.outBuf[0])) f.outBuf.shift();
    if (f.outBuf.length && def.kind !== 'splitter' && def.kind !== 'merger' && this.tryPush(f, f.outBuf[0])) f.outBuf.shift();
  }

  tickPower() {
    let supply = 0, demand = 0;
    for (const f of this.facilities.values()) {
      if (FACILITIES[f.type].kind === 'generator') supply += B.industry.powerPerWheel;
      else if (f.tier > 0 && f.state === 'active') demand += B.industry.powerDemandPerMachine * f.tier;
    }
    this.power.supply = supply; this.power.demand = demand;
    this.power.sat = demand <= 0 ? 1 : Math.min(1, supply / demand);
  }

  tick(dt) {
    if (this.topoDirty) this.rebuildTopology();
    this.time += dt;
    this.tickTrees(dt);
    this.powerT = (this.powerT || 0) - dt;
    if (this.powerT <= 0) { this.powerT = 1; this.tickPower(); }
    for (const f of this.facilities.values()) this.tickFacility(f, dt);
    const GAP = B.logistics.itemGap, speeds = B.logistics.beltSpeed;
    const order = this.order;
    for (let k = 0; k < order.length; k++) {
      const b = order[k];
      const items = b.items; const n = items.length;
      if (!n) continue;
      const adv = speeds[b.tier] * dt;
      let limit = 1 - GAP / 2;                               // dead end: stop inside the tile
      if (b.nextBelt) { const nb = b.nextBelt, nl = nb.items.length; limit = nl ? Math.min(1, 1 + nb.items[nl - 1].p - GAP) : 1; }
      else if (b.nextFac) limit = 1;
      for (let i = 0; i < n; i++) {
        const it = items[i];
        let np = it.p + adv; if (np > limit) np = limit;
        if (np > it.p) it.p = np;
        limit = it.p - GAP;
      }
      const front = items[0];
      if (front.p >= 1) {
        const nb = b.nextBelt;
        if (nb) {
          if (this.beltRoom(nb)) { items.shift(); front.p = Math.min(front.p - 1, nb.items.length ? nb.items[nb.items.length - 1].p - GAP : 1); if (front.p < 0) front.p = 0; nb.items.push(front); }
        } else if (b.nextFac && this.facAccepts(b.nextFac, front.t, b.nextPort)) {
          items.shift(); this.facReceive(b.nextFac, front.t, b.nextPort); freeItem(front);
        }
      }
    }
  }
  countItems() { let n = 0; for (const b of this.order) n += b.items.length; return n; }
  clearArea(x0, y0, x1, y1) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!this.inBounds(x, y)) continue;
      const f = this.facAt(x, y); if (f) this.removeFacility(f);
      if (this.beltAt(x, y)) this.removeBelt(x, y);
    }
  }

  // ---------- save ----------
  serialize() {
    const belts = [];
    for (const b of this.belts) {
      if (!b) continue;
      belts.push([b.x, b.y, DIRS.indexOf(b.out), b.tier, b.items.map((it) => [it.t, Math.round(it.p * 1000) / 1000])]);
    }
    const facs = [];
    for (const f of this.facilities.values()) {
      facs.push({ type: f.type, x: f.x, y: f.y, rot: f.rot, timer: f.timer, tier: f.tier, made: f.made, inBuf: f.inBuf, outBuf: f.outBuf,
        stock: f.stock, fuel: f.fuel, ore: f.ore, charge: f.charge, smelting: f.smelting || null, recipe: f.recipe, filter: f.filter,
        outputOn: f.outputOn, level: f.level, carry: f.carry, mineType: f.mineType });
    }
    const trees = [];
    for (const [i, t] of this.treeTimer) trees.push([i, Math.round(t)]);
    return { belts, facs, explored: rle(this.explored), trees, time: this.time, made: this.made,
      found: { regions: this.regions.filter((r) => r.found).map((r) => r.id), habitats: this.habitats.map((h) => [h.found ? 1 : 0, h.alive || 0]), treasures: this.treasures.map((t) => (t.found ? 1 : 0) + (t.taken ? 2 : 0)) } };
  }
  restore(s) {
    this.time = s.time || 0; this.made = s.made || {};
    if (s.explored) { unrle(s.explored, this.explored); this.exploredCount = this.explored.reduce((a, b) => a + b, 0); }
    for (const [i, t] of s.trees || []) { if (this.tree[i]) { this.tree[i] = 2; this.treeTimer.set(i, t); } }
    const fr = s.found || {};
    for (const id of fr.regions || []) { const r = this.regions.find((x) => x.id === id); if (r) r.found = true; }
    (fr.habitats || []).forEach(([f], k) => { if (this.habitats[k]) this.habitats[k].found = !!f; });
    (fr.treasures || []).forEach((v, k) => { if (this.treasures[k]) { this.treasures[k].found = !!(v & 1); this.treasures[k].taken = !!(v & 2); } });
    for (const fd of s.facs || []) {
      if (!FACILITIES[fd.type]) continue;
      const f = this.placeFacility(fd.type, fd.x, fd.y, fd.rot || 'E', { recipe: fd.recipe, filter: fd.filter, outputOn: fd.outputOn });
      if (!f) continue;
      Object.assign(f, { timer: +fd.timer || 0, tier: fd.tier || 0, made: fd.made || 0, inBuf: fd.inBuf || {}, outBuf: fd.outBuf || [],
        stock: fd.stock || {}, fuel: fd.fuel || [], ore: fd.ore || [], charge: fd.charge || 0, smelting: fd.smelting || null,
        level: fd.level || 0, carry: fd.carry || {} });
      if (fd.mineType) f.mineType = fd.mineType;
    }
    for (const [x, y, o, tier, items] of s.belts || []) {
      const r = this.placeBelt(x, y, DIRS[o] || 'E', tier || 0);
      if (!r) continue;
      for (const [t, p] of items || []) if (ITEMS[t]) r.belt.items.push(newItem(t, Math.min(1, Math.max(0, +p || 0))));
      r.belt.items.sort((a, c) => c.p - a.p);
    }
    this.reshapeAll();
  }
}
function defaultRecipe(station) {
  const r = Object.values(RECIPE_BY_ID).find((x) => x.stations.includes(station) && !x.tech);
  return r ? r.id : (Object.values(RECIPE_BY_ID).find((x) => x.stations.includes(station))?.id || null);
}
export function rle(arr) { const out = []; let v = arr[0], n = 0; for (let i = 0; i < arr.length; i++) { if (arr[i] === v) n++; else { out.push(v, n); v = arr[i]; n = 1; } } out.push(v, n); return out; }
export function unrle(r, arr) { let i = 0; for (let k = 0; k < r.length; k += 2) { arr.fill(r[k], i, i + r[k + 1]); i += r[k + 1]; } }
