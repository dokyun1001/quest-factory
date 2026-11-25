// ============================================================================
// QUEST FACTORY 007 — ALL BALANCE / PROBABILITY VALUES (TEST VALUES, NOT FINAL)
// Every number here is an experimental value from directive 007 or a developer
// proposal marked "PROPOSAL". Change freely; nothing else hardcodes these.
// ============================================================================
export const B = {
  time: { realSecondsPerYear: 600, simHz: 20 },          // 10 real minutes = 1 game year
  logistics: {
    itemGap: 0.8,                                         // tiles between items (directive)
    beltSpeed: [0.5, 1, 2, 4, 8],                         // tiles/s per tier (basic..ancient)
    storageCap: 60, storageCapPerUpgrade: 60, storageMaxLevel: 4,
    nodeBuffer: 1,                                         // splitter/merger/sorter buffer
  },
  industry: {
    tiers: [
      { id: 'basic', name: '기초 기계', mult: 1 },
      { id: 'natural', name: '자연 동력', mult: 2.5 },
      { id: 'steam', name: '증기 공학', mult: 6 },
      { id: 'arcane', name: '마력 공학', mult: 15 },
      { id: 'ancient', name: '고대 공학', mult: 40 },
    ],
    minerSec: 12, furnaceSec: 20, charcoalSec: 10,
    fuelValue: { wood: 1, charcoal: 2, coal: 3 },        // number of smelts per fuel item (PROPOSAL)
    furnaceOreBuf: 4, furnaceFuelBuf: 4, furnaceOutBuf: 4,
    machineInBuf: 6, machineOutBuf: 4,
    pumpSec: 4,
    powerPerWheel: 10, powerDemandPerMachine: 4,          // natural tier machines (PROPOSAL)
  },
  player: { speed: 5, reach: 1.6, invSlots: 40, hotbar: 10, stack: 99, gatherCd: 0.35, revealRadius: 7 },
  world: { startRevealRadius: 12, habitatRespawnSec: 45, treeRegrowSec: 90 },
  quests: {
    paperPerKills: 5, inkPerKills: 5,                     // 5 monsters -> 1 paper + 1 ink (blank scroll)
    rewardPerKill: 4, rewardPerSurvey: 20, rewardPerGather: 2, rewardPerExplore: 25,  // gold (TEST faucet-free: paid by guild)
    surveySec: 20, maxBoard: 30, abandonAfterSec: 240,
  },
  economy: {
    startGuildGold: 400, startAdventurerGold: [20, 60],
    recruitCost: 40,
    craftedMarkup: 0.25, laborPerSec: 0.15,               // base price of crafted goods = inputs*(1+markup) + time*labor
    market: { min: 0.5, max: 2.0, maxStepPerMin: 0.05, demandWeight: 0.5, stockWeight: 0.3, emaSec: 120, targetStock: 6 },
    usedFactor: 0.6, crusherReturn: 0.2,
    testFaucet: { enabled: false, goldPerKill: 2 },       // explicit TEST faucet (off by default)
  },
  research: {},
  people: {
    stats: ['str', 'agi', 'vit', 'int', 'sen', 'luk'],
    adultStatRange: [5, 15],
    talent: { probs: [0.15, 0.30, 0.40, 0.14, 0.01], mult: [0.6, 0.8, 1.0, 1.4, 2.0] },
    eduCap: 15, actCap: 20, maxLevel: 100,
    xpToNext: (lv) => 100 + 10 * (lv - 1),
    grades: ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS'],
    gradeByLevel: [1, 5, 10, 18, 28, 40, 60, 85],        // PROPOSAL: minimum level for promotion test
    elements: ['fire', 'water', 'wind', 'earth', 'thunder', 'ice'],
    aptitudeThreshold: 60,
    aptCountProbs: [0.50, 0.38, 0.09, 0.023, 0.005, 0.001, 0.001],
    inherit: { talentBase: 2.2, pivot: 2.56, upSpan: 2.44, downSpan: 1.56, elemOneParent: 2, elemBothParents: 4, affRandom: 0.75, affParent: 0.25 },
    actionGrowthPerQuest: 0.15,                            // PROPOSAL
    eduGrowthPerYear: 2.5,                                 // PROPOSAL, scaled by teacher efficiency
    retireAge: { human: 50, dwarf: 120, elf: 180 },        // PROPOSAL
    lifespanSd: 0.08,
    marriage: { minAffinity: 60, yearlyChance: 0.35, affinityPerPartyQuest: 6, affinityPerYearCohabit: 4 },
    birth: { yearlyChance: 0.28, maxChildren: 4, fertileUntilFrac: 0.55 },
    downedRescueSec: 25,
  },
  races: {
    human: { name: '인간', life: 80, adult: 18, xp: 1.0, weight: 0.7 },
    dwarf: { name: '드워프', life: 200, adult: 30, xp: 0.7, weight: 0.2 },
    elf: { name: '엘프', life: 300, adult: 40, xp: 0.5, weight: 0.1 },
  },
  jobs: {
    swordsman: { name: '검사', growth: [1.00, 0.70, 0.90, 0.25, 0.45, 0.15], hp: 60, mp: 10, range: 1.0, cd: 1.0, role: 'melee' },
    mage: { name: '마법사', growth: [0.25, 0.50, 0.55, 1.20, 0.65, 0.15], hp: 38, mp: 40, range: 4.5, cd: 1.6, role: 'aoe' },
    archer: { name: '궁수', growth: [0.60, 1.00, 0.60, 0.30, 0.90, 0.15], hp: 44, mp: 14, range: 5.0, cd: 1.1, role: 'ranged' },
    cleric: { name: '성직자', growth: [0.30, 0.45, 0.75, 1.10, 0.65, 0.15], hp: 46, mp: 36, range: 3.5, cd: 1.4, role: 'heal' },
  },
  combat: { moveSpeed: 2.6, aggroRange: 6, potionAt: 0.35, mageAoeRadius: 1.3, mageMpCost: 6, healMpCost: 7, healAmount: 0.25, restSec: 25, fatiguePerQuest: 30 },
  housing: { guildHall: 6, dormCap: 8, schoolCap: 8 },
  population: { recruitAdultAge: [18, 30] },
};
export const STAT_NAMES = { str: '힘', agi: '민첩', vit: '체력', int: '지능', sen: '감각', luk: '행운' };
export const ELEM_NAMES = { fire: '화염', water: '물', wind: '바람', earth: '대지', thunder: '번개', ice: '얼음' };
