// ─────────────────────────────────────────────────────────────────────────────
// ART MANIFEST — the only place that knows what things look like.
// Game logic refers to facilities / items / units / monsters by id; this file
// maps ids to textures, frames, animations, scale and draw offsets.
// Swapping in custom art later = edit textures.json + the entries below.
// ─────────────────────────────────────────────────────────────────────────────
import TEXTURES from './textures.json';
export { TEXTURES };

// Grid rules (docs/REPORT_001.md §4)
export const TILE = 64;           // 1 build cell = 64 world px = Tiny Swords native tile
export const SCALE = {
  tinySwords: 1,                  // 64px art  ×1
  automation: 2,                  // 32px art  ×2  → 64
  icon16: 2,                      // 16px icon ×2  → 32 (world)
  icon16Ui: 3,                    // 16px icon ×3  → 48 (UI)
  kenney: 2,                      // 32px UI   ×2  → 64
};

// ── Animations (Tiny Swords = 10 fps) ───────────────────────────────────────
export const ANIMS = {
  gm_idle: { tex: 'gm_idle', fps: 10 },
  gm_run: { tex: 'gm_run', fps: 10 },
  gm_attack: { tex: 'gm_attack', fps: 14, repeat: 0 },
  pawn_idle: { tex: 'pawn_idle', fps: 10 },
  pawn_run: { tex: 'pawn_run', fps: 10 },
  pawn_run_axe: { tex: 'pawn_run_axe', fps: 10 },
  pawn_run_pick: { tex: 'pawn_run_pick', fps: 10 },
  pawn_run_wood: { tex: 'pawn_run_wood', fps: 10 },
  pawn_run_gold: { tex: 'pawn_run_gold', fps: 10 },
  pawn_chop: { tex: 'pawn_chop', fps: 10 },
  pawn_mine: { tex: 'pawn_mine', fps: 10 },
  archer_idle: { tex: 'archer_idle', fps: 10 },
  archer_run: { tex: 'archer_run', fps: 10 },
  monk_idle: { tex: 'monk_idle', fps: 10 },
  monk_run: { tex: 'monk_run', fps: 10 },
  warrior_y_idle: { tex: 'warrior_y_idle', fps: 10 },
  warrior_y_run: { tex: 'warrior_y_run', fps: 10 },
  enemy_idle: { tex: 'enemy_idle', fps: 10 },
  enemy_archer_idle: { tex: 'enemy_archer_idle', fps: 10 },
  enemy_monk_idle: { tex: 'enemy_monk_idle', fps: 10 },
  tree1_sway: { tex: 'tree1', fps: 8 },
  tree2_sway: { tex: 'tree2', fps: 8 },
  gold_sparkle: { tex: 'goldstone1_hl', fps: 10 },
  bush1: { tex: 'bush1', fps: 8 },
  sheep_idle: { tex: 'sheep_idle', fps: 8 },
  foam: { tex: 'foam', fps: 10 },
  dust: { tex: 'dust', fps: 14, repeat: 0 },
  // machine "working" loops (frame 0 of each strip = powered-off pose)
  m_smelter_work: { tex: 'm_smelter', from: 1, to: 12, fps: 10 },
  m_fabricator_work: { tex: 'm_fabricator', from: 1, to: 14, fps: 12 },
  m_randomizer_work: { tex: 'm_randomizer', from: 1, to: 16, fps: 10 },
  m_electrifier_work: { tex: 'm_electrifier', from: 1, to: 17, fps: 12 },
  m_recycler_work: { tex: 'm_recycler', from: 1, to: 8, fps: 10 },
};

// ── Units ───────────────────────────────────────────────────────────────────
// Tiny Swords units are side-view only: left/right = flipX; up/down reuse run.
export const UNITS = {
  guildmaster: { idle: 'gm_idle', run: 'gm_run', work: 'gm_attack', originY: 0.62 },
  worker: {
    idle: 'pawn_idle', run: 'pawn_run', originY: 0.62,
    runWith: { axe: 'pawn_run_axe', pickaxe: 'pawn_run_pick', wood: 'pawn_run_wood', gold: 'pawn_run_gold' },
    work: { wood: 'pawn_chop', gold: 'pawn_mine' },
  },
  archer: { idle: 'archer_idle', run: 'archer_run', originY: 0.62 },
  monk: { idle: 'monk_idle', run: 'monk_run', originY: 0.62 },
  warrior: { idle: 'warrior_y_idle', run: 'warrior_y_run', originY: 0.62 },
};

