// SELF-MADE TEMPORARY DISPLAYS (not official art). Drawn procedurally at runtime with flat colors.
// Tracked in docs/PLACEHOLDERS_006.md and replaced when approved art arrives.
// No third-party image is used here.
export const PLACEHOLDER_LIST = [
  ['ph_grass_*', '지형(잔디) 4종 — 단색+점 패턴'],
  ['ph_dep_iron / ph_dep_gold', '광맥 표시 — 흙 바닥+돌 도형'],
  ['ph_tree', '나무 — 단순 원뿔 도형'],
  ['ph_guild', '길드 건물 — 상자 도형+글자'],
  ['ph_supplier_*', '임시 공급기 — 상자+화살표 (테스트 장치)'],
  ['ph_storage', '임시 저장소 — 상자 (테스트 장치)'],
];

const PAL = {
  g0: '#5d8a45', g1: '#679650', g2: '#547d3e', gDot: '#7aa95c', flower: '#e8d9a0',
  dirt: '#7b6248', dirtD: '#634d39', stone: '#8d929a', stoneD: '#5e636b', gold: '#e7c04f', goldD: '#a5802c',
  leaf: '#3f6e3a', leafD: '#2f5530', leafL: '#56874a', trunk: '#6b4a32',
  wood: '#9a6a43', woodD: '#6b4a32', woodL: '#b98a5a', line: '#2a1f22', arrow: '#f3e7b3', slot: '#3b2f2a',
};

function px(ctx, c, x, y, w = 1, h = 1) { ctx.fillStyle = c; ctx.fillRect(x, y, w, h); }

function drawGrass(ctx, ox, oy, v, rnd) {
  px(ctx, PAL.g0, ox, oy, 16, 16);
  if (v === 1) for (let k = 0; k < 5; k++) px(ctx, PAL.gDot, ox + Math.floor(rnd() * 15), oy + Math.floor(rnd() * 15));
  if (v === 2) { px(ctx, PAL.g2, ox + 3, oy + 9, 2, 1); px(ctx, PAL.g2, ox + 10, oy + 4, 2, 1); px(ctx, PAL.g1, ox + 6, oy + 12, 1, 2); }
  if (v === 3) { px(ctx, PAL.flower, ox + 5, oy + 6); px(ctx, PAL.flower, ox + 11, oy + 11); px(ctx, PAL.g1, ox + 8, oy + 2, 1, 2); }
}
function drawDeposit(ctx, ox, oy, gold) {
  px(ctx, PAL.dirt, ox + 1, oy + 1, 14, 14); px(ctx, PAL.dirtD, ox + 1, oy + 12, 14, 3);
  const rocks = [[3, 3], [9, 5], [5, 9]];
  for (const [x, y] of rocks) {
    px(ctx, PAL.stoneD, ox + x, oy + y + 1, 4, 3); px(ctx, PAL.stone, ox + x, oy + y, 4, 2);
    if (gold) { px(ctx, PAL.gold, ox + x + 1, oy + y + 1, 2, 1); px(ctx, PAL.goldD, ox + x + 2, oy + y + 2); }
    else px(ctx, '#b4b9c0', ox + x + 1, oy + y);
  }
}
function drawTree(ctx, ox, oy) { // 16x24
  px(ctx, 'rgba(0,0,0,0.25)', ox + 3, oy + 21, 10, 2);
  px(ctx, PAL.trunk, ox + 7, oy + 17, 2, 5);
  const rows = [[7, 2], [6, 4], [5, 6], [4, 8], [5, 6], [3, 10], [2, 12], [3, 10], [2, 12], [1, 14], [2, 12], [3, 10], [4, 8], [5, 6]];
  rows.forEach(([x, w], i) => { px(ctx, PAL.leafD, ox + x, oy + 2 + i, w, 1); px(ctx, PAL.leaf, ox + x + 1, oy + 2 + i, Math.max(1, w - 3), 1); });
  px(ctx, PAL.leafL, ox + 6, oy + 6, 1, 3); px(ctx, PAL.leafL, ox + 5, oy + 10, 1, 2);
}
function drawGuild(ctx, ox, oy) { // 64x48
  px(ctx, PAL.line, ox + 2, oy + 14, 60, 34);
  px(ctx, '#c9b48d', ox + 3, oy + 15, 58, 32);
  px(ctx, '#a99370', ox + 3, oy + 40, 58, 7);
  px(ctx, PAL.line, ox, oy + 2, 64, 14);
  px(ctx, '#8c3c3c', ox + 1, oy + 3, 62, 12);
  px(ctx, '#a84d47', ox + 1, oy + 3, 62, 3);
  px(ctx, PAL.line, ox + 27, oy + 30, 10, 17); px(ctx, PAL.woodD, ox + 28, oy + 31, 8, 16);
  px(ctx, PAL.line, ox + 9, oy + 22, 9, 8); px(ctx, '#7fb0c8', ox + 10, oy + 23, 7, 6);
  px(ctx, PAL.line, ox + 46, oy + 22, 9, 8); px(ctx, '#7fb0c8', ox + 47, oy + 23, 7, 6);
}
function drawCrate(ctx, ox, oy) {
  px(ctx, PAL.line, ox + 1, oy + 2, 14, 14); px(ctx, PAL.wood, ox + 2, oy + 3, 12, 12);
  px(ctx, PAL.woodL, ox + 2, oy + 3, 12, 2); px(ctx, PAL.woodD, ox + 2, oy + 13, 12, 2);
}
function drawArrow(ctx, ox, oy, dir) {
  const pts = { E: [[6, 7], [7, 7], [8, 7], [9, 7], [8, 6], [8, 8], [7, 5], [7, 9]] };
  const rot = (x, y) => ({ E: [x, y], S: [15 - y, x], W: [15 - x, 15 - y], N: [y, 15 - x] })[dir];
  for (const [x, y] of pts.E) { const [rx, ry] = rot(x, y + 1); px(ctx, PAL.arrow, ox + rx, oy + ry); }
}

