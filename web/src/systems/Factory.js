import { FACILITY_DEFS, BELT_SPEED, OUT_CAP, UPGRADES } from '../data/defs.js';
import { TILE, FACILITIES, ITEMS, STATUS_LAMP } from '../art/manifest.js';

export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // right, down, left, up
const ANGLE = [0, 90, 180, 270];
const ARROW_FRAME = [3, 1, 2, 0]; // auto_signs: up, down, left, right
export const DEPTH = { ground: 0, belt: 5, item: 6, world: 1000, fx: 50000 };

export function makeItemSprite(scene, itemId, x, y) {
  const v = ITEMS[itemId];
  return scene.add.image(x, y, v.tex, v.frame ?? 0).setScale(v.scale ?? 1).setDepth(DEPTH.item);
}

/**
 * Grid factory simulation. A facility occupies exactly its footprint cells,
 * which is also its collision area (shared occupancy grid with world blockers).
 * Items physically ride belts: one item per belt cell, interpolated each frame.
 */
export class Factory {
  constructor(scene, grid, hooks) {
    this.scene = scene;
    this.grid = grid;           // { w, h, occ: Array<Array<obj|null>> }
    this.hooks = hooks;         // { deliver(item,f), takeStock(item):bool, bonus(stat):number }
    this.list = [];
    this.belts = [];
  }

