// Game rules only — no textures here. Visuals are looked up by id in src/art/manifest.js.

export const ITEM_DEFS = {
  wood: { name: '목재' },
  gold_ore: { name: '금광석' },
  gold_ingot: { name: '금괴' },
  gold_sword: { name: '황금 검' },
  quest_scroll: { name: '퀘스트 의뢰서' },
  exp_crystal: { name: '경험치 결정' },
};

// kind: belt | source | machine | sink
// w,h = footprint in build cells (64px). Collision == footprint.
export const FACILITY_DEFS = {
  belt: { name: '컨베이어', kind: 'belt', w: 1, h: 1, cost: { wood: 1 } },
  hopper: { name: '자원 투입구', kind: 'source', w: 1, h: 1, cost: { wood: 5 }, rate: 0.7 },
  smelter: {
    name: '제련소', kind: 'machine', w: 2, h: 1, cost: { wood: 10, gold: 5 },
    recipe: { in: { gold_ore: 1 }, out: { gold_ingot: 1 }, time: 2.0 },
  },
  fabricator: {
    name: '가공 시설', kind: 'machine', w: 2, h: 1, cost: { wood: 10, gold: 10 },
    recipe: { in: { gold_ingot: 2 }, out: { gold_sword: 1 }, time: 2.5 },
  },
  quest_assembler: {
    name: '퀘스트 의뢰서 조립기', kind: 'machine', w: 2, h: 1, cost: { wood: 15, gold: 10 },
    recipe: { in: { gold_sword: 1 }, out: { quest_scroll: 1 }, time: 2.0 },
  },
  exp_generator: {
    name: '경험치 생산기', kind: 'machine', w: 2, h: 1, cost: { wood: 10, gold: 15 },
    recipe: { in: { wood: 2 }, out: { exp_crystal: 1 }, time: 3.0 },
  },
  quest_board: { name: '의뢰 게시판', kind: 'sink', w: 2, h: 2, cost: { wood: 20 }, accepts: ['quest_scroll', 'exp_crystal'] },
};

export const BUILD_MENU = ['belt', 'hopper', 'smelter', 'fabricator', 'quest_assembler', 'exp_generator', 'quest_board'];

export const BELT_SPEED = 1.25; // cells per second
export const OUT_CAP = 2;       // machine output buffer

export const START_STOCK = { wood: 40, gold: 30 };
export const QUEST_REWARD = { gold: 6 };
