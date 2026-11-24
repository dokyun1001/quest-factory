import Phaser from 'phaser';
import { TEXTURES, ANIMS } from '../art/manifest.js';

/** Loads the packed atlas pages and re-exposes every texture under its manifest key. */
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  preload() {
    const { width, height } = this.scale;
    const bar = this.add.rectangle(width / 2 - 200, height / 2, 4, 16, 0xffe08a).setOrigin(0, 0.5);
    this.add.text(width / 2, height / 2 - 30, 'QUEST FACTORY 불러오는 중…', { fontFamily: 'Galmuri11', fontSize: '16px', color: '#ffffff' }).setOrigin(0.5);
    this.load.on('progress', (v) => { bar.width = 4 + 396 * v; });
    this.load.json('atlas_index', 'atlas/index.json');
    this.load.once('filecomplete-json-atlas_index', (key, type, data) => {
      for (const p of data.pages) this.load.atlas(p, `atlas/${p}.png`, `atlas/${p}.json`);
    });
  }

  create() {
    const index = this.cache.json.get('atlas_index');
    for (const [key, t] of Object.entries(index.textures)) {
      this.textures.addSpriteSheetFromAtlas(key, { atlas: t.page, frame: key, frameWidth: t.fw, frameHeight: t.fh });
    }
    for (const [key, a] of Object.entries(ANIMS)) {
      if (!TEXTURES[a.tex]) continue;
      const frames = a.from !== undefined
        ? this.anims.generateFrameNumbers(a.tex, { start: a.from, end: a.to })
        : this.anims.generateFrameNumbers(a.tex);
      this.anims.create({ key, frames, frameRate: a.fps, repeat: a.repeat ?? -1 });
    }
    this.scene.start('World');
  }
}
