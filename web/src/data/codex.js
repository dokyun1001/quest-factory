// Codex (도감: guild master growth). Entries are discovered by seeing / obtaining. Rewards unlock command skills.
export const CODEX_CATS = { monster: '몬스터', mineral: '광물', plant: '식물', equip: '장비', relic: '유물', region: '지역' };
export const CODEX = {
  slime: ['monster', '슬라임'], wolf: ['monster', '늑대'], golem: ['monster', '바위 골렘'],
  stone: ['mineral', '돌'], coal: ['mineral', '석탄'], iron_ore: ['mineral', '철광석'], gold_ore: ['mineral', '금광석'], copper_ore: ['mineral', '구리광석'], sand: ['mineral', '모래'],
  herb: ['plant', '약초'], fiber: ['plant', '섬유 풀'], berry: ['plant', '열매 덤불'], tree: ['plant', '나무'],
  sword_wood: ['equip', '목검'], staff_wood: ['equip', '나무 지팡이'], bow_wood: ['equip', '나무 활'], mace_wood: ['equip', '나무 철퇴'],
  sword_iron: ['equip', '철검'], armor_leather: ['equip', '가죽 갑옷'],
  golem_core: ['relic', '골렘 핵'], treasure: ['relic', '고대 보물'],
  r_guild: ['region', '길드 평원'], r_meadow: ['region', '슬라임 초원'], r_forest: ['region', '늑대 숲'], r_lake: ['region', '호수'], r_hills: ['region', '광산 언덕'], r_ruins: ['region', '골렘 유적'],
};
// command skills unlocked by codex totals (TEST thresholds)
export const COMMAND_SKILLS = {
  rally_power: { name: '공격력 강화', need: { monster: 2 }, effect: { atk: 1.3 }, dur: 12, cd: 45 },
  guard: { name: '피해 감소', need: { mineral: 4 }, effect: { dmgTaken: 0.6 }, dur: 10, cd: 45 },
  heal: { name: '회복 지원', need: { plant: 3 }, effect: { healFrac: 0.35 }, dur: 0, cd: 60 },
  mana: { name: '마나 지원', need: { equip: 4 }, effect: { manaFrac: 0.5 }, dur: 0, cd: 60 },
};
export const COMMANDS = {
  auto: '자율 행동', charge: '돌격', focus: '집중 공격', defend: '방어', hold: '공격 중단',
  rally: '집결', move: '위치 지정', retreat: '후퇴', withdraw: '철수',
};
