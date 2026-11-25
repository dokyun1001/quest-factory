// Pure simulation (no Phaser). Fixed-step logistics, independent of rendering.
import { BELT_SPEED, ITEM_GAP, DISCOVER_RADIUS } from '../core/config.js';
import { VEC, OPP, DIRS } from '../core/dir.js';
import { FACILITIES } from '../data/facilities.js';
import { ITEMS, ITEM_IDS } from '../data/items.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class Emitter {
  constructor() { this.h = {}; }
  on(n, f) { (this.h[n] ||= []).push(f); }
  emit(n, ...a) { const l = this.h[n]; if (l) for (const f of l) f(...a); }
}

const itemPool = [];
const newItem = (t, p) => { const it = itemPool.pop() || { t: '', p: 0 }; it.t = t; it.p = p; return it; };
const freeItem = (it) => { itemPool.push(it); };

export class World {
  constructor({ w, h, seed, kind }) {
    this.w = w; this.h = h; this.seed = seed; this.kind = kind;
    const n = w * h;
    this.ground = new Uint8Array(n);        // 0..3 visual variants (placeholder grass)
    this.deposit = new Uint8Array(n);       // 0 none, 1 iron_ore, 2 gold_ore
    this.cluster = new Int16Array(n).fill(-1);
    this.tree = new Uint8Array(n);
    this.staticSolid = new Uint8Array(n);   // guild hall placeholder etc.
    this.occ = new Int32Array(n);           // facility id (0 = none)
    this.belts = new Array(n).fill(null);
    this.beltCount = 0;
    this.clusters = [];
    this.facilities = new Map();
    this.nextFacId = 1;
    this.order = [];
    this.topoDirty = true;
    this.events = new Emitter();
    this.time = 0;
    this.landmarks = [];
  }

  idx(x, y) { return y * this.w + x; }
  inBounds(x, y) { return x >= 0 && y >= 0 && x < this.w && y < this.h; }
  beltAt(x, y) { return this.inBounds(x, y) ? this.belts[y * this.w + x] : null; }
  facAt(x, y) { if (!this.inBounds(x, y)) return null; const id = this.occ[y * this.w + x]; return id ? this.facilities.get(id) : null; }
  solidAt(x, y) {
    if (!this.inBounds(x, y)) return true;
    const i = y * this.w + x;
    return this.tree[i] === 1 || this.staticSolid[i] === 1 || this.occ[i] !== 0;
  }
  buildBlocked(x, y) {
    if (!this.inBounds(x, y)) return true;
    const i = y * this.w + x;
    return this.tree[i] === 1 || this.staticSolid[i] === 1;
  }

  // ---------- map generation ----------
  addCluster(type, cx, cy, tiles, discovered = false) {
    const id = this.clusters.length;
    const list = [];
    for (const [dx, dy] of tiles) {
      const x = cx + dx, y = cy + dy;
      if (!this.inBounds(x, y)) continue;
      const i = this.idx(x, y);
      this.deposit[i] = type; this.cluster[i] = id; this.tree[i] = 0; list.push(i);
    }
    this.clusters.push({ id, type, tiles: list, discovered, cx, cy });
    return id;
  }

  // ---------- discovery ----------
  discoverAround(px, py) {
    const r2 = DISCOVER_RADIUS * DISCOVER_RADIUS;
    for (const c of this.clusters) {
      if (c.discovered) continue;
      const dx = c.cx - px, dy = c.cy - py;
      if (dx * dx + dy * dy <= r2) { c.discovered = true; this.events.emit('discover', c); }
    }
  }
  depositVisible(x, y) {
    if (!this.inBounds(x, y)) return 0;
    const i = this.idx(x, y); const c = this.cluster[i];
    return c >= 0 && this.clusters[c].discovered ? this.deposit[i] : 0;
  }

