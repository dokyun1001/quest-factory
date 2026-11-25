// Item catalogue (data-driven). art: approved ART 005-R transport icon exists.
// Items without art get a self-made placeholder icon (colored shape + glyph) — see docs/PLACEHOLDERS_007.md.
// price: base price for RAW materials only. Crafted base prices are derived from recipes (economy.js).
// cat: raw | inter | loot | equip | consum | build
const I = (name, cat, extra = {}) => ({ name, cat, ...extra });
export const ITEMS = {
  // raw
  wood: I('목재', 'raw', { art: true, price: 2, color: '#a06a3e' }),
  stone: I('돌', 'raw', { price: 1, color: '#8d929a', shape: 'rock' }),
  coal: I('석탄', 'raw', { price: 3, color: '#2c2a30', shape: 'rock' }),
  copper_ore: I('구리광석', 'raw', { price: 3, color: '#c0703f', shape: 'rock' }),
  iron_ore: I('철광석', 'raw', { art: true, price: 3, color: '#7a7f88' }),
  gold_ore: I('금광석', 'raw', { art: true, price: 8, color: '#e7c04f' }),
  sand: I('모래', 'raw', { price: 1, color: '#e2cf98', shape: 'pile' }),
  clay: I('점토', 'raw', { price: 1, color: '#b77d5b', shape: 'pile' }),
  water: I('물', 'raw', { price: 1, color: '#4f8fd0', shape: 'drop' }),
  herb: I('약초', 'raw', { price: 3, color: '#4f9a48', shape: 'leaf' }),
  fiber: I('식물성 섬유', 'raw', { price: 1, color: '#b7c77a', shape: 'leaf' }),
  berry: I('열매', 'raw', { price: 2, color: '#c8424e', shape: 'ball' }),
  // intermediates
  charcoal: I('목탄', 'inter', { color: '#3a2e2a', shape: 'rock' }),
  iron_ingot: I('철괴', 'inter', { art: true }),
  gold_ingot: I('금괴', 'inter', { color: '#f2cf55', shape: 'bar' }),
  copper_ingot: I('구리괴', 'inter', { color: '#d98552', shape: 'bar' }),
  pulp: I('펄프', 'inter', { color: '#d9d2b8', shape: 'pile' }),
  paper: I('종이', 'inter', { art: true }),
  pigment: I('안료', 'inter', { color: '#2b2f45', shape: 'pile' }),
  ink: I('잉크병', 'inter', { art: true }),
  quest: I('빈 의뢰서', 'inter', { art: true }),
  string: I('활시위', 'inter', { color: '#e8e0c0', shape: 'bar' }),
  // loot (physical)
  slime: I('슬라임 점액', 'loot', { art: true, price: 4 }),
  wolf_pelt: I('늑대 가죽', 'loot', { price: 6, color: '#8a7563', shape: 'pile' }),
  wolf_fang: I('늑대 송곳니', 'loot', { price: 5, color: '#efe8d4', shape: 'fang' }),
  golem_core: I('골렘 핵', 'loot', { price: 60, color: '#7fd0d8', shape: 'ball' }),
  // equipment (tier = gear level)
  sword_wood: I('목검', 'equip', { slot: 'weapon', job: 'swordsman', atk: 4, tier: 1, color: '#b78a5a', shape: 'sword' }),
  sword_iron: I('철검', 'equip', { slot: 'weapon', job: 'swordsman', atk: 10, tier: 2, color: '#c8ccd2', shape: 'sword' }),
  staff_wood: I('나무 지팡이', 'equip', { slot: 'weapon', job: 'mage', atk: 4, tier: 1, color: '#9a6a43', shape: 'staff' }),
  staff_gel: I('점액 지팡이', 'equip', { slot: 'weapon', job: 'mage', atk: 10, tier: 2, color: '#6fcf6a', shape: 'staff' }),
  bow_wood: I('나무 활', 'equip', { slot: 'weapon', job: 'archer', atk: 4, tier: 1, color: '#a57347', shape: 'bow' }),
  bow_fang: I('송곳니 활', 'equip', { slot: 'weapon', job: 'archer', atk: 10, tier: 2, color: '#efe8d4', shape: 'bow' }),
  mace_wood: I('나무 철퇴', 'equip', { slot: 'weapon', job: 'cleric', atk: 3, tier: 1, color: '#a47a52', shape: 'mace' }),
  mace_iron: I('철 철퇴', 'equip', { slot: 'weapon', job: 'cleric', atk: 8, tier: 2, color: '#c8ccd2', shape: 'mace' }),
  armor_leather: I('가죽 갑옷', 'equip', { slot: 'armor', def: 3, tier: 1, color: '#8a6243', shape: 'armor' }),
  armor_iron: I('철 갑옷', 'equip', { slot: 'armor', def: 7, tier: 2, color: '#aeb4bc', shape: 'armor' }),
  potion_hp: I('회복 물약', 'consum', { color: '#d84a5a', shape: 'potion' }),
  potion_mp: I('마나 물약', 'consum', { color: '#4a6fd8', shape: 'potion' }),
  // buildables (placing consumes 1)
  belt_1: I('컨베이어', 'build', { place: 'belt', tier: 0, art: 'belt' }),
  belt_2: I('컨베이어 II', 'build', { place: 'belt', tier: 1, art: 'belt' }),
  belt_3: I('컨베이어 III', 'build', { place: 'belt', tier: 2, art: 'belt' }),
  belt_4: I('컨베이어 IV', 'build', { place: 'belt', tier: 3, art: 'belt' }),
  belt_5: I('컨베이어 V', 'build', { place: 'belt', tier: 4, art: 'belt' }),
};
// buildable facility items are generated from FACILITIES (see facilities.js) to avoid duplication
export const ITEM_SIZES = [8, 10, 12];
export const itemArtFrame = (id, size) => `item_${id}_${size}`;
export const isEquip = (id) => ITEMS[id]?.cat === 'equip';
export function registerItem(id, def) { ITEMS[id] = def; }
export const ITEM_IDS = () => Object.keys(ITEMS);
