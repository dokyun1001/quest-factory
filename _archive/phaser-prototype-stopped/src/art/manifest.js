// ─────────────────────────────────────────────────────────────────────────────
// ART MANIFEST — the only file that knows where graphics live.
// Game logic refers to facilities / items / units by id; this file maps those
// ids to textures, frames, animations, scale and draw offsets.
// To swap in custom art later: drop PNGs into assets/custom/ and change the
// entries below. No game code needs to change.
// ─────────────────────────────────────────────────────────────────────────────

const TS = 'vendor/tiny-swords/Tiny Swords (Free Pack)';
const TSU = `${TS}/Units`;
const ICONS = 'vendor/rpg-icons-16/16x16 Assorted RPG Icons/16x16 Assorted RPG Icons';
const KENNEY = 'vendor/kenney-ui-pixel-adventure';
const MOD = 'modified';

// Grid rules (see THIRD_PARTY_ASSETS.md / docs/REPORT_001.md §4)
export const TILE = 64;           // 1 build cell = 64 world px = Tiny Swords native tile
export const SCALE = {
  tinySwords: 1,                  // 64px art  ×1
  automation: 2,                  // 32px art  ×2  → 64
  icon16: 2,                      // 16px icon ×2  → 32 (items on belts / in world)
  icon16Ui: 3,                    // 16px icon ×3  → 48 (inventory / UI)
  kenney: 2,                      // 32px UI   ×2  → 64
};