// Monsters: Tiny Swords free pack has none (Enemy Pack is paid) → other faction
// colours, darkened, as stand-ins. Replace with custom art later.
export const MONSTERS = {
  shadow_knight: { idle: 'enemy_idle', tint: 0x8a7aa8, originY: 0.62 },
  violet_archer: { idle: 'enemy_archer_idle', tint: 0xb08ad0, originY: 0.62 },
  crimson_monk: { idle: 'enemy_monk_idle', tint: 0xd08a8a, originY: 0.62 },
};

// ── Facilities ──────────────────────────────────────────────────────────────
// tex/frame: static look · work: anim while producing · scale: integers only
// oy: draw offset (px) from the footprint's bottom edge · icon: menu thumbnail
// temp: borrowed art, needs custom asset later (REPORT §8)
export const FACILITIES = {
  belt: { tex: 'belt', scale: SCALE.automation, icon: { tex: 'belt', scale: 1 } },
  hopper: { tex: 'ic_chests', frame: 9, scale: 4, oy: -2, temp: true, icon: { tex: 'ic_chests', frame: 9, scale: 2 } },
  smelter: { tex: 'm_smelter', frame: 0, work: 'm_smelter_work', scale: 2, oy: -2, icon: { tex: 'm_smelter', frame: 6, scale: 1 } },
  fabricator: { tex: 'm_fabricator', frame: 0, work: 'm_fabricator_work', scale: 2, oy: -2, icon: { tex: 'm_fabricator', frame: 0, scale: 1 } },
  quest_assembler: { tex: 'm_randomizer', frame: 0, work: 'm_randomizer_work', scale: 2, oy: -2, temp: true, icon: { tex: 'm_randomizer', frame: 0, scale: 1 } },
  exp_generator: { tex: 'm_electrifier', frame: 0, work: 'm_electrifier_work', scale: 2, oy: -2, temp: true, icon: { tex: 'm_electrifier', frame: 0, scale: 1 } },
  loot_recycler: { tex: 'm_recycler', frame: 0, work: 'm_recycler_work', scale: 2, oy: -2, temp: true, icon: { tex: 'm_recycler', frame: 0, scale: 1 } },
  quest_board: { tex: 'house1', scale: 1, oy: 0, temp: true, icon: { tex: 'ic_books', frame: 8 * 14 + 6, scale: 2 } },
};

// ── Items ───────────────────────────────────────────────────────────────────
export const ITEMS = {
  wood: { tex: 'res_wood', scale: 1 },
  gold_ore: { tex: 'res_gold', scale: 1 },
  gold_ingot: { tex: 'auto_items', frame: 19, scale: 1 },
  gold_sword: { tex: 'ic_weapons', frame: 5, scale: SCALE.icon16 },
  quest_scroll: { tex: 'ic_books', frame: 8 * 14 + 6, scale: SCALE.icon16 },
  exp_crystal: { tex: 'ic_potions', frame: 75, scale: SCALE.icon16 },
  loot_shadow: { tex: 'ic_potions', frame: 86, scale: SCALE.icon16 },
  loot_violet: { tex: 'ic_potions', frame: 97, scale: SCALE.icon16 },
  loot_crimson: { tex: 'ic_potions', frame: 87, scale: SCALE.icon16 },
  research_note: { tex: 'ic_books', frame: 3 * 14 + 10, scale: SCALE.icon16 },
  coin: { tex: 'res_gold', scale: 1 },
};

// status lamps (automation sign frames: 4 cyan, 5 red, 6 green)
export const STATUS_LAMP = { working: 6, blocked: 5, idle: 4 };
