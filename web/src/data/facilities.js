// Facility registry v2 (007). Art id/version, display size, ground anchor, footprint, collision and
// ports are managed separately. Values from ART metadata are PROTOTYPE candidates.
// Placeholder facilities (placeholder:true) are drawn by render/placeholders.js and listed in docs/PLACEHOLDERS_007.md.
import artmeta from '../gen/artmeta.js';
import { ITEMS } from './items.js';

const EDGES = ['N', 'E', 'S', 'W'];
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
const LEFT = { N: 'W', W: 'S', S: 'E', E: 'N' };
const RIGHT = { N: 'E', E: 'S', S: 'W', W: 'N' };
const perimeter2 = (kind, role = 'any') => [
  [0, 0, 'N'], [1, 0, 'N'], [1, 0, 'E'], [1, 1, 'E'], [0, 1, 'S'], [1, 1, 'S'], [0, 0, 'W'], [0, 1, 'W'],
].map(([x, y, e]) => ({ kind, role, tile: [x, y], edge: e }));
const one = (kind, edge, role = 'any') => ({ kind, role, tile: [0, 0], edge });

const furnaceMeta = artmeta.art006r1?.furnace?.directions || {};
const furnacePorts = (rot) => (furnaceMeta[rot]?.ports || []).map((p) => ({
  kind: p.role === 'ingot' ? 'out' : 'in', role: p.role === 'ingot' ? 'out' : p.role, tile: p.tile, edge: p.edge,
}));

export const FACILITIES = {
  small_miner: {
    name: '소형 채굴기', kind: 'miner', footprint: [1, 1], imageSize: [16, 16], rotatable: true, solid: true,
    art: (f) => `miner_s_${f.rot}`, artId: 'small_miner (ART 006-R1)', anchorPx: [8, 14],
    ports: (rot) => [one('out', rot, 'out')], needsDeposit: true, cost: { wood: 4, stone: 6 },
  },
  large_miner: {
    name: '대형 채굴기 (상위 후보)', kind: 'miner', footprint: [2, 2], imageSize: [32, 32], rotatable: false, solid: true,
    art: () => 'fac_miner', artId: 'FAC_TEST_002_A_R1 (ART 005-R1)', anchorPx: [16, 30], speedMult: 2.0, tech: 'natural_power',
    ports: () => [{ kind: 'out', role: 'out', tile: [1, 1], edge: 'E' }], needsDeposit: true, cost: { iron_ingot: 10, stone: 10 },
  },
  furnace: {
    name: '용광로', kind: 'furnace', footprint: [2, 2], imageSize: [32, 32], rotatable: true, solid: true,
    art: (f, state, frame) => (state === 'off' ? `furnace_${f.rot}_off` : `furnace_${f.rot}_${state}_${frame}`),
    artId: 'furnace (ART 006-R1, 본체 FAC_TEST_003_A_R1)', anchorPx: [16, 30], animMs: 150, animFrames: 6,
    ports: furnacePorts, cost: { stone: 14 },
  },
  pump: {
    name: '양수기', kind: 'pump', footprint: [1, 1], imageSize: [16, 16], rotatable: true, solid: true, placeholder: true,
    ports: (rot) => [one('out', rot, 'out')], needsWater: true, cost: { wood: 4, stone: 4 },
  },
  pulper: { name: '펄프 분쇄기', kind: 'machine', station: 'pulper', glyph: '펄', color: '#c9b98f', cost: { wood: 8, stone: 6 } },
  press: { name: '제지기', kind: 'machine', station: 'press', glyph: '지', color: '#e8e2c8', cost: { wood: 8, stone: 6 } },
  grinder: { name: '안료 분쇄기', kind: 'machine', station: 'grinder', glyph: '안', color: '#4a4e66', cost: { stone: 12 } },
  mixer: { name: '잉크 혼합기', kind: 'machine', station: 'mixer', glyph: '잉', color: '#3d5fa8', cost: { wood: 6, stone: 8 } },
  scribe: { name: '의뢰서 작성대', kind: 'machine', station: 'scribe', glyph: '의', color: '#b4483f', cost: { wood: 10 } },
  forge: { name: '장비 제작대', kind: 'machine', station: 'forge', glyph: '장', color: '#7c8088', cost: { stone: 10, iron_ingot: 2 } },
  alchemy: { name: '연금 작업대', kind: 'machine', station: 'alchemy', glyph: '약', color: '#7b4fa0', cost: { stone: 8, iron_ingot: 2 }, tech: 'alchemy' },
  crusher: { name: '분쇄기', kind: 'machine', station: 'crusher', glyph: '분', color: '#6b5f55', cost: { stone: 12, iron_ingot: 4 }, tech: 'recycling' },
  splitter: { name: '분배기', kind: 'splitter', glyph: '⑂', color: '#596b7a', cost: { iron_ingot: 1, belt_1: 2 }, tech: 'logistics' },
  merger: { name: '합류기', kind: 'merger', glyph: '⊕', color: '#596b7a', cost: { iron_ingot: 1, belt_1: 2 }, tech: 'logistics' },
  sorter: { name: '분류기', kind: 'sorter', glyph: '⇶', color: '#6b5a7a', cost: { iron_ingot: 2, belt_1: 2 }, tech: 'logistics' },
  chest: {
    name: '저장고', kind: 'storage', footprint: [1, 1], imageSize: [16, 16], rotatable: true, solid: true, placeholder: true,
    cost: { wood: 8 },
    ports: (rot) => EDGES.map((e) => (e === rot ? one('out', e, 'out') : one('in', e))),
  },
  quest_board: { name: '의뢰 게시판', kind: 'board', big: true, glyph: '게', color: '#a8743f', cost: { wood: 10 }, ports: () => perimeter2('in') },
  shop: { name: '길드 상점', kind: 'shop', big: true, glyph: '상', color: '#3f8a5a', cost: { wood: 12, stone: 6 }, ports: () => perimeter2('in') },
  counter: {
    name: '전리품 매입소', kind: 'counter', big: true, glyph: '매', color: '#8a5a3f', cost: { wood: 10, stone: 4 }, rotatable: true,
    ports: (rot) => [{ kind: 'out', role: 'out', tile: { N: [0, 0], E: [1, 1], S: [1, 1], W: [0, 1] }[rot], edge: rot }],
  },
  lab: { name: '연구소', kind: 'lab', big: true, glyph: '연', color: '#4f6fa8', cost: { stone: 10, iron_ingot: 2 }, ports: () => [] },
  school: { name: '모험가 학교', kind: 'school', big: true, glyph: '학', color: '#8a7a3f', cost: { wood: 20, stone: 20 }, tech: 'schooling', ports: () => perimeter2('in') },
  dorm: { name: '공동 숙소', kind: 'dorm', big: true, glyph: '숙', color: '#7a5a8a', cost: { wood: 20, stone: 6 }, ports: () => [] },
  water_wheel: { name: '물레방아', kind: 'generator', big: true, glyph: '수', color: '#4f8fb0', cost: { wood: 16, iron_ingot: 4 }, tech: 'natural_power', needsWater: true, ports: () => [] },
};

