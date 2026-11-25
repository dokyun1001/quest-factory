// Common character compositor (guild master + adventurers).
// Layers (current assets): hair_back(none yet) -> body -> eyes(original, in body) -> outfit -> hair_front -> accessories(none yet)
// Composition happens ONLY when an appearance is first needed; the result is cached by appearance key
// and shared by every character with the same look (reference counted).
import { HAIRS, HAIR_SOURCE, OUTFITS, SHIRT_SOURCE, SHIRT_PALETTES, appearanceKey } from '../data/appearance.js';
import artmeta from '../gen/artmeta.json';

const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const ROLES = ['outline', 'shadow', 'base', 'highlight'];

function recolor(ctx, w, h, fromHex, toHex) {
  const map = new Map();
  fromHex.forEach((f, i) => { const a = hex(f); map.set((a[0] << 16) | (a[1] << 8) | a[2], hex(toHex[i])); });
  const img = ctx.getImageData(0, 0, w, h); const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    const m = map.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    if (m) { d[i] = m[0]; d[i + 1] = m[1]; d[i + 2] = m[2]; }
  }
  ctx.putImageData(img, 0, 0);
}

export class CharComposer {
  constructor(scene) {
    this.scene = scene;
    this.atlas = scene.textures.get('atlas');
    this.src = this.atlas.getSourceImage();
    this.refs = new Map();
    this.composeCount = 0;
    this.tmp = document.createElement('canvas'); this.tmp.width = 64; this.tmp.height = 96;
    this.tctx = this.tmp.getContext('2d', { willReadFrequently: true });
  }
  // Returns an offscreen canvas 128x96: idle sheet at x0..63, walk sheet at x64..127.
  composeCanvas(a) {
    const c = document.createElement('canvas'); c.width = 128; c.height = 96;
    const ctx = c.getContext('2d');
    ['idle', 'walk'].forEach((anim, k) => {
      const layers = [];
      layers.push({ frame: `body_M${a.skinId}_${anim}` });
      const outfit = OUTFITS[a.outfitId];
      if (outfit) layers.push({ frame: `${outfit.frame}_${anim}`, from: SHIRT_SOURCE, to: (SHIRT_PALETTES[a.outfitPaletteId] || SHIRT_PALETTES.white).colors });
      const hair = HAIRS[a.hairId];
      if (hair && hair.frame) {
        const p = artmeta.hair_palettes.presets[a.hairPaletteId] || artmeta.hair_palettes.presets.chestnut;
        layers.push({ frame: `${hair.frame}_${anim}`, from: HAIR_SOURCE, to: ROLES.map((r) => p[r]) });
      }
      for (const L of layers) {
        const f = this.atlas.get(L.frame);
        this.tctx.clearRect(0, 0, 64, 96);
        this.tctx.drawImage(this.src, f.cutX, f.cutY, 64, 96, 0, 0, 64, 96);
        if (L.from && L.to.join() !== L.from.join()) recolor(this.tctx, 64, 96, L.from, L.to); // layer-only recolor
        ctx.drawImage(this.tmp, k * 64, 0);
      }
    });
    this.composeCount++;
    return c;
  }
  acquire(a) {
    const key = appearanceKey(a);
    const tex = this.scene.textures;
    if (!tex.exists(key)) {
      const t = tex.addCanvas(key, this.composeCanvas(a));
      ['idle', 'walk'].forEach((anim, k) => {
        for (let r = 0; r < 4; r++) for (let col = 0; col < 4; col++) t.add(`${anim}_${r}_${col}`, 0, k * 64 + col * 16, r * 24, 16, 24);
      });
    }
    this.refs.set(key, (this.refs.get(key) || 0) + 1);
    return key;
  }
  release(key) {
    const n = (this.refs.get(key) || 0) - 1;
    if (n <= 0) { this.refs.delete(key); if (this.scene.textures.exists(key)) this.scene.textures.remove(key); }
    else this.refs.set(key, n);
  }
  get cachedCount() { return this.refs.size; }
}