// ── Textures to load ────────────────────────────────────────────────────────
// type: 'image' | 'sheet' (fw/fh = frame size)
export const TEXTURES = {
  // terrain
  terrain: { type: 'sheet', path: `${TS}/Terrain/Tileset/Tilemap_color1.png`, fw: 64, fh: 64 },
  water: { type: 'image', path: `${TS}/Terrain/Tileset/Water Background color.png` },
  foam: { type: 'sheet', path: `${TS}/Terrain/Tileset/Water Foam.png`, fw: 192, fh: 192 },
  tree1: { type: 'sheet', path: `${TS}/Terrain/Resources/Wood/Trees/Tree1.png`, fw: 192, fh: 256 },
  tree2: { type: 'sheet', path: `${TS}/Terrain/Resources/Wood/Trees/Tree2.png`, fw: 192, fh: 256 },
  stump1: { type: 'image', path: `${TS}/Terrain/Resources/Wood/Trees/Stump 1.png` },
  goldstone1: { type: 'image', path: `${TS}/Terrain/Resources/Gold/Gold Stones/Gold Stone 1.png` },
  goldstone3: { type: 'image', path: `${TS}/Terrain/Resources/Gold/Gold Stones/Gold Stone 3.png` },
  goldstone1_hl: { type: 'sheet', path: `${TS}/Terrain/Resources/Gold/Gold Stones/Gold Stone 1_Highlight.png`, fw: 128, fh: 128 },
  bush1: { type: 'sheet', path: `${TS}/Terrain/Decorations/Bushes/Bushe1.png`, fw: 128, fh: 128 },
  rock1: { type: 'image', path: `${TS}/Terrain/Decorations/Rocks/Rock1.png` },
  rock2: { type: 'image', path: `${TS}/Terrain/Decorations/Rocks/Rock2.png` },
  sheep_idle: { type: 'sheet', path: `${TS}/Terrain/Resources/Meat/Sheep/Sheep_Idle.png`, fw: 128, fh: 128 },
  dust: { type: 'sheet', path: `${TS}/Particle FX/Dust_01.png`, fw: 64, fh: 64 },

  // buildings (blue = player guild)
  castle: { type: 'image', path: `${TS}/Buildings/Blue Buildings/Castle.png` },
  house1: { type: 'image', path: `${TS}/Buildings/Blue Buildings/House1.png` },
  house2: { type: 'image', path: `${TS}/Buildings/Blue Buildings/House2.png` },
  tower: { type: 'image', path: `${TS}/Buildings/Blue Buildings/Tower.png` },
  barracks: { type: 'image', path: `${TS}/Buildings/Blue Buildings/Barracks.png` },

  // units
  gm_idle: { type: 'sheet', path: `${TSU}/Blue Units/Warrior/Warrior_Idle.png`, fw: 192, fh: 192 },
  gm_run: { type: 'sheet', path: `${TSU}/Blue Units/Warrior/Warrior_Run.png`, fw: 192, fh: 192 },
  gm_attack: { type: 'sheet', path: `${TSU}/Blue Units/Warrior/Warrior_Attack1.png`, fw: 192, fh: 192 },
  pawn_idle: { type: 'sheet', path: `${TSU}/Blue Units/Pawn/Pawn_Idle.png`, fw: 192, fh: 192 },
  pawn_run: { type: 'sheet', path: `${TSU}/Blue Units/Pawn/Pawn_Run.png`, fw: 192, fh: 192 },
  pawn_run_axe: { type: 'sheet', path: `${TSU}/Blue Units/Pawn/Pawn_Run Axe.png`, fw: 192, fh: 192 },
  pawn_run_pick: { type: 'sheet', path: `${TSU}/Blue Units/Pawn/Pawn_Run Pickaxe.png`, fw: 192, fh: 192 },
  pawn_run_wood: { type: 'sheet', path: `${TSU}/Blue Units/Pawn/Pawn_Run Wood.png`, fw: 192, fh: 192 },
  pawn_run_gold: { type: 'sheet', path: `${TSU}/Blue Units/Pawn/Pawn_Run Gold.png`, fw: 192, fh: 192 },
  pawn_chop: { type: 'sheet', path: `${TSU}/Blue Units/Pawn/Pawn_Interact Axe.png`, fw: 192, fh: 192 },
  pawn_mine: { type: 'sheet', path: `${TSU}/Blue Units/Pawn/Pawn_Interact Pickaxe.png`, fw: 192, fh: 192 },
  archer_idle: { type: 'sheet', path: `${TSU}/Blue Units/Archer/Archer_Idle.png`, fw: 192, fh: 192 },
  archer_run: { type: 'sheet', path: `${TSU}/Blue Units/Archer/Archer_Run.png`, fw: 192, fh: 192 },
  lancer_idle: { type: 'sheet', path: `${TSU}/Blue Units/Lancer/Lancer_Idle.png`, fw: 320, fh: 320 },
  lancer_run: { type: 'sheet', path: `${TSU}/Blue Units/Lancer/Lancer_Run.png`, fw: 320, fh: 320 },
  monk_idle: { type: 'sheet', path: `${TSU}/Blue Units/Monk/Idle.png`, fw: 192, fh: 192 },
  monk_run: { type: 'sheet', path: `${TSU}/Blue Units/Monk/Run.png`, fw: 192, fh: 192 },
  // stand-in "monster": no monsters in the Tiny Swords free pack (Enemy Pack is paid)
  enemy_idle: { type: 'sheet', path: `${TSU}/Black Units/Warrior/Warrior_Idle.png`, fw: 192, fh: 192 },

  // automation (derived, see tools/build_art.py)
  belt: { type: 'image', path: `${MOD}/automation/belt_h.png` },
  auto_items: { type: 'sheet', path: `${MOD}/automation/items.png`, fw: 32, fh: 32 },
  auto_signs: { type: 'sheet', path: `${MOD}/automation/signs.png`, fw: 32, fh: 32 },
  m_smelter: { type: 'sheet', path: `${MOD}/automation/machine_smelter.png`, fw: 47, fh: 34 },
  m_fabricator: { type: 'sheet', path: `${MOD}/automation/machine_fabricator.png`, fw: 39, fh: 40 },
  m_randomizer: { type: 'sheet', path: `${MOD}/automation/machine_randomizer.png`, fw: 45, fh: 31 },
  m_electrifier: { type: 'sheet', path: `${MOD}/automation/machine_electrifier.png`, fw: 39, fh: 32 },
  m_recycler: { type: 'sheet', path: `${MOD}/automation/machine_recycler.png`, fw: 39, fh: 38 },
  m_cooler: { type: 'sheet', path: `${MOD}/automation/machine_cooler.png`, fw: 39, fh: 34 },

  // icons
  ic_weapons: { type: 'sheet', path: `${ICONS}/weapons.png`, fw: 16, fh: 16 },
  ic_books: { type: 'sheet', path: `${ICONS}/books.png`, fw: 16, fh: 16 },
  ic_potions: { type: 'sheet', path: `${ICONS}/potions.png`, fw: 16, fh: 16 },
  ic_chests: { type: 'sheet', path: `${ICONS}/chests.png`, fw: 16, fh: 16 },
  ic_armours: { type: 'sheet', path: `${ICONS}/armours.png`, fw: 16, fh: 16 },
  res_wood: { type: 'image', path: `${MOD}/icons/res_wood.png` },
  res_gold: { type: 'image', path: `${MOD}/icons/res_gold.png` },

  // UI
  ui_paper: { type: 'image', path: `${MOD}/ui/paper_9slice.png` },
  ui_btn_blue: { type: 'image', path: `${MOD}/ui/btn_blue_9slice.png` },
  ui_btn_red: { type: 'image', path: `${MOD}/ui/btn_red_9slice.png` },
  ui_ribbons: { type: 'sheet', path: `${TS}/UI Elements/UI Elements/Ribbons/SmallRibbons.png`, fw: 64, fh: 64 },
  ui_icons: { type: 'image', path: `${TS}/UI Elements/UI Elements/Icons/Icon_01.png` },
  ui_avatar_gm: { type: 'image', path: `${TS}/UI Elements/UI Elements/Human Avatars/Avatars_01.png` },
  ui_cursor: { type: 'image', path: `${TS}/UI Elements/UI Elements/Cursors/Cursor_01.png` },
  kenney: { type: 'sheet', path: `${KENNEY}/Tilesheets/Large tiles/Thick outline/tilemap_packed.png`, fw: 32, fh: 32 },
};

