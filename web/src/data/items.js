// Transport items. art:true = approved ART 005-R icon exists (8/10/12 px variants).
export const ITEMS = {
  wood:       { name: '목재',     art: true },
  iron_ore:   { name: '철광석',   art: true },
  gold_ore:   { name: '금광석',   art: true },
  iron_ingot: { name: '철괴',     art: true },
  paper:      { name: '종이',     art: true },
  ink:        { name: '잉크병',   art: true },
  quest:      { name: '의뢰서',   art: true },
  slime:      { name: '슬라임 점액', art: true },
};
export const ITEM_IDS = Object.keys(ITEMS);
export const ITEM_SIZES = [8, 10, 12];
export const itemFrame = (id, size) => `item_${id}_${size}`;
