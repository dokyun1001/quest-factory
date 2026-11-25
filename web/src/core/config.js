// Central constants. Values marked TEST are experimental and NOT approved design numbers.
export const TILE = 16;                 // source pixels per tile
export const SIM_HZ = 60;               // fixed logistics step (decoupled from rendering)
export const SIM_DT = 1 / SIM_HZ;
export const BELT_SPEED = 1.5;          // TEST tiles per second
export const ITEM_GAP = 0.6;            // TEST minimum spacing between items, in tiles
export const BELT_FRAME_MS = 120;       // ART 005-R visual test value (independent of BELT_SPEED)
export const CHAR_FRAME_MS = 150;       // ART 004 candidate
export const PLAYER_SPEED = 5;          // TEST tiles per second
export const ZOOMS = [1, 2, 3, 4, 5, 6];
export const DEFAULT_ZOOM = 3;
export const DISCOVER_RADIUS = 6;       // TEST tiles
export const AUTOSAVE_SEC = 30;
export const SAVE_VERSION = 1;
// 007 keys only. 006 keys (qf006.*) and the legacy key 'questfactory.save.v1' are never read, written or deleted.
export const SAVE_KEYS = { main: 'qf007.main.v1', sandbox: 'qf007.sandbox.v1', combat: 'qf007.combat.v1', settings: 'qf007.settings.v1' };