  // ── placement ────────────────────────────────────────────────────────────
  canPlace(type, x, y) {
    const d = FACILITY_DEFS[type];
    for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) {
      const cx = x + i, cy = y + j;
      if (cx < 0 || cy < 0 || cx >= this.grid.w || cy >= this.grid.h) return false;
      if (this.grid.occ[cy][cx]) return false;
      if (this.grid.blocked(cx, cy)) return false;
    }
    return true;
  }

  place(type, x, y, dir = 0, extra = {}) {
    if (!this.canPlace(type, x, y)) return null;
    const def = FACILITY_DEFS[type];
    const art = FACILITIES[type];
    const f = {
      type, def, art, x, y, w: def.w, h: def.h, dir,
      inBuf: {}, outBuf: {}, progress: 0, state: 'idle', timer: 0, slot: null,
      level: extra.level ?? 1, filter: extra.filter ?? 'gold_ore',
    };
    f.cx = (x + def.w / 2) * TILE; f.cy = (y + def.h / 2) * TILE;
    const sc = this.scene;
    if (def.kind === 'belt') {
      // TileSprite: scrolling the texture animates the belt and keeps joints seamless
      f.sprite = sc.add.tileSprite(f.cx, f.cy, 32, 32, art.tex).setScale(art.scale).setAngle(ANGLE[dir]).setDepth(DEPTH.belt);
      this.belts.push(f);
    } else {
      f.sprite = sc.add.sprite(f.cx, (y + def.h) * TILE + (art.oy ?? 0), art.tex, art.frame ?? 0)
        .setOrigin(0.5, 1).setScale(art.scale).setDepth(DEPTH.world + (y + def.h) * TILE - 1);
      if (def.kind === 'machine' || def.kind === 'source') {
        const [dx, dy] = DIRS[dir];
        f.arrow = sc.add.image(f.cx + dx * (def.w * TILE / 2 - 4), f.cy + dy * (def.h * TILE / 2 - 4), 'auto_signs', ARROW_FRAME[dir])
          .setDepth(f.sprite.depth + 1).setAlpha(0.95);
      }
      if (def.kind === 'machine') {
        f.lamp = sc.add.image((x + def.w) * TILE - 10, y * TILE + 6, 'auto_signs', STATUS_LAMP.idle)
          .setDepth(f.sprite.depth + 2);
        f.lamp.setCrop(8, 8, 16, 16);
        f.stars = sc.add.text(x * TILE + 4, y * TILE - 2, '', { fontFamily: 'Galmuri11', fontSize: '12px', color: '#ffe27a', stroke: '#3a2a10', strokeThickness: 3 })
          .setDepth(f.sprite.depth + 2);
      }
      if (def.kind === 'source') {
        f.badge = makeItemSprite(sc, f.filter, f.cx, f.cy - 34).setDepth(f.sprite.depth + 2);
      }
    }
    for (let j = 0; j < def.h; j++) for (let i = 0; i < def.w; i++) this.grid.occ[y + j][x + i] = f;
    this.list.push(f);
    this.refresh(f);
    return f;
  }

  remove(f) {
    for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) this.grid.occ[f.y + j][f.x + i] = null;
    for (const s of [f.sprite, f.arrow, f.lamp, f.stars, f.badge, f.slot?.sprite]) s?.destroy();
    this.list = this.list.filter((o) => o !== f);
    this.belts = this.belts.filter((o) => o !== f);
  }

  at(x, y) {
    const o = this.grid.occ[y]?.[x];
    return o && o.def ? o : null;
  }

  frontCell(f) {
    const mx = f.x + Math.floor((f.w - 1) / 2), my = f.y + Math.floor((f.h - 1) / 2);
    if (f.dir === 0) return [f.x + f.w, my];
    if (f.dir === 2) return [f.x - 1, my];
    if (f.dir === 1) return [mx, f.y + f.h];
    return [mx, f.y - 1];
  }

  setFilter(f, item) {
    f.filter = item;
    f.badge?.destroy();
    f.badge = makeItemSprite(this.scene, item, f.cx, f.cy - 34).setDepth(f.sprite.depth + 2);
  }

  upgrade(f) {
    f.level = Math.min(UPGRADES.maxLevel, f.level + 1);
    this.refresh(f);
  }

  // ── item transfer ────────────────────────────────────────────────────────
  accepts(t, item) {
    const k = t.def.kind;
    if (k === 'machine') {
      const r = t.def.recipe;
      if (r.anyIn) return r.anyIn.includes(item) && this.bufTotal(t.inBuf) < 2;
      const need = r.in[item];
      return !!need && (t.inBuf[item] ?? 0) < need * 2;
    }
    if (k === 'sink') return t.def.accepts.includes(item);
    return false;
  }

  /** Try to hand `item` to facility t, arriving while travelling in direction `moveDir`. */
  offer(t, item, moveDir) {
    if (!t) return false;
    if (t.def.kind === 'belt') {
      if (t.slot || (t.dir + 2) % 4 === moveDir) return false;
      t.slot = { item, t: 0, from: moveDir, sprite: makeItemSprite(this.scene, item, 0, 0) };
      this.posItem(t);
      return true;
    }
    if (!this.accepts(t, item)) return false;
    if (t.def.kind === 'sink') this.hooks.deliver(item, t);
    else t.inBuf[item] = (t.inBuf[item] ?? 0) + 1;
    return true;
  }

  pushOut(f, item) {
    const [fx, fy] = this.frontCell(f);
    return this.offer(this.at(fx, fy), item, f.dir);
  }

  bufTotal(b) { return Object.values(b).reduce((a, c) => a + c, 0); }

  posItem(b) {
    const s = b.slot, half = TILE / 2;
    let x, y;
    if (s.t < 0.5) { // entry edge → centre (smooth corners)
      const [ex, ey] = DIRS[s.from]; const k = (0.5 - s.t) * 2;
      x = b.cx - ex * half * k; y = b.cy - ey * half * k;
    } else {
      const [dx, dy] = DIRS[b.dir]; const k = (s.t - 0.5) * 2;
      x = b.cx + dx * half * k; y = b.cy + dy * half * k;
    }
    s.sprite.setPosition(Math.round(x), Math.round(y));
  }

  // ── simulation ───────────────────────────────────────────────────────────
  update(dt) {
    const beltSpeed = BELT_SPEED * (1 + this.hooks.bonus('beltSpeed'));
    const scroll = beltSpeed * 32 * dt;
    for (const f of this.belts) {
      f.sprite.tilePositionX -= scroll;
      const s = f.slot;
      if (!s) continue;
      if (s.t < 1) s.t = Math.min(1, s.t + beltSpeed * dt);
      if (s.t >= 1) {
        const [dx, dy] = DIRS[f.dir];
        f.slot = null;                       // free first so a loop of belts can advance
        if (this.offer(this.at(f.x + dx, f.y + dy), s.item, f.dir)) { s.sprite.destroy(); continue; }
        f.slot = s;
      }
      this.posItem(f);
    }
    for (const f of this.list) {
      if (f.def.kind === 'source') this.stepSource(f, dt);
      else if (f.def.kind === 'machine') this.stepMachine(f, dt);
    }
  }

  stepSource(f, dt) {
    f.timer += dt;
    if (f.timer < f.def.rate) return;
    if (!f.pending && this.hooks.takeStock(f.filter)) f.pending = f.filter;
    if (f.pending && this.pushOut(f, f.pending)) { f.pending = null; f.timer = 0; }
  }

  stepMachine(f, dt) {
    const r = f.def.recipe;
    for (const item of Object.keys(f.outBuf)) if (f.outBuf[item] > 0 && this.pushOut(f, item)) f.outBuf[item]--;
    const speed = UPGRADES.speed[f.level - 1] * (1 + this.hooks.bonus('machineSpeed'));
    let state;
    if (f.progress > 0) {
      state = 'working';
      f.progress += (dt * speed) / r.time;
      if (f.progress >= 1) {
        f.progress = 0;
        for (const [item, n] of Object.entries(r.out)) f.outBuf[item] = (f.outBuf[item] ?? 0) + n;
      }
    } else if (this.bufTotal(f.outBuf) >= OUT_CAP) {
      state = 'blocked';
    } else if (this.consume(f, r)) {
      f.progress = 0.0001; state = 'working';
    } else {
      state = 'idle';
    }
    if (state !== f.state) { f.state = state; this.refresh(f); }
  }

  consume(f, r) {
    if (r.anyIn) {
      const it = r.anyIn.find((i) => (f.inBuf[i] ?? 0) > 0);
      if (!it) return false;
      f.inBuf[it]--; return true;
    }
    if (!Object.entries(r.in).every(([i, n]) => (f.inBuf[i] ?? 0) >= n)) return false;
    for (const [i, n] of Object.entries(r.in)) f.inBuf[i] -= n;
    return true;
  }

  /** Visual state: working = animated + green lamp; idle = grey + blue lamp; blocked = red lamp. */
  refresh(f) {
    if (f.def.kind !== 'machine') return;
    const a = f.art;
    if (f.state === 'working') {
      f.sprite.clearTint();
      if (a.work) f.sprite.play(a.work, true);
      if (f.sprite.anims) f.sprite.anims.timeScale = UPGRADES.speed[f.level - 1];
    } else {
      f.sprite.stop(); f.sprite.setFrame(a.frame ?? 0);
      f.sprite.setTint(f.state === 'blocked' ? 0xe0b0a0 : 0xa0a0a8);
    }
    f.lamp?.setFrame(STATUS_LAMP[f.state]);
    f.stars?.setText('★'.repeat(f.level));
  }

  // ── save / load ──────────────────────────────────────────────────────────
  serialize() {
    return this.list.map((f) => ({
      t: f.type, x: f.x, y: f.y, d: f.dir, lv: f.level, fl: f.filter,
      i: f.inBuf, o: f.outBuf, p: f.progress, s: f.slot ? [f.slot.item, f.slot.t, f.slot.from] : null, pd: f.pending ?? null,
    }));
  }

  load(arr) {
    for (const f of [...this.list]) this.remove(f);
    for (const o of arr) {
      const f = this.place(o.t, o.x, o.y, o.d, { level: o.lv, filter: o.fl });
      if (!f) continue;
      f.inBuf = o.i ?? {}; f.outBuf = o.o ?? {}; f.progress = o.p ?? 0; f.pending = o.pd;
      if (o.s) { f.slot = { item: o.s[0], t: o.s[1], from: o.s[2], sprite: makeItemSprite(this.scene, o.s[0], 0, 0) }; this.posItem(f); }
      this.refresh(f);
    }
  }
}
