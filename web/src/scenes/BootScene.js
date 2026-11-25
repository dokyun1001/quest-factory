import Phaser from 'phaser';
import atlasPng from '../gen/atlas.png';
import atlasJson from '../gen/atlas.json';
import { buildPlaceholderTexture } from '../render/placeholders.js';
import { ui } from '../ui/ui.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  preload() {
    // ONE atlas image -> ONE GPU texture shared by every sprite (no per-frame texture copies).
    this.load.atlas('atlas', atlasPng, atlasJson);
  }
  create() {
    buildPlaceholderTexture(this);
    ui.ready(this);
  }
}
