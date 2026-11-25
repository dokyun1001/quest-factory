// Character entity shared by the guild master, adventurers and benchmark NPCs.
import { TILE, CHAR_FRAME_MS } from '../core/config.js';
import { appearanceKey } from '../data/appearance.js';

export const ROW = { S: 0, W: 1, E: 2, N: 3 }; // sheet rows: down, left, right, up
const HALF_W = 4, FOOT_H = 3;                  // feet collision box (px)

export class Character {
  constructor(scene, composer, appearance, x, y) {
    this.scene = scene; this.composer = composer;
    this.appearance = appearance;
    this.key = composer.acquire(appearance);
    this.x = x; this.y = y; this.facing = 'S'; this.moving = false; this.t = 0;
    this.sprite = scene.add.image(Math.round(x), Math.round(y), this.key, 'idle_0_0').setOrigin(0.5, 1);
    this.lastFrame = '';
  }
  setAppearance(a) {
    if (appearanceKey(a) === this.key) { this.appearance = a; return; }
    const old = this.key;
    this.key = this.composer.acquire(a); this.appearance = a;
    this.sprite.setTexture(this.key, 'idle_0_0'); this.lastFrame = '';
    this.composer.release(old);
  }
  // Axis-separated movement against solid tiles (world.solidAt)
  move(world, dx, dy) {
    if (dx) { const nx = this.x + dx; if (!this.blocked(world, nx, this.y)) this.x = nx; }
    if (dy) { const ny = this.y + dy; if (!this.blocked(world, this.x, ny)) this.y = ny; }
  }
  blocked(world, x, y) {
    const x0 = Math.floor((x - HALF_W) / TILE), x1 = Math.floor((x + HALF_W - 0.01) / TILE);
    const y0 = Math.floor((y - FOOT_H) / TILE), y1 = Math.floor((y - 0.01) / TILE);
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) if (world.solidAt(tx, ty)) return true;
    return false;
  }
  occupiesTile(tx, ty) {
    return this.x + HALF_W > tx * TILE && this.x - HALF_W < (tx + 1) * TILE && this.y > ty * TILE && this.y - FOOT_H < (ty + 1) * TILE;
  }
  render(dtMs, visible) {
    this.sprite.visible = visible;
    if (!visible) return;
    this.t += dtMs;
    const col = Math.floor(this.t / CHAR_FRAME_MS) % 4;
    const f = `${this.moving ? 'walk' : 'idle'}_${ROW[this.facing]}_${col}`;
    if (f !== this.lastFrame) { this.sprite.setFrame(f); this.lastFrame = f; }
    this.sprite.x = Math.round(this.x); this.sprite.y = Math.round(this.y);
    this.sprite.setDepth(1000 + this.y);
  }
  destroy() { this.sprite.destroy(); this.composer.release(this.key); }
}
