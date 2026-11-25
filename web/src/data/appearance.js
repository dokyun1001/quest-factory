// Common character appearance (guild master + adventurers share this pool).
// Only assets with FULL idle/walk motion are listed here. Front-only previews (ART 004A/BC)
// and Big/Small bodies are intentionally excluded until verified.
export const BODY_TYPES = { Medium: { name: '보통', skins: [1, 2, 3] } };
export const SKINS = { 1: '피부 1', 2: '피부 2', 3: '피부 3' };
export const HAIRS = {
  none: { name: '민머리', frame: null },
  HAIR_001: { name: '짧은 머리 (HAIR_001)', frame: 'hair_001' },
};
// ART 004 hair palette candidates (10). Source chestnut roles: outline, shadow, base, highlight.
export const HAIR_SOURCE = ['#52333F', '#7D3833', '#945334', '#BB7B45'];
export const HAIR_PALETTE_NAMES = {
  black: '검정', dark_brown: '짙은 갈색', chestnut: '밤색', light_brown: '밝은 갈색', blonde: '금발',
  silver: '은발', white: '백발', auburn: '적갈색', blue: '청색', purple: '보라',
};
export const OUTFITS = { SHIRT_BASE: { name: '기본 셔츠 (Franuka)', frame: 'shirt_M' } };
// Shirt source roles: outline, shadow, base. Dye variants are QUEST FACTORY TEST colors (not approved).
export const SHIRT_SOURCE = ['#686F99', '#A3A7C2', '#DFE0E8'];
export const SHIRT_PALETTES = {
  white: { name: '흰색 (원본)', colors: SHIRT_SOURCE },
  red:   { name: '붉은색 (시험)', colors: ['#5A2734', '#9A3B3E', '#C9604F'] },
  blue:  { name: '푸른색 (시험)', colors: ['#2B3558', '#3F5C8C', '#6A93C2'] },
  green: { name: '녹색 (시험)', colors: ['#27452F', '#3E6B40', '#6C9A55'] },
  brown: { name: '갈색 (시험)', colors: ['#3F2C2A', '#6B4B3A', '#9A7254'] },
  black: { name: '검은색 (시험)', colors: ['#1E1C24', '#34323E', '#4F4C5C'] },
};
export const EYES = { default: '기본 (원본 눈)' };

export function defaultAppearance() {
  return { bodyType: 'Medium', skinId: 1, hairId: 'HAIR_001', hairPaletteId: 'chestnut',
    eyeShapeId: 'default', eyeColorId: 'default', outfitId: 'SHIRT_BASE', outfitPaletteId: 'white', accessoryIds: [] };
}
const pick = (arr, rnd) => arr[Math.floor(rnd() * arr.length)];
export function randomAppearance(rnd = Math.random) {
  return { bodyType: 'Medium', skinId: pick([1, 2, 3], rnd), hairId: rnd() < 0.2 ? 'none' : 'HAIR_001', // TEST weight: bald 20%
    hairPaletteId: pick(Object.keys(HAIR_PALETTE_NAMES), rnd), eyeShapeId: 'default', eyeColorId: 'default',
    outfitId: 'SHIRT_BASE', outfitPaletteId: pick(Object.keys(SHIRT_PALETTES), rnd), accessoryIds: [] };
}
export function sanitizeAppearance(a) {
  const d = defaultAppearance();
  if (!a || typeof a !== 'object') return d;
  const o = { ...d };
  if (BODY_TYPES[a.bodyType]) o.bodyType = a.bodyType;
  if ([1, 2, 3].includes(a.skinId)) o.skinId = a.skinId;
  if (HAIRS[a.hairId]) o.hairId = a.hairId;
  if (HAIR_PALETTE_NAMES[a.hairPaletteId]) o.hairPaletteId = a.hairPaletteId;
  if (OUTFITS[a.outfitId]) o.outfitId = a.outfitId;
  if (SHIRT_PALETTES[a.outfitPaletteId]) o.outfitPaletteId = a.outfitPaletteId;
  return o;
}
export const appearanceKey = (a) =>
  `ch_${a.bodyType}_${a.skinId}_${a.hairId}_${a.hairPaletteId}_${a.outfitId}_${a.outfitPaletteId}`;
