import { FACILITY_DEFS, BELT_SPEED, OUT_CAP } from '../data/defs.js';
import { TILE, FACILITIES, ITEMS, STATUS_LAMP } from '../art/manifest.js';

export const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]]; // right, down, left, up
const ANGLE = [0, 90, 180, 270];
const ARROW_FRAME = [3, 1, 2, 0]; // auto_signs: up, down, left, right
const DEPTH_BELT = 5, DEPTH_ITEM = 6;

export function makeItemSprite(scene, itemId, x, y) {
  const v = ITEMS[itemId];
  const s = scene.add.image(x, y, v.tex, v.frame ?? 0).setScale(v.scale ?? 1);
  s.setDepth(DEPTH_ITEM);
  return s;
}

/**
 * Grid-based factory. Every facility occupies exactly its footprint cells,
 * which is also its collision area (occ grid shared with world blockers).
 */
export class Factory {
  constructor(scene, grid) {
    this.scene = scene;
    this.grid = grid;          // { w, h, occ: Array<Array<obj|null>> }
    this.list = [];
    this.onDeliver = () => {};
  }

  // ── placement ────────────────────────────────────────────────────────────
  canPlace(type, x, y) {
    const d = FACILITY_DEFS[type];
    for (let j = 0; j < d.h; j++) for (let i = 0; i < d.w; i++) {
      const cx = x + i, cy = y + j;
      if (cx < 0 || cy < 0 || cx >= this.grid.w || cy >= this.grid.h) return false;
      if (this.grid.occ[cy][cx]) return false;
    }
    return true;
  }

  place(type, x, y, dir = 0) {
    if (!this.canPlace(type, x, y)) return null;
    const def = FACILITY_DEFS[type];
    const art = FACILITIES[type];
    const f = { type, def, art, x, y, w: def.w, h: def.h, dir, inBuf: {}, outBuf: {}, progress: 0, state: 'idle', timer: 0, slot: null };
    const cx = (x + def.w / 2) * TILE, cy = (y + def.h / 2) * TILE;
    f.cx = cx; f.cy = cy;

    if (def.kind === 'belt') {
      // TileSprite lets us scroll the belt texture -> animated, perfectly seamless
      f.sprite = this.scene.add.tileSprite(cx, cy, 32, 32, art.tex).setScale(art.scale).setAngle(ANGLE[dir]).setDepth(DEPTH_BELT);
    } else {
      f.sprite = this.scene.add.sprite(cx + (art.ox ?? 0), (y + def.h) * TILE + (art.oy ?? 0), art.tex, art.frame ?? 0)
        .setOrigin(0.5, 1).setScale(art.scale);
      f.sprite.setDepth(1000 + (y + def.h) * TILE);
      if (def.kind === 'machine' || def.kind === 'source') {
        const [dx, dy] = DIRS[dir];
        f.arrow = this.scene.add.image(cx + dx * (def.w * TILE / 2 - 6), cy + dy * (def.h * TILE / 2 - 6), 'auto_signs', ARROW_FRAME[dir])
          .setDepth(f.sprite.depth + 1).setScale(1).setAlpha(0.9);
      }
      if (def.kind === 'machine') {
        f.lamp = this.scene.add.image(cx + def.w * TILE / 2 - 10, y * TILE - 2, 'auto_signs', STATUS_LAMP.idle)
          .setScale(1).setDepth(f.sprite.depth + 2);
        // shrink the 32px sign to a ~16px lamp by cropping to its centre circle
        f.lamp.setCrop(8, 8, 16, 16);
      }
    }
    for (let j = 0; j < def.h; j++) for (let i = 0; i < def.w; i++) this.grid.occ[y + j][x + i] = f;
    this.list.push(f);
    this.applyVisual(f);
    return f;
  }

  remove(f) {
    for (let j = 0; j < f.h; j++) for (let i = 0; i < f.w; i++) this.grid.occ[f.y + j][f.x + i] = null;
    f.sprite.destroy(); f.arrow?.destroy(); f.lamp?.destroy(); f.slot?.sprite.destroy();
    this.list = this.list.filter((o) => o !== f);
  }

  at(x, y) {
    const o = this.grid.occ[y]?.[x];
    return o && o.def ? o : null;
  }

  frontCell(f) {
    const [dx, dy] = DIRS[f.dir];
    if (f.dir === 0) return [f.x + f.w, f.y + Math.floor((f.h - 1) / 2)];
    if (f.dir === 2) return [f.x - 1, f.y + Math.floor((f.h - 1) / 2)];
    if (f.dir === 1) return [f.x + Math.floor((f.w - 1) / 2), f.y + f.h];
    return [f.x + Math.floor((f.w - 1) / 2) + 0 * dx, f.y - 1 + 0 * dy];
  }

