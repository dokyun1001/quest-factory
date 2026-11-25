// World rendering: lazily created ground chunks (512x512 canvases), trees, fog of war, facilities, landmarks.
import { FACILITIES } from '../data/facilities.js';
import { TERRAIN } from '../sim/world.js';

const T = 16, CH = 32;
const TILE_FRAME = (w, i) => {
  const t = w.terrain[i];
  if (t === TERRAIN.WATER) return 't_water'; if (t === TERRAIN.SAND) return 't_sand'; if (t === TERRAIN.ROCK) return 't_rock';
  const g = w.ground[i]; return g === 4 ? 't_dark' : g === 5 ? 't_ruin' : `t_grass${g}`;
};

export class WorldView {
  constructor(scene, game) {
    this.scene = scene; this.game = game; this.w = game.world;
    this.ph = scene.textures.get('ph7'); this.phImg = this.ph.getSourceImage();
    this.chunks = new Map(); this.maxChunks = 30;
    this.trees = new Map();
    this.facs = new Map();
    this.animT = 0;
    const W = this.w;
    // fog (1 px per tile, scaled up). Skipped for fully explored lab worlds.
    this.fogOn = W.exploredCount < W.w * W.h;
    if (this.fogOn) {
      if (scene.textures.exists('fog')) scene.textures.remove('fog');
      this.fogTex = scene.textures.createCanvas('fog', W.w, W.h);
      this.fogCtx = this.fogTex.getContext();
      const img = this.fogCtx.createImageData(W.w, W.h);
      for (let i = 0; i < W.explored.length; i++) img.data[i * 4 + 3] = W.explored[i] ? 0 : 255;
      this.fogCtx.putImageData(img, 0, 0); this.fogTex.refresh();
      this.fog = scene.add.image(0, 0, 'fog').setOrigin(0, 0).setScale(T).setDepth(5000);
      W.events.on('reveal', (x0, y0, x1, y1) => this.updateFog(x0, y0, x1, y1));
    }
    for (let y = 0; y < W.h; y++) for (let x = 0; x < W.w; x++) if (W.tree[W.idx(x, y)]) this.treeSprite(x, y);
    W.events.on('tree', (x, y) => this.treeSprite(x, y));
    for (const l of W.landmarks) if (l.kind === 'guild') {
      scene.add.image(l.x * T, (l.y + l.h) * T, 'ph7', 'guild').setOrigin(0, 1).setDepth(1000 + (l.y + l.h) * T);
      scene.add.text((l.x + l.w / 2) * T, (l.y - 0.1) * T, '길드 본관 (임시)', { fontFamily: 'sans-serif', fontSize: '24px', color: '#fff', stroke: '#2a1f22', strokeThickness: 4 }).setOrigin(0.5, 1).setScale(0.25).setDepth(3000);
    }
    this.treasureImgs = W.treasures.map((t) => scene.add.image(t.x * T, (t.y + 1) * T, 'ph7', t.taken ? 'treasure_open' : 'treasure').setOrigin(0, 1).setDepth(1000 + (t.y + 1) * T));
    for (const f of W.facilities.values()) this.onFac(f, 'add');
    W.events.on('fac', (f, what) => this.onFac(f, what));
  }
  treeSprite(x, y) {
    const i = this.w.idx(x, y); const v = this.w.tree[i]; let s = this.trees.get(i);
    if (!v) { if (s) { s.destroy(); this.trees.delete(i); } return; }
    if (!s) { s = this.scene.add.image(x * T, (y + 1) * T, 'ph7', 'tree').setOrigin(0, 1).setDepth(1000 + (y + 1) * T - 2); this.trees.set(i, s); }
    s.setFrame(v === 1 ? 'tree' : 'stump');
  }
  updateFog(x0, y0, x1, y1) {
    const W = this.w; const w = x1 - x0 + 1, h = y1 - y0 + 1;
    const img = this.fogCtx.getImageData(x0, y0, w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) img.data[(y * w + x) * 4 + 3] = W.explored[(y0 + y) * W.w + x0 + x] ? 0 : 255;
    this.fogCtx.putImageData(img, x0, y0); this.fogDirty = true;
  }
  chunk(cx, cy) {
    const key = cy * 1000 + cx; let c = this.chunks.get(key);
    if (c) { c.used = this.scene.time.now; return c; }
    const W = this.w; const k = `gc_${cx}_${cy}`;
    if (this.scene.textures.exists(k)) this.scene.textures.remove(k);
    const tex = this.scene.textures.createCanvas(k, CH * T, CH * T); const ctx = tex.getContext();
    for (let y = 0; y < CH; y++) for (let x = 0; x < CH; x++) {
      const tx = cx * CH + x, ty = cy * CH + y; if (!W.inBounds(tx, ty)) continue;
      const i = W.idx(tx, ty);
      const f = this.ph.get(TILE_FRAME(W, i)); ctx.drawImage(this.phImg, f.cutX, f.cutY, 16, 16, x * T, y * T, 16, 16);
      if (W.deposit[i]) { const d = this.ph.get(`dep_${W.deposit[i]}`); ctx.drawImage(this.phImg, d.cutX, d.cutY, 16, 16, x * T, y * T, 16, 16); }
      if (W.node[i]) { const d = this.ph.get(`node_${W.node[i]}`); ctx.drawImage(this.phImg, d.cutX, d.cutY, 16, 16, x * T, y * T, 16, 16); }
    }
    tex.refresh();
    const img = this.scene.add.image(cx * CH * T, cy * CH * T, k).setOrigin(0, 0).setDepth(0);
    c = { img, key: k, used: this.scene.time.now }; this.chunks.set(key, c);
    if (this.chunks.size > this.maxChunks) {   // evict least recently used chunk (bounded texture memory)
      let old = null; for (const [kk, v] of this.chunks) if (!old || v.used < old[1].used) old = [kk, v];
      if (old && old[1] !== c) { old[1].img.destroy(); this.scene.textures.remove(old[1].key); this.chunks.delete(old[0]); }
    }
    return c;
  }
  onFac(f, what) {
    let s = this.facs.get(f.id);
    if (what === 'remove') { if (s) { s.img.destroy(); s.arrow?.destroy(); this.facs.delete(f.id); } return; }
    const def = FACILITIES[f.type];
    const [fw, fh] = def.footprint;
    const x = f.x * T, y = f.y * T + fh * T - def.imageSize[1];
    if (!s) {
      const img = def.placeholder ? this.scene.add.image(x, y, 'ph7', `fac_${f.type}`) : this.scene.add.image(x, y, 'atlas', def.art(f, 'off', 0));
      img.setOrigin(0, 0).setDepth(1000 + f.y * T + def.anchorPx[1]);
      s = { img, arrow: null }; this.facs.set(f.id, s);
    }
    if (!def.placeholder) s.img.setFrame(def.art(f, f.state === 'active' || f.state === 'ember' ? f.state : 'off', 0));
    if (def.placeholder && def.rotatable) {
      const out = this.game.world.portsOf(f).find((p) => p.kind === 'out');
      if (out) {
        const ax = (out.tx + 0.5 + { E: 0.32, W: -0.32, N: 0, S: 0 }[out.edge]) * T, ay = (out.ty + 0.5 + { S: 0.32, N: -0.32, E: 0, W: 0 }[out.edge]) * T;
        if (!s.arrow) s.arrow = this.scene.add.image(ax, ay, 'ph7', `arrow_${out.edge}`).setDepth(s.img.depth + 0.1);
        s.arrow.setPosition(ax, ay).setFrame(`arrow_${out.edge}`);
      }
    }
  }
  update(dtMs, view) {
    // ground chunks in view
    const cx0 = Math.max(0, Math.floor(view.x0 / CH)), cy0 = Math.max(0, Math.floor(view.y0 / CH));
    const cx1 = Math.min(Math.ceil(this.w.w / CH) - 1, Math.floor(view.x1 / CH)), cy1 = Math.min(Math.ceil(this.w.h / CH) - 1, Math.floor(view.y1 / CH));
    for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++) this.chunk(cx, cy);
    if (this.fogDirty) { this.fogTex.refresh(); this.fogDirty = false; }
    // furnace animation (only visible ones)
    this.animT += dtMs;
    const frame = Math.floor(this.animT / 150) % 6;
    for (const f of this.game.world.facilities.values()) {
      const def = FACILITIES[f.type]; if (def.kind !== 'furnace') continue;
      if (f.x < view.x0 - 2 || f.x > view.x1 || f.y < view.y0 - 2 || f.y > view.y1) continue;
      const s = this.facs.get(f.id); if (!s) continue;
      const st = f.state === 'active' || f.state === 'ember' ? f.state : 'off';
      s.img.setFrame(def.art(f, st, frame));
    }
    this.w.treasures.forEach((t, k) => { this.treasureImgs[k].setFrame(t.taken ? 'treasure_open' : 'treasure'); });
  }
}
