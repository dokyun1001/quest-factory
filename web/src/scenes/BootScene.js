import Phaser from 'phaser';
import atlasPng from '../gen/atlas.png';
import atlasJson from '../gen/atlas.json';
import { buildIcons, buildPh7 } from '../render/ph007.js';
import { ui } from '../ui/ui.js';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  // ONE approved-art atlas -> ONE GPU texture shared by every sprite.
  preload() { this.load.atlas('atlas', atlasPng, atlasJson); }
  create() { buildIcons(this); buildPh7(this); ui.ready(this); }
}