// fill defaults for compact placeholder entries
for (const [id, f] of Object.entries(FACILITIES)) {
  f.id = id;
  if (!f.footprint) f.footprint = f.big ? [2, 2] : [1, 1];
  if (!f.imageSize) f.imageSize = [f.footprint[0] * 16, f.footprint[1] * 16];
  if (f.solid === undefined) f.solid = true;
  if (f.anchorPx === undefined) f.anchorPx = [f.imageSize[0] / 2, f.imageSize[1] - 2];
  if (f.kind === 'machine') { f.rotatable = true; f.ports = (rot) => EDGES.map((e) => (e === rot ? one('out', e, 'out') : one('in', e))); }
  if (f.kind === 'splitter') { f.rotatable = true; f.ports = (rot) => [one('in', OPP[rot]), one('out', rot), one('out', LEFT[rot]), one('out', RIGHT[rot])]; }
  if (f.kind === 'merger') { f.rotatable = true; f.ports = (rot) => [one('in', OPP[rot]), one('in', LEFT[rot]), one('in', RIGHT[rot]), one('out', rot)]; }
  if (f.kind === 'sorter') { f.rotatable = true; f.ports = (rot) => [one('in', OPP[rot]), one('out', rot, 'match'), one('out', LEFT[rot], 'rest'), one('out', RIGHT[rot], 'rest')]; }
  if (f.placeholder === undefined) f.placeholder = !f.art;
  if (!f.ports) f.ports = () => [];
  // buildable item
  ITEMS[`fac_${id}`] = { name: f.name, cat: 'build', place: 'facility', facility: id, color: f.color || '#8a6a4a', shape: 'box', glyph: f.glyph };
}
export const FAC_IDS = Object.keys(FACILITIES);
