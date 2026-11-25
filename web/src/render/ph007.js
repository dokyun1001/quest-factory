// SELF-MADE TEMPORARY GRAPHICS for 007 (not official art). Generated at runtime with flat colors.
// Every item gets icons at 8/10/12/16 px in ONE canvas texture 'icons' (approved ART 005-R icons are copied in
// unchanged; others are placeholder shapes). Placeholder facilities, monsters and terrain go into 'ph7'.
import { ITEMS } from '../data/items.js';
import { FACILITIES } from '../data/facilities.js';

const SIZES = [8, 10, 12, 16];
function px(c, col, x, y, w = 1, h = 1) { c.fillStyle = col; c.fillRect(x, y, w, h); }
const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); const r = Math.min(255, Math.max(0, ((n >> 16) & 255) * f)), g = Math.min(255, Math.max(0, ((n >> 8) & 255) * f)), b = Math.min(255, Math.max(0, (n & 255) * f)); return `rgb(${r | 0},${g | 0},${b | 0})`; };
const OUT = '#21181b';

function drawShape(c, shape, col, ox, oy, s, glyph) {
  const d = shade(col, 0.65), l = shade(col, 1.3), u = s / 10;
  const R = (x, y, w, h, cc = col) => px(c, cc, ox + Math.round(x * u), oy + Math.round(y * u), Math.max(1, Math.round(w * u)), Math.max(1, Math.round(h * u)));
  switch (shape) {
    case 'rock': R(1, 3, 8, 6, OUT); R(2, 3, 6, 5); R(2, 3, 5, 1, l); R(5, 6, 3, 2, d); break;
    case 'pile': R(1, 5, 8, 4, OUT); R(2, 5, 6, 3); R(3, 3, 4, 2, OUT); R(3, 4, 4, 2); R(4, 4, 2, 1, l); break;
    case 'drop': R(4, 1, 2, 2, OUT); R(3, 3, 4, 6, OUT); R(4, 3, 2, 5); R(3, 5, 4, 3); R(4, 5, 1, 2, l); break;
    case 'leaf': R(2, 2, 6, 6, OUT); R(3, 3, 4, 4); R(4, 4, 2, 2, l); R(5, 7, 1, 2, d); break;
    case 'ball': R(2, 2, 6, 6, OUT); R(3, 3, 4, 4); R(3, 3, 2, 1, l); R(6, 1, 1, 2, '#4f9a48'); break;
    case 'bar': R(1, 4, 8, 4, OUT); R(2, 4, 6, 3); R(2, 4, 6, 1, l); break;
    case 'fang': R(3, 1, 4, 8, OUT); R(4, 1, 2, 6); R(4, 7, 1, 1); break;
    case 'sword': R(6, 1, 2, 2, OUT); for (let i = 0; i < 5; i++) R(5 - i, 2 + i, 2, 1); R(1, 7, 3, 1, '#7a5a3a'); R(2, 6, 1, 3, '#7a5a3a'); break;
    case 'staff': for (let i = 0; i < 7; i++) R(2 + i * 0.8, 8 - i, 1, 1, '#7a5a3a'); R(6, 1, 3, 3, OUT); R(7, 1, 2, 2); break;
    case 'bow': R(2, 1, 1, 8, col); R(3, 1, 2, 1, col); R(3, 8, 2, 1, col); R(5, 2, 1, 6, '#e8e0c0'); break;
    case 'mace': R(2, 8, 1, 1, '#7a5a3a'); for (let i = 0; i < 4; i++) R(3 + i, 7 - i, 1, 1, '#7a5a3a'); R(5, 1, 4, 4, OUT); R(6, 2, 2, 2); break;
    case 'armor': R(2, 2, 6, 7, OUT); R(3, 3, 4, 5); R(1, 2, 2, 3, OUT); R(7, 2, 2, 3, OUT); R(3, 3, 4, 1, l); break;
    case 'potion': R(4, 1, 2, 2, '#c9b48d'); R(2, 3, 6, 6, OUT); R(3, 4, 4, 4); R(3, 4, 1, 2, l); break;
    default: R(1, 1, 8, 8, OUT); R(2, 2, 6, 6); R(2, 2, 6, 1, l);
      if (glyph && s >= 12) { c.fillStyle = '#fff'; c.font = `bold ${Math.round(s * 0.55)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(glyph, ox + s / 2, oy + s / 2 + 1); }
  }
}

export function buildIcons(scene) {
  const ids = Object.keys(ITEMS);
  const cell = 18, cols = 4;
  const W = cell * cols, H = cell * ids.length;
  const tex = scene.textures.createCanvas('icons', W, H);
  const c = tex.getContext(); c.imageSmoothingEnabled = false;
  const atlas = scene.textures.get('atlas'); const src = atlas.getSourceImage();
  ids.forEach((id, r) => {
    const it = ITEMS[id];
    SIZES.forEach((s, k) => {
      const ox = k * cell + 1, oy = r * cell + 1;
      const artSize = s === 16 ? 12 : s;
      if (it.art === true && atlas.has(`item_${id}_${artSize}`)) {
        const f = atlas.get(`item_${id}_${artSize}`); const o = (s - artSize) / 2;
        c.drawImage(src, f.cutX, f.cutY, artSize, artSize, ox + o, oy + o, artSize, artSize);
      } else if (it.facility && FACILITIES[it.facility] && !FACILITIES[it.facility].placeholder) {
        const F = FACILITIES[it.facility]; const f = atlas.get(F.art({ rot: 'E' }, 'off', 0));
        c.drawImage(src, f.cutX, f.cutY, f.cutWidth, f.cutHeight, ox, oy, s, s);
      } else if (it.art === 'belt') {
        const f = atlas.get('belt_WE_0'); c.drawImage(src, f.cutX, f.cutY, 16, 16, ox, oy, s, s);
      } else drawShape(c, it.shape || 'box', it.color || '#8a6a4a', ox, oy, s, it.glyph);
    });
  });
  tex.refresh();
  ids.forEach((id, r) => SIZES.forEach((s, k) => tex.add(`i_${id}_${s}`, 0, k * cell + 1, r * cell + 1, s, s)));
  return tex;
}
// draw an item icon into a DOM canvas (UI)
export function iconCanvas(scene, id, size = 16, scale = 2) {
  const cv = document.createElement('canvas'); cv.width = size * scale; cv.height = size * scale;
  const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
  const t = scene.textures.get('icons'); const f = t.get(`i_${id}_${size}`);
  if (f) ctx.drawImage(t.getSourceImage(), f.cutX, f.cutY, size, size, 0, 0, size * scale, size * scale);
  cv.className = 'ic';
  return cv;
}

// ---------------- placeholder facilities / monsters / terrain ----------------
const PAL = { g0: '#5d8a45', g1: '#679650', g2: '#547d3e', gDot: '#7aa95c', flower: '#e8d9a0', dark: '#4b7438', darkDot: '#3e6430',
  water: '#3f78b5', waterL: '#6fa4d6', sand: '#d8c48e', sandD: '#c2ad78', rock: '#5f5a57', rockL: '#7d7772', ruin: '#8c8577', ruinD: '#77705f',
  dirt: '#7b6248', dirtD: '#634d39', leaf: '#3f6e3a', leafD: '#2f5530', leafL: '#56874a', trunk: '#6b4a32' };
export function buildPh7(scene) {
  const W = 256, H = 256;
  const tex = scene.textures.createCanvas('ph7', W, H);
  const c = tex.getContext(); c.imageSmoothingEnabled = false;
  const frames = []; let s = 11; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const tile = (name, x, y, fn, w = 16, h = 16) => { fn(x, y); frames.push([name, x, y, w, h]); };
  // terrain row (y=0)
  const grass = (x, y, base, dot) => { px(c, base, x, y, 16, 16); for (let k = 0; k < 4; k++) px(c, dot, x + Math.floor(rnd() * 15), y + Math.floor(rnd() * 15)); };
  tile('t_grass0', 0, 0, (x, y) => px(c, PAL.g0, x, y, 16, 16));
  tile('t_grass1', 16, 0, (x, y) => grass(x, y, PAL.g0, PAL.gDot));
  tile('t_grass2', 32, 0, (x, y) => { px(c, PAL.g0, x, y, 16, 16); px(c, PAL.g2, x + 3, y + 9, 2, 1); px(c, PAL.g2, x + 10, y + 4, 2, 1); });
  tile('t_grass3', 48, 0, (x, y) => { px(c, PAL.g0, x, y, 16, 16); px(c, PAL.flower, x + 5, y + 6); px(c, PAL.flower, x + 11, y + 11); });
  tile('t_dark', 64, 0, (x, y) => grass(x, y, PAL.dark, PAL.darkDot));
  tile('t_ruin', 80, 0, (x, y) => { px(c, PAL.ruin, x, y, 16, 16); px(c, PAL.ruinD, x, y + 7, 16, 1); px(c, PAL.ruinD, x + 7, y, 1, 7); px(c, PAL.ruinD, x + 12, y + 8, 1, 8); });
  tile('t_water', 96, 0, (x, y) => { px(c, PAL.water, x, y, 16, 16); px(c, PAL.waterL, x + 2, y + 4, 4, 1); px(c, PAL.waterL, x + 9, y + 11, 4, 1); });
  tile('t_sand', 112, 0, (x, y) => { px(c, PAL.sand, x, y, 16, 16); for (let k = 0; k < 5; k++) px(c, PAL.sandD, x + Math.floor(rnd() * 15), y + Math.floor(rnd() * 15)); });
  tile('t_rock', 128, 0, (x, y) => { px(c, PAL.rock, x, y, 16, 16); px(c, PAL.rockL, x + 1, y + 1, 14, 3); px(c, '#4a4643', x, y + 13, 16, 3); });
  // deposits (y=16): iron, gold, coal, stone, copper
  const depCols = { 1: ['#8d929a', '#b4b9c0'], 2: ['#8d929a', '#e7c04f'], 3: ['#3a373d', '#1f1d22'], 4: ['#9a958d', '#c3beb4'], 5: ['#8d929a', '#d0763f'] };
  Object.entries(depCols).forEach(([k, [a, b]], i) => tile(`dep_${k}`, i * 16, 16, (x, y) => {
    px(c, PAL.dirt, x + 1, y + 1, 14, 14); px(c, PAL.dirtD, x + 1, y + 12, 14, 3);
    for (const [rx, ry] of [[3, 3], [9, 5], [5, 9]]) { px(c, shade(a, 0.7), x + rx, y + ry + 1, 4, 3); px(c, a, x + rx, y + ry, 4, 2); px(c, b, x + rx + 1, y + ry + 1, 2, 1); }
  }));
  // gather nodes (y=16, x=80..): herb, fiber, berry
  tile('node_1', 80, 16, (x, y) => { for (const [a, b] of [[4, 8], [7, 6], [10, 9]]) { px(c, '#2f6a2c', x + a, y + b, 2, 5); px(c, '#5fb04f', x + a - 1, y + b - 1, 4, 2); } px(c, '#e8e0a0', x + 7, y + 5); });
  tile('node_2', 96, 16, (x, y) => { for (let k = 0; k < 6; k++) px(c, k % 2 ? '#b7c77a' : '#93a65a', x + 3 + k * 2, y + 4 + (k % 3), 1, 9 - (k % 3)); });
  tile('node_3', 112, 16, (x, y) => { px(c, '#2f5530', x + 3, y + 5, 10, 8); px(c, '#3f6e3a', x + 4, y + 4, 8, 8); for (const [a, b] of [[5, 6], [9, 7], [7, 10]]) px(c, '#c8424e', x + a, y + b, 2, 2); });
  // tree + stump (y=32, 16x24)
  tile('tree', 0, 32, (x, y) => {
    px(c, 'rgba(0,0,0,0.25)', x + 3, y + 21, 10, 2); px(c, PAL.trunk, x + 7, y + 17, 2, 5);
    [[7, 2], [6, 4], [5, 6], [4, 8], [5, 6], [3, 10], [2, 12], [3, 10], [2, 12], [1, 14], [2, 12], [3, 10], [4, 8], [5, 6]].forEach(([a, w], i) => { px(c, PAL.leafD, x + a, y + 2 + i, w, 1); px(c, PAL.leaf, x + a + 1, y + 2 + i, Math.max(1, w - 3), 1); });
    px(c, PAL.leafL, x + 6, y + 6, 1, 3);
  }, 16, 24);
  tile('stump', 16, 32, (x, y) => { px(c, 'rgba(0,0,0,0.2)', x + 4, y + 21, 8, 2); px(c, '#5a3d28', x + 5, y + 17, 6, 5); px(c, '#b98a5a', x + 5, y + 17, 6, 2); px(c, '#4f9a48', x + 8, y + 14, 1, 3); }, 16, 24);
  // guild hall 64x48 at (32,32)
  tile('guild', 32, 32, (x, y) => {
    px(c, OUT, x + 2, y + 14, 60, 34); px(c, '#c9b48d', x + 3, y + 15, 58, 32); px(c, '#a99370', x + 3, y + 40, 58, 7);
    px(c, OUT, x, y + 2, 64, 14); px(c, '#8c3c3c', x + 1, y + 3, 62, 12); px(c, '#a84d47', x + 1, y + 3, 62, 3);
    px(c, OUT, x + 27, y + 30, 10, 17); px(c, '#6b4a32', x + 28, y + 31, 8, 16);
    px(c, OUT, x + 9, y + 22, 9, 8); px(c, '#7fb0c8', x + 10, y + 23, 7, 6); px(c, OUT, x + 46, y + 22, 9, 8); px(c, '#7fb0c8', x + 47, y + 23, 7, 6);
  }, 64, 48);
  // treasure chest (y=32,x=96)
  tile('treasure', 96, 32, (x, y) => { px(c, OUT, x + 2, y + 5, 12, 10); px(c, '#9a5a2e', x + 3, y + 6, 10, 8); px(c, '#e7c04f', x + 3, y + 9, 10, 1); px(c, '#e7c04f', x + 7, y + 8, 2, 3); });
  tile('treasure_open', 112, 32, (x, y) => { px(c, OUT, x + 2, y + 8, 12, 7); px(c, '#9a5a2e', x + 3, y + 9, 10, 5); px(c, '#5a3d28', x + 3, y + 5, 10, 3); });
  // arrows for output direction (y=56)
  ['N', 'E', 'S', 'W'].forEach((d, i) => tile(`arrow_${d}`, 96 + i * 8, 56, (x, y) => {
    const pts = { E: [[1, 3], [2, 3], [3, 3], [4, 3], [3, 2], [3, 4], [2, 1], [2, 5]] }.E;
    const rot = (a, b) => ({ E: [a, b], S: [6 - b, a], W: [6 - a, 6 - b], N: [b, 6 - a] })[d];
    for (const [a, b] of pts) { const [rx, ry] = rot(a, b); px(c, '#fff4b0', x + rx, y + ry); }
  }, 7, 7));
  // monsters (y=80): slime 2 frames 16x16, wolf 2 frames 16x16, golem 2 frames 32x32
  const slime = (x, y, f) => { px(c, 'rgba(0,0,0,0.25)', x + 3, y + 13, 10, 2); const h = f ? 7 : 8; px(c, '#245a2a', x + 3, y + 13 - h, 10, h); px(c, '#5fc45a', x + 4, y + 14 - h, 8, h - 2); px(c, '#9be38f', x + 5, y + 15 - h, 2, 1); px(c, OUT, x + 6, y + 9, 1, 2); px(c, OUT, x + 9, y + 9, 1, 2); };
  tile('mon_slime_0', 0, 80, (x, y) => slime(x, y, 0)); tile('mon_slime_1', 16, 80, (x, y) => slime(x, y, 1));
  const wolf = (x, y, f) => { px(c, 'rgba(0,0,0,0.25)', x + 2, y + 13, 12, 2); px(c, OUT, x + 2, y + 6, 11, 6); px(c, '#7d756c', x + 3, y + 7, 9, 4); px(c, OUT, x + 11, y + 4, 4, 5); px(c, '#9a9186', x + 12, y + 5, 2, 3); px(c, OUT, x + 1, y + 5, 2, 2);
    const l = f ? [3, 6, 9, 11] : [4, 5, 10, 10]; for (const a of l) px(c, OUT, x + a, y + 11, 1, 3); px(c, '#e0d070', x + 13, y + 6); };
  tile('mon_wolf_0', 32, 80, (x, y) => wolf(x, y, 0)); tile('mon_wolf_1', 48, 80, (x, y) => wolf(x, y, 1));
  const golem = (x, y, f) => { px(c, 'rgba(0,0,0,0.3)', x + 4, y + 28, 24, 3); px(c, OUT, x + 6, y + 4 + f, 20, 24 - f); px(c, '#8b8475', x + 7, y + 5 + f, 18, 22 - f); px(c, '#a8a191', x + 8, y + 6 + f, 16, 3);
    px(c, OUT, x + 1, y + 10, 6, 12); px(c, '#8b8475', x + 2, y + 11, 4, 10); px(c, OUT, x + 25, y + 10, 6, 12); px(c, '#8b8475', x + 26, y + 11, 4, 10); px(c, '#7fd0d8', x + 12, y + 11 + f, 3, 2); px(c, '#7fd0d8', x + 18, y + 11 + f, 3, 2); };
  tile('mon_golem_0', 64, 80, (x, y) => golem(x, y, 0), 32, 32); tile('mon_golem_1', 96, 80, (x, y) => golem(x, y, 1), 32, 32);
  // placeholder facilities (y=112..): 16x16 or 32x32 boxes with glyph
  let fx = 0, fy = 112;
  for (const [id, f] of Object.entries(FACILITIES)) {
    if (!f.placeholder) continue;
    const [w, h] = f.imageSize;
    if (fx + w > W) { fx = 0; fy += 32; }
    tile(`fac_${id}`, fx, fy, (x, y) => {
      const col = f.color || '#8a6a4a';
      px(c, OUT, x + 1, y + 2, w - 2, h - 2); px(c, col, x + 2, y + 3, w - 4, h - 4); px(c, shade(col, 1.25), x + 2, y + 3, w - 4, 2); px(c, shade(col, 0.7), x + 2, y + h - 3, w - 4, 2);
      if (f.kind === 'pump') { px(c, '#4f8fd0', x + 5, y + 6, 6, 5); }
      if (f.kind === 'storage') { px(c, '#3b2f2a', x + 4, y + 7, 8, 2); }
      c.fillStyle = '#fff'; c.font = `bold ${w > 16 ? 13 : 8}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      if (f.glyph) c.fillText(f.glyph, x + w / 2, y + h / 2 + 1);
    }, w, h);
    fx += w;
  }
  tex.refresh();
  for (const [n, x, y, w, h] of frames) tex.add(n, 0, x, y, w, h);
  return tex;
}
