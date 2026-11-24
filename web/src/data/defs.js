// Game rules only — no textures here. Visuals are looked up by id in src/art/manifest.js.

export const ITEM_DEFS = {
  wood: { name: '목재', raw: true },
  gold_ore: { name: '금광석', raw: true },
  gold_ingot: { name: '금괴' },
  gold_sword: { name: '황금 검' },
  quest_scroll: { name: '퀘스트 의뢰서' },
  exp_crystal: { name: '경험치 결정' },
  research_note: { name: '연구 기록' },
  loot_shadow: { name: '그림자 정수', raw: true, loot: true },
  loot_violet: { name: '보랏빛 깃털', raw: true, loot: true },
  loot_crimson: { name: '진홍 성수', raw: true, loot: true },
  coin: { name: '골드' },
};

// kind: belt | source | machine | sink
// w,h = footprint in 64px build cells. Collision area == footprint.
export const FACILITY_DEFS = {
  belt: { name: '컨베이어', kind: 'belt', w: 1, h: 1, cost: { wood: 1 }, desc: '아이템을 화살표 방향으로 운반한다.' },
  hopper: {
    name: '자원 투입구', kind: 'source', w: 1, h: 1, cost: { wood: 5 }, rate: 0.8,
    desc: '길드 창고에서 지정한 자원을 꺼내 컨베이어에 올린다. 클릭해서 자원을 바꾼다.',
  },
  smelter: {
    name: '제련소', kind: 'machine', w: 2, h: 1, cost: { wood: 10, coin: 10 },
    recipe: { in: { gold_ore: 1 }, out: { gold_ingot: 1 }, time: 2.0 }, desc: '금광석 → 금괴',
  },
  fabricator: {
    name: '가공 시설', kind: 'machine', w: 2, h: 1, cost: { wood: 10, coin: 15 },
    recipe: { in: { gold_ingot: 2 }, out: { gold_sword: 1 }, time: 2.5 }, desc: '금괴 2 → 황금 검',
  },
  quest_assembler: {
    name: '퀘스트 의뢰서 조립기', kind: 'machine', w: 2, h: 1, cost: { wood: 15, coin: 20 },
    recipe: { in: { gold_sword: 1 }, out: { quest_scroll: 1 }, time: 2.0 }, desc: '황금 검 → 퀘스트 의뢰서 (보상용 무기를 걸고 토벌 의뢰를 만든다)',
  },
  exp_generator: {
    name: '경험치 생산기', kind: 'machine', w: 2, h: 1, cost: { wood: 10, coin: 20 },
    recipe: { in: { wood: 2 }, out: { exp_crystal: 1 }, time: 3.0 }, desc: '목재 2 → 경험치 결정',
  },
  loot_recycler: {
    name: '전리품 회수 시설', kind: 'machine', w: 2, h: 1, cost: { wood: 15, coin: 25 },
    recipe: { anyIn: ['loot_shadow', 'loot_violet', 'loot_crimson'], out: { research_note: 1 }, time: 3.0 },
    desc: '전리품 1 → 연구 기록 (도감 연구에 사용)',
  },
  quest_board: {
    name: '의뢰 게시판', kind: 'sink', w: 2, h: 2, cost: { wood: 20 },
    accepts: ['quest_scroll', 'exp_crystal', 'research_note'],
    desc: '의뢰서를 게시하고, 경험치 결정과 연구 기록을 길드에 등록한다.',
  },
};

export const BUILD_MENU = ['belt', 'hopper', 'smelter', 'fabricator', 'quest_assembler', 'exp_generator', 'loot_recycler', 'quest_board'];

// Loot-based facility upgrades (machines only). speed multiplier per level.
export const UPGRADES = {
  maxLevel: 3,
  speed: [1, 1.5, 2.0],
  cost: [null, { loot_shadow: 2 }, { loot_violet: 2, loot_crimson: 2 }], // cost to reach level index+1
};

// Monster codex. Research levels 0..3 grant guild-wide bonuses.
export const MONSTER_DEFS = {
  shadow_knight: {
    name: '그림자 기사', tier: 1, loot: 'loot_shadow', desc: '숲 동쪽에 출몰하는 검은 갑옷의 기사.',
    bonus: { stat: 'questReward', per: 0.2, label: '의뢰 보상 +20%' },
  },
  violet_archer: {
    name: '보랏빛 궁수', tier: 2, loot: 'loot_violet', desc: '멀리서 화살을 쏘는 보랏빛 무리.',
    bonus: { stat: 'machineSpeed', per: 0.1, label: '모든 기계 속도 +10%' },
  },
  crimson_monk: {
    name: '진홍 수도승', tier: 3, loot: 'loot_crimson', desc: '붉은 성수를 다루는 이단 수도승.',
    bonus: { stat: 'beltSpeed', per: 0.15, label: '컨베이어 속도 +15%' },
  },
};
export const RESEARCH = { maxLevel: 3, notes: [2, 4, 6], loot: [1, 2, 3] }; // cost to reach level i+1

export const BELT_SPEED = 1.25; // cells per second (base)
export const OUT_CAP = 2;       // machine output buffer

// hoppers never draw the warehouse below this (keeps building materials available)
export const HOPPER_RESERVE = { wood: 20, loot_shadow: 4, loot_violet: 4, loot_crimson: 4 };

export const START_STOCK = { wood: 60, coin: 60, gold_ore: 6 };
export const QUEST = { baseReward: 10, travelSpeed: 120, fightTime: 3.5 };
export const GUILD = { expPerCrystal: 10, expPerLevel: [0, 60, 180, 400, 800], maxAdventurers: [3, 4, 5, 6, 6] };
export const ADVENTURER_ROSTER = [
  { kind: 'warrior', name: '레온' },
  { kind: 'archer', name: '미라' },
  { kind: 'monk', name: '세린' },
  { kind: 'warrior', name: '바르크' },
  { kind: 'archer', name: '유나' },
  { kind: 'monk', name: '토마' },
];