// Builds one canvas texture 'ph' containing all placeholder frames.
export function buildPlaceholderTexture(scene) {
  const W = 128, H = 96;
  const tex = scene.textures.createCanvas('ph', W, H);
  const ctx = tex.getContext();
  let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const frames = [];
  for (let v = 0; v < 4; v++) { drawGrass(ctx, v * 16, 0, v, rnd); frames.push([`ph_grass_${v}`, v * 16, 0, 16, 16]); }
  drawDeposit(ctx, 64, 0, false); frames.push(['ph_dep_iron', 64, 0, 16, 16]);
  drawDeposit(ctx, 80, 0, true); frames.push(['ph_dep_gold', 80, 0, 16, 16]);
  drawTree(ctx, 96, 0); frames.push(['ph_tree', 96, 0, 16, 24]);
  drawGuild(ctx, 0, 24); frames.push(['ph_guild', 0, 24, 64, 48]);
  ['N', 'E', 'S', 'W'].forEach((d, k) => { drawCrate(ctx, 64 + k * 16, 24); drawArrow(ctx, 64 + k * 16, 24, d); frames.push([`ph_supplier_${d}`, 64 + k * 16, 24, 16, 16]); });
  drawCrate(ctx, 64, 40); px(ctx, PAL.slot, 64 + 4, 40 + 6, 8, 3); px(ctx, PAL.line, 64 + 7, 40 + 9, 2, 3);
  frames.push(['ph_storage', 64, 40, 16, 16]);
  drawCrate(ctx, 80, 40); px(ctx, '#b0413e', 80 + 3, 40 + 5, 10, 2); px(ctx, '#b0413e', 80 + 3, 40 + 9, 10, 2);
  frames.push(['ph_storage_closed', 80, 40, 16, 16]);
  tex.refresh();
  for (const [n, x, y, w, h] of frames) tex.add(n, 0, x, y, w, h);
  return tex;
}

// Draws the whole ground (+ discovered deposits) into ONE canvas texture. Redrawn only on discovery.
export function buildGround(scene, world) {
  const key = 'ground';
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const tex = scene.textures.createCanvas(key, world.w * 16, world.h * 16);
  redrawGround(scene, world, tex);
  return tex;
}
export function redrawGround(scene, world, tex) {
  const ctx = tex.getContext();
  const src = scene.textures.get('ph').getSourceImage();
  for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) {
    const i = world.idx(x, y);
    ctx.drawImage(src, world.ground[i] * 16, 0, 16, 16, x * 16, y * 16, 16, 16);
    const d = world.depositVisible(x, y);
    if (d) ctx.drawImage(src, d === 2 ? 80 : 64, 0, 16, 16, x * 16, y * 16, 16, 16);
  }
  tex.refresh();
}