  // ── item transfer ────────────────────────────────────────────────────────
  /** Try to hand `item` to facility t, arriving while travelling in direction `moveDir`. */
  offer(t, item, moveDir) {
    if (!t) return false;
    const k = t.def.kind;
    if (k === 'belt') {
      if (t.slot) return false;
      if ((t.dir + 2) % 4 === moveDir) return false; // head-on
      t.slot = { item, t: 0, from: moveDir, sprite: makeItemSprite(this.scene, item, 0, 0) };
      this.posItem(t);
      return true;
    }
    if (k === 'machine') {
      const need = t.def.recipe.in[item];
      if (!need) return false;
      if ((t.inBuf[item] ?? 0) >= need * 2) return false;
      t.inBuf[item] = (t.inBuf[item] ?? 0) + 1;
      return true;
    }
    if (k === 'sink') {
      if (!t.def.accepts.includes(item)) return false;
      this.onDeliver(item, t);
      return true;
    }
    if (k === 'source') {
      t.inBuf[item] = (t.inBuf[item] ?? 0) + 1;
      return true;
    }
    return false;
  }

  /** Called by workers / guild master dropping resources into a hopper. */
  deposit(f, item, n = 1) {
    f.inBuf[item] = (f.inBuf[item] ?? 0) + n;
  }

  pushOut(f, item) {
    const [fx, fy] = this.frontCell(f);
    return this.offer(this.at(fx, fy), item, f.dir);
  }

  posItem(b) {
    const s = b.slot;
    const half = TILE / 2;
    let x, y;
    if (s.t < 0.5) {
      // from the entry edge toward the centre (handles turns smoothly)
      const [ex, ey] = DIRS[s.from];
      const k = (0.5 - s.t) * 2;
      x = b.cx - ex * half * k; y = b.cy - ey * half * k;
    } else {
      const [dx, dy] = DIRS[b.dir];
      const k = (s.t - 0.5) * 2;
      x = b.cx + dx * half * k; y = b.cy + dy * half * k;
    }
    s.sprite.setPosition(Math.round(x), Math.round(y));
  }

  // ── simulation ───────────────────────────────────────────────────────────
  update(dt) {
    for (const f of this.list) {
      const k = f.def.kind;
      if (k === 'belt') {
        // scroll the belt texture (texture-space px; 32px tile, 1 cell = 32 tex px)
        f.sprite.tilePositionX -= BELT_SPEED * 32 * dt;
        if (f.slot) {
          f.slot.t = Math.min(1, f.slot.t + BELT_SPEED * dt);
          if (f.slot.t >= 1) {
            const [dx, dy] = DIRS[f.dir];
            const item = f.slot.item, spr = f.slot.sprite;
            const target = this.at(f.x + dx, f.y + dy);
            const prev = f.slot;
            f.slot = null;
            if (this.offer(target, item, f.dir)) {
              spr.destroy();
            } else {
              f.slot = prev;
            }
          }
          if (f.slot) this.posItem(f);
        }
      } else if (k === 'source') {
        f.timer += dt;
        const item = Object.keys(f.inBuf).find((i) => f.inBuf[i] > 0);
        if (item && f.timer >= f.def.rate) {
          if (this.pushOut(f, item)) { f.inBuf[item]--; f.timer = 0; }
        }
      } else if (k === 'machine') {
        this.stepMachine(f, dt);
      }
    }
  }

  stepMachine(f, dt) {
    const r = f.def.recipe;
    // flush output first
    for (const item of Object.keys(f.outBuf)) {
      if (f.outBuf[item] > 0 && this.pushOut(f, item)) f.outBuf[item]--;
    }
    const outCount = Object.values(f.outBuf).reduce((a, b) => a + b, 0);
    let state;
    if (f.progress > 0) {
      state = 'working';
      f.progress += dt / r.time;
      if (f.progress >= 1) {
        f.progress = 0;
        for (const [item, n] of Object.entries(r.out)) f.outBuf[item] = (f.outBuf[item] ?? 0) + n;
      }
    } else if (outCount >= OUT_CAP) {
      state = 'blocked';
    } else if (Object.entries(r.in).every(([item, n]) => (f.inBuf[item] ?? 0) >= n)) {
      for (const [item, n] of Object.entries(r.in)) f.inBuf[item] -= n;
      f.progress = 0.0001;
      state = 'working';
    } else {
      state = 'idle';
    }
    if (state !== f.state) { f.state = state; this.applyVisual(f); }
  }

  applyVisual(f) {
    if (f.def.kind !== 'machine') return;
    const a = f.art;
    if (f.state === 'working') {
      f.sprite.clearTint();
      if (a.work) f.sprite.play(a.work, true);
    } else {
      f.sprite.stop();
      f.sprite.setFrame(a.frame ?? 0);
      f.sprite.setTint(f.state === 'blocked' ? 0xd8b0a8 : 0xa8a8a8);
    }
    f.lamp?.setFrame(STATUS_LAMP[f.state]);
  }
}
