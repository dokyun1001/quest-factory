// Data-driven recipes. stations: where it can be made ('hand' = player crafting list).
// time: seconds at basic tier (machines scale by industry tier). tech: required research id.
import { B } from './balance.js';
import { FACILITIES } from './facilities.js';
const R = (id, out, inp, time, stations, tech) => ({ id, out, in: inp, time, stations, tech });
export const RECIPES = [
  // logistics & buildings (hand)
  R('belt_1', { belt_1: 2 }, { wood: 1, stone: 1 }, 1, ['hand']),
  R('belt_2', { belt_2: 1 }, { belt_1: 1, iron_ingot: 1 }, 2, ['hand', 'forge'], 'natural_power'),
  R('belt_3', { belt_3: 1 }, { belt_2: 1, iron_ingot: 2 }, 2, ['hand', 'forge'], 'steam'),
  R('belt_4', { belt_4: 1 }, { belt_3: 1, gold_ingot: 1 }, 2, ['hand', 'forge'], 'arcane'),
  R('belt_5', { belt_5: 1 }, { belt_4: 1, golem_core: 1 }, 2, ['hand', 'forge'], 'ancient'),
  // processing (hand allowed for early game; machines automate)
  R('pulp', { pulp: 1 }, { wood: 1, water: 1 }, 4, ['hand', 'pulper']),
  R('paper', { paper: 1 }, { pulp: 2 }, 5, ['hand', 'press']),
  R('pigment_coal', { pigment: 2 }, { coal: 1 }, 4, ['hand', 'grinder']),
  R('pigment_charcoal', { pigment: 1 }, { charcoal: 1 }, 4, ['hand', 'grinder']),
  R('ink', { ink: 1 }, { pigment: 1, water: 1 }, 4, ['hand', 'mixer']),
  R('quest', { quest: 1 }, { paper: 1, ink: 1 }, 6, ['hand', 'scribe']),
  R('string', { string: 1 }, { fiber: 3 }, 3, ['hand', 'forge']),
  // equipment
  R('sword_wood', { sword_wood: 1 }, { wood: 4 }, 6, ['hand', 'forge']),
  R('staff_wood', { staff_wood: 1 }, { wood: 3, slime: 1 }, 6, ['hand', 'forge']),
  R('bow_wood', { bow_wood: 1 }, { wood: 3, string: 1 }, 6, ['hand', 'forge']),
  R('mace_wood', { mace_wood: 1 }, { wood: 3, stone: 2 }, 6, ['hand', 'forge']),
  R('armor_leather', { armor_leather: 1 }, { wolf_pelt: 3, string: 1 }, 10, ['hand', 'forge']),
  R('sword_iron', { sword_iron: 1 }, { iron_ingot: 3, wood: 1 }, 12, ['forge'], 'iron_arms'),
  R('mace_iron', { mace_iron: 1 }, { iron_ingot: 3, wood: 1 }, 12, ['forge'], 'iron_arms'),
  R('staff_gel', { staff_gel: 1 }, { staff_wood: 1, slime: 4, gold_ingot: 1 }, 12, ['forge'], 'iron_arms'),
  R('bow_fang', { bow_fang: 1 }, { bow_wood: 1, wolf_fang: 3, iron_ingot: 1 }, 12, ['forge'], 'iron_arms'),
  R('armor_iron', { armor_iron: 1 }, { iron_ingot: 5, armor_leather: 1 }, 16, ['forge'], 'iron_arms'),
  R('potion_hp', { potion_hp: 2 }, { herb: 2, water: 1, slime: 1 }, 6, ['hand', 'alchemy'], 'alchemy'),
  R('potion_mp', { potion_mp: 2 }, { berry: 2, water: 1, slime: 1 }, 6, ['hand', 'alchemy'], 'alchemy'),
];
// furnace recipes (ore port + fuel port). Fuel is consumed only when a smelt actually starts.
export const FURNACE = {
  iron_ore: { out: 'iron_ingot', time: B.industry.furnaceSec },
  gold_ore: { out: 'gold_ingot', time: B.industry.furnaceSec },
  copper_ore: { out: 'copper_ingot', time: B.industry.furnaceSec },
  wood: { out: 'charcoal', time: B.industry.charcoalSec },
};
// crusher: equipment -> crusherReturn of its recipe inputs (floor, at least 0). Prevents material gain.
// facility build recipes generated from FACILITIES.cost
for (const [id, f] of Object.entries(FACILITIES)) RECIPES.push(R(`fac_${id}`, { [`fac_${id}`]: 1 }, f.cost, 2, ['hand'], f.tech));
export const RECIPE_BY_ID = Object.fromEntries(RECIPES.map((r) => [r.id, r]));
export const recipesFor = (station) => RECIPES.filter((r) => r.stations.includes(station));
export const recipeProducing = (item) => RECIPES.filter((r) => r.out[item]);
