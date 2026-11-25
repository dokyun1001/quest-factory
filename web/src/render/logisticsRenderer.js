// Renders belts, direction overlay and transported items from the simulation state.
// - Every image comes from ONE shared atlas texture (no per-object texture copies).
// - Belts live in 16x16-tile chunk Blitters; chunks outside the camera are hidden and not animated.
// - Items use one Blitter with a reusable Bob pool; only on-screen items get a Bob.
import { TILE, BELT_FRAME_MS } from '../core/config.js';
import { EDGE } from '../core/dir.js';
import { ITEMS } from '../data/items.js';

const CH = 16; // chunk size in tiles
const SHAPES = ['WE', 'WN', 'WS', 'EW', 'EN', 'ES', 'NW', 'NE', 'NS', 'SW', 'SE', 'SN'];

export class LogisticsRenderer {
  constructor(scene, world) {
    this.scene = scene; this.world = world;
    const atlas = scene.textures.get('atlas');
    this.beltFrames = {}; this.dirFrames = {};
    for (const s of SHAPES) { this.beltFrames[s] = [0, 1, 2, 3].map((f) => atlas.get(`belt_${s}_${f}`)); this.dirFrames[s] = atlas.get(`dir_${s}`); }
    this.itemFrames = {};
    for (const id of Object.keys(ITEMS)) for (const sz of [8, 10, 12]) this.itemFrames[`${id}_${sz}`] = atlas.get(`item_${id}_${sz}`);
    this.chunks = new Map(); // key -> {belt: Blitter, dir: Blitter, count}
    this.bobOf = new Map();  // belt -> {b: Bob, d: Bob, chunk}
    this.phase = 0; this.phaseTime = 0;
    this.showDirs = false;
    this.itemSize = 10;
    this.items = scene.add.blitter(0, 0, 'atlas').setDepth(5);
    this.itemBobs = []; this.itemUsed = 0;
    this.visibleItems = []; // for hover lookup: [x,y,itemId]
    this.visibleChunks = 0;
    for (const b of world.belts) if (b) this.upsert(b);
    world.events.on('belt', (b, what) => (what === 'remove' ? this.remove(b) : this.upsert(b)));
  }
  chunk(b) {
    const cx = Math.floor(b.x / CH), cy = Math.floor(b.y / CH), key = cy * 1000 + cx;
    let c = this.chunks.get(key);
    if (!c) {
      c = { cx, cy, belt: this.scene.add.blitter(0, 0, 'atlas').setDepth(1), dir: this.scene.add.blitter(0, 0, 'atlas').setDepth(2), bobs: new Set(), visible: true };
      c.dir.setVisible(this.showDirs);
      this.chunks.set(key, c);
    }
    return c;
  }
  upsert(b) {
    const shape = b.in + b.out;
    let r = this.bobOf.get(b);
    if (!r) {
      const c = this.chunk(b);
      r = { b: c.belt.create(b.x * TILE, b.y * TILE, this.beltFrames[shape][this.phase]), d: c.dir.create(b.x * TILE, b.y * TILE, this.dirFrames[shape]), chunk: c, belt: b };
      c.bobs.add(r); this.bobOf.set(b, r);
    } else {
      r.b.setFrame(this.beltFrames[shape][this.phase]); r.d.setFrame(this.dirFrames[shape]);
    }
  }
  remove(b) {
    const r = this.bobOf.get(b); if (!r) return;
    r.b.destroy(); r.d.destroy(); r.chunk.bobs.delete(r); this.bobOf.delete(b);
  }
  setShowDirs(v) { this.showDirs = v; for (const c of this.chunks.values()) c.dir.setVisible(v && c.visible); }
  setItemSize(s) { this.itemSize = s; }

  update(dtMs, view) {
    // view: tile rect {x0,y0,x1,y1}
    const cx0 = Math.floor(view.x0 / CH), cy0 = Math.floor(view.y0 / CH), cx1 = Math.floor(view.x1 / CH), cy1 = Math.floor(view.y1 / CH);
    this.phaseTime += dtMs;
    let phaseChanged = false;
    if (this.phaseTime >= BELT_FRAME_MS) { this.phase = (this.phase + Math.floor(this.phaseTime / BELT_FRAME_MS)) % 4; this.phaseTime %= BELT_FRAME_MS; phaseChanged = true; }
    let vis = 0;
    for (const c of this.chunks.values()) {
      const v = c.cx >= cx0 && c.cx <= cx1 && c.cy >= cy0 && c.cy <= cy1;
      if (v !== c.visible) { c.visible = v; c.belt.setVisible(v); c.dir.setVisible(v && this.showDirs); if (v) phaseChanged = true; }
      if (!v) continue;
      vis++;
      if (phaseChanged) for (const r of c.bobs) r.b.setFrame(this.beltFrames[r.belt.in + r.belt.out][this.phase]);
    }
    this.visibleChunks = vis;
    // items
    const size = this.itemSize, half = size / 2;
    let used = 0; const vi = this.visibleItems; vi.length = 0;
    const order = this.world.order;
    for (let k = 0; k < order.length; k++) {
      const b = order[k];
      if (!b.items.length || b.x < view.x0 || b.x > view.x1 || b.y < view.y0 || b.y > view.y1) continue;
      const ei = EDGE[b.in], eo = EDGE[b.out];
      for (const it of b.items) {
        let fx, fy;
        if (it.p < 0.5) { const t = it.p * 2; fx = ei[0] + (0.5 - ei[0]) * t; fy = ei[1] + (0.5 - ei[1]) * t; }
        else { const t = (it.p - 0.5) * 2; fx = 0.5 + (eo[0] - 0.5) * t; fy = 0.5 + (eo[1] - 0.5) * t; }
        const x = (b.x + fx) * TILE, y = (b.y + fy) * TILE;
        let bob = this.itemBobs[used];
        if (!bob) { bob = this.items.create(0, 0, this.itemFrames[`${it.t}_${size}`]); this.itemBobs.push(bob); }
        bob.setFrame(this.itemFrames[`${it.t}_${size}`]);
        bob.x = Math.round(x - half); bob.y = Math.round(y - half);
        bob.visible = true;
        used++;
        vi.push(x, y, it.t);
      }
    }
    for (let i = used; i < this.itemUsed; i++) this.itemBobs[i].visible = false;
    this.itemUsed = used;
  }
  itemNear(wx, wy, r = 6) {
    let best = null, bd = r * r; const vi = this.visibleItems;
    for (let i = 0; i < vi.length; i += 3) { const dx = vi[i] - wx, dy = vi[i + 1] - wy, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = vi[i + 2]; } }
    return best;
  }
}