// ── Animations ──────────────────────────────────────────────────────────────
// Tiny Swords animates at 10 fps.
export const ANIMS = {
  gm_idle: { tex: 'gm_idle', fps: 10 },
  gm_run: { tex: 'gm_run', fps: 10 },
  gm_attack: { tex: 'gm_attack', fps: 12, repeat: 0 },
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
  lancer_idle: { tex: 'lancer_idle', fps: 10 },
  lancer_run: { tex: 'lancer_run', fps: 10 },
  monk_idle: { tex: 'monk_idle', fps: 10 },
  monk_run: { tex: 'monk_run', fps: 10 },
  enemy_idle: { tex: 'enemy_idle', fps: 10 },
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
  m_cooler_work: { tex: 'm_cooler', from: 1, to: 9, fps: 10 },
};

// ── Units ───────────────────────────────────────────────────────────────────
// Tiny Swords units are side-view only: left/right = flipX; up/down reuse run.
export const UNITS = {
  guildmaster: { idle: 'gm_idle', run: 'gm_run', work: 'gm_attack', scale: 1, originY: 0.62 },
  worker: {
    idle: 'pawn_idle', run: 'pawn_run', scale: 1, originY: 0.62,
    runWith: { axe: 'pawn_run_axe', pickaxe: 'pawn_run_pick', wood: 'pawn_run_wood', gold: 'pawn_run_gold' },
    work: { wood: 'pawn_chop', gold: 'pawn_mine' },
  },
  adventurer_archer: { idle: 'archer_idle', run: 'archer_run', scale: 1, originY: 0.62 },
  adventurer_lancer: { idle: 'lancer_idle', run: 'lancer_run', scale: 1, originY: 0.56 },
  adventurer_monk: { idle: 'monk_idle', run: 'monk_run', scale: 1, originY: 0.62 },
  monster_placeholder: { idle: 'enemy_idle', scale: 1, originY: 0.62, tint: 0xcc99ff },
};

// ── Facilities ──────────────────────────────────────────────────────────────
// tex/frame: static look · work: anim while producing · scale: integer only
// ox/oy: draw offset from footprint centre (px) · icon: build-menu thumbnail
// temp: true = borrowed art, needs custom asset later (REPORT §8)
export const FACILITIES = {
  belt: { tex: 'belt', scale: SCALE.automation, icon: { tex: 'belt', scale: 1 } },
  hopper: { tex: 'ic_chests', frame: 1, scale: 4, oy: -4, icon: { tex: 'ic_chests', frame: 1, scale: 3 } },
  smelter: { tex: 'm_smelter', frame: 0, work: 'm_smelter_work', scale: 2, oy: -6, icon: { tex: 'm_smelter', frame: 6, scale: 1 } },
  fabricator: { tex: 'm_fabricator', frame: 0, work: 'm_fabricator_work', scale: 2, oy: -10, icon: { tex: 'm_fabricator', frame: 0, scale: 1 } },
  quest_assembler: { tex: 'm_randomizer', frame: 0, work: 'm_randomizer_work', scale: 2, oy: -4, temp: true, icon: { tex: 'm_randomizer', frame: 0, scale: 1 } },
  exp_generator: { tex: 'm_electrifier', frame: 0, work: 'm_electrifier_work', scale: 2, oy: -2, temp: true, icon: { tex: 'm_electrifier', frame: 0, scale: 1 } },
  loot_recycler: { tex: 'm_recycler', frame: 0, work: 'm_recycler_work', scale: 2, oy: -8, temp: true, icon: { tex: 'm_recycler', frame: 0, scale: 1 } },
  quest_board: { tex: 'house1', scale: 1, oy: -60, temp: true, icon: { tex: 'ic_books', frame: 8 * 14 + 6, scale: 3 } },
};

// ── Items ───────────────────────────────────────────────────────────────────
export const ITEMS = {
  wood: { tex: 'res_wood', scale: 1 },
  gold_ore: { tex: 'res_gold', scale: 1 },
  gold_ingot: { tex: 'auto_items', frame: 19, scale: 1 },
  iron_plate: { tex: 'auto_items', frame: 18, scale: 1 },
  gold_sword: { tex: 'ic_weapons', frame: 5, scale: SCALE.icon16 },
  quest_scroll: { tex: 'ic_books', frame: 8 * 14 + 6, scale: SCALE.icon16 },
  exp_crystal: { tex: 'ic_potions', frame: 2, scale: SCALE.icon16 },
};

// status lamps (automation sign frames)
export const STATUS_LAMP = { working: 6, blocked: 5, idle: 4 };