  // ---------- belts ----------
  canPlaceBelt(x, y) {
    return this.inBounds(x, y) && !this.buildBlocked(x, y) && this.occ[this.idx(x, y)] === 0;
  }
  placeBelt(x, y, out) {
    if (!this.canPlaceBelt(x, y)) return null;
    const i = this.idx(x, y);
    let b = this.belts[i];
    if (b) {
      if (b.out === out) return b;
      b.out = out;
    } else {
      b = { x, y, i, out, in: OPP[out], items: [], nextBelt: null, nextFac: null, prev: null };
      this.belts[i] = b; this.beltCount++;
    }
    this.reshapeAround(x, y);
    this.events.emit('belt', b, 'add');
    return b;
  }
  removeBelt(x, y) {
    const b = this.beltAt(x, y);
    if (!b) return false;
    for (const it of b.items) freeItem(it);
    b.items.length = 0;
    this.belts[b.i] = null; this.beltCount--;
    this.events.emit('belt', b, 'remove');
    this.reshapeAround(x, y);
    return true;
  }
  // Does something at side `d` of tile (x,y) push into (x,y)?
  feedsFrom(x, y, d) {
    const nx = x + VEC[d][0], ny = y + VEC[d][1];
    const nb = this.beltAt(nx, ny);
    if (nb) return nb.out === OPP[d];
    const f = this.facAt(nx, ny);
    if (f) for (const p of this.portsOf(f)) if (p.kind === 'out' && p.tx === nx && p.ty === ny && p.edge === OPP[d]) return true;
    return false;
  }
  // Auto shape: straight if fed from behind; corner if fed from exactly one side; else straight.
  computeInput(b) {
    const back = OPP[b.out];
    if (this.feedsFrom(b.x, b.y, back)) return back;
    let side = null, count = 0;
    for (const d of DIRS) {
      if (d === b.out || d === back) continue;
      if (this.feedsFrom(b.x, b.y, d)) { side = d; count++; }
    }
    return count === 1 ? side : back;
  }
  reshapeAround(x, y) {
    const pts = [[x, y], [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
    for (const [px, py] of pts) {
      const b = this.beltAt(px, py);
      if (!b) continue;
      const ni = this.computeInput(b);
      if (ni !== b.in) { b.in = ni; this.events.emit('belt', b, 'shape'); }
    }
    this.topoDirty = true;
  }
  reshapeAll() {
    for (const b of this.belts) if (b) b.in = this.computeInput(b);
    this.topoDirty = true;
  }

  rebuildTopology() {
    const list = [];
    for (const b of this.belts) if (b) { b.prev = null; b.nextBelt = null; b.nextFac = null; list.push(b); }
    for (const b of list) {
      const tx = b.x + VEC[b.out][0], ty = b.y + VEC[b.out][1];
      const nb = this.beltAt(tx, ty);
      if (nb) { if (nb.in === OPP[b.out]) { b.nextBelt = nb; nb.prev = b; } continue; }
      const f = this.facAt(tx, ty);
      if (f) for (const p of this.portsOf(f)) {
        if (p.kind === 'in' && p.tx === tx && p.ty === ty && p.edge === OPP[b.out]) { b.nextFac = f; break; }
      }
    }
    // Downstream-first processing order: start at chain ends, walk upstream.
    const order = []; const seen = new Set();
    for (const b of list) {
      if (b.nextBelt) continue;
      for (let c = b; c && !seen.has(c); c = c.prev) { seen.add(c); order.push(c); }
    }
    for (const b of list) { // remaining = closed loops
      if (seen.has(b)) continue;
      for (let c = b; c && !seen.has(c); c = c.prev) { seen.add(c); order.push(c); }
    }
    this.order = order;
    this.topoDirty = false;
  }

  beltHasRoomAtStart(b) {
    const n = b.items.length;
    return n === 0 || b.items[n - 1].p >= ITEM_GAP;
  }

  // ---------- facilities ----------
  portsOf(f) {
    const def = FACILITIES[f.type];
    return def.ports.map((p) => ({ kind: p.kind, tx: f.x + p.tile[0], ty: f.y + p.tile[1], edge: def.rotatable ? f.rot : p.edge }));
  }
  canPlaceFacility(type, x, y) {
    const def = FACILITIES[type];
    const [fw, fh] = def.footprint;
    let onDeposit = 0;
    for (let dy = 0; dy < fh; dy++) for (let dx = 0; dx < fw; dx++) {
      const tx = x + dx, ty = y + dy;
      if (!this.inBounds(tx, ty) || this.buildBlocked(tx, ty)) return { ok: false, why: '설치할 수 없는 위치' };
      const i = this.idx(tx, ty);
      if (this.occ[i] || this.belts[i]) return { ok: false, why: '다른 구조물과 겹침' };
      if (this.depositVisible(tx, ty)) onDeposit++;
    }
    if (def.needsDeposit && !onDeposit) return { ok: false, why: '발견한 광맥 위에만 설치' };
    return { ok: true };
  }
  placeFacility(type, x, y, rot = 'E', extra = {}) {
    if (!this.canPlaceFacility(type, x, y).ok) return null;
    const def = FACILITIES[type];
    const f = { id: this.nextFacId++, type, x, y, rot, timer: 0, inBuf: [], outBuf: [], item: extra.item || 'wood',
      counts: {}, open: true, depositType: null, made: 0 };
    if (def.needsDeposit) {
      const tally = {};
      for (let dy = 0; dy < def.footprint[1]; dy++) for (let dx = 0; dx < def.footprint[0]; dx++) {
        const d = this.depositVisible(x + dx, y + dy); if (d) tally[d] = (tally[d] || 0) + 1;
      }
      const best = Object.keys(tally).sort((a, b) => tally[b] - tally[a])[0];
      f.depositType = best === '2' ? 'gold_ore' : 'iron_ore';
    }
    for (let dy = 0; dy < def.footprint[1]; dy++) for (let dx = 0; dx < def.footprint[0]; dx++) this.occ[this.idx(x + dx, y + dy)] = f.id;
    this.facilities.set(f.id, f);
    this.reshapeFacilityNeighbors(f);
    this.events.emit('fac', f, 'add');
    return f;
  }
  removeFacility(f) {
    const def = FACILITIES[f.type];
    for (let dy = 0; dy < def.footprint[1]; dy++) for (let dx = 0; dx < def.footprint[0]; dx++) this.occ[this.idx(f.x + dx, f.y + dy)] = 0;
    this.facilities.delete(f.id);
    this.reshapeFacilityNeighbors(f);
    this.events.emit('fac', f, 'remove');
  }
  rotateFacility(f) {
    const def = FACILITIES[f.type];
    if (!def.rotatable) return;
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
  facAccepts(f, t) {
    switch (f.type) {
      case 'storage': return f.open;
      case 'smelter': { const def = FACILITIES.smelter; return !!def.recipes[t] && f.inBuf.length < def.inCap; }
      default: return false;
    }
  }
  facReceive(f, t) {
    if (f.type === 'storage') f.counts[t] = (f.counts[t] || 0) + 1;
    else f.inBuf.push(t);
  }
  pushOut(f) {
    if (!f.outBuf.length) return;
    for (const p of this.portsOf(f)) {
      if (p.kind !== 'out') continue;
      const tx = p.tx + VEC[p.edge][0], ty = p.ty + VEC[p.edge][1];
      const b = this.beltAt(tx, ty);
      if (b) {
        if (b.in === OPP[p.edge] && this.beltHasRoomAtStart(b)) b.items.push(newItem(f.outBuf.shift(), 0));
        return;
      }
      const g = this.facAt(tx, ty);
      if (g && g !== f) {
        for (const q of this.portsOf(g)) {
          if (q.kind === 'in' && q.tx === tx && q.ty === ty && q.edge === OPP[p.edge] && this.facAccepts(g, f.outBuf[0])) {
            this.facReceive(g, f.outBuf.shift()); return;
          }
        }
      }
      return;
    }
  }
  tickFacility(f, dt) {
    const def = FACILITIES[f.type];
    if (f.type === 'miner' || f.type === 'supplier') {
      if (f.outBuf.length < def.outCap) {
        f.timer += dt;
        if (f.timer >= def.cycleSec) { f.timer = 0; f.outBuf.push(f.type === 'miner' ? f.depositType : f.item); f.made++; }
      }
    } else if (f.type === 'smelter') {
      if (f.inBuf.length && f.outBuf.length < def.outCap) {
        f.timer += dt;
        if (f.timer >= def.cycleSec) { f.timer = 0; f.outBuf.push(def.recipes[f.inBuf.shift()]); f.made++; }
      } else if (!f.inBuf.length) f.timer = 0;
    }
    this.pushOut(f);
  }

  // ---------- fixed step ----------
  tick(dt) {
    if (this.topoDirty) this.rebuildTopology();
    this.time += dt;
    for (const f of this.facilities.values()) this.tickFacility(f, dt);
    const adv = BELT_SPEED * dt;
    const order = this.order;
    for (let k = 0; k < order.length; k++) {
      const b = order[k];
      const items = b.items;
      const n = items.length;
      if (!n) continue;
      // Dead end (nothing downstream): stop inside the tile instead of overhanging the edge.
      let limit = b.nextBelt || b.nextFac ? 1 : 1 - ITEM_GAP / 2;
      for (let i = 0; i < n; i++) {
        const it = items[i];
        let np = it.p + adv;
        if (np > limit) np = limit;
        if (np > it.p) it.p = np;
        limit = it.p - ITEM_GAP;
      }
      const front = items[0];
      if (front.p >= 1) {
        const nb = b.nextBelt;
        if (nb) {
          if (this.beltHasRoomAtStart(nb)) { items.shift(); front.p = 0; nb.items.push(front); }
        } else if (b.nextFac && this.facAccepts(b.nextFac, front.t)) {
          items.shift(); this.facReceive(b.nextFac, front.t); freeItem(front);
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
      const items = [];
      for (const it of b.items) items.push(ITEM_IDS.indexOf(it.t), Math.round(it.p * 1000) / 1000);
      belts.push([b.x, b.y, DIRS.indexOf(b.out), items]);
    }
    const facs = [];
    for (const f of this.facilities.values()) {
      facs.push({ type: f.type, x: f.x, y: f.y, rot: f.rot, timer: f.timer, inBuf: f.inBuf, outBuf: f.outBuf,
        item: f.item, counts: f.counts, open: f.open, made: f.made });
    }
    return { belts, facs, discovered: this.clusters.filter((c) => c.discovered).map((c) => c.id), time: this.time };
  }
  restore(s) {
    this.time = s.time || 0;
    for (const id of s.discovered || []) if (this.clusters[id]) this.clusters[id].discovered = true;
    for (const fd of s.facs || []) {
      if (!FACILITIES[fd.type]) continue;
      const f = this.placeFacility(fd.type, fd.x, fd.y, fd.rot || 'E', { item: ITEMS[fd.item] ? fd.item : 'wood' });
      if (!f) continue;
      f.timer = +fd.timer || 0;
      f.inBuf = (fd.inBuf || []).filter((t) => ITEMS[t]);
      f.outBuf = (fd.outBuf || []).filter((t) => ITEMS[t]);
      f.counts = fd.counts || {}; f.open = fd.open !== false; f.made = fd.made || 0;
    }
    for (const [x, y, o, items] of s.belts || []) {
      const b = this.placeBelt(x, y, DIRS[o] || 'E');
      if (!b) continue;
      for (let i = 0; i + 1 < items.length; i += 2) {
        const t = ITEM_IDS[items[i]]; if (t) b.items.push(newItem(t, Math.min(1, Math.max(0, +items[i + 1] || 0))));
      }
      b.items.sort((a, c) => c.p - a.p);
    }
    this.reshapeAll();
  }
}
