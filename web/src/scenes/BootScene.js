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
    // Expose every packed image as its own texture key WITHOUT copying the atlas.
    // (addSpriteSheetFromAtlas creates a new GPU texture of the whole page per key —
    //  57 keys × one 4096px page = gigabytes of video memory.) Here every key shares
    // the page's single TextureSource, so the atlas is uploaded to the GPU once.
    for (const [key, t] of Object.entries(index.textures)) {
      const page = this.textures.get(t.page);
      const pf = page.get(key);
      const tex = new Phaser.Textures.Texture(this.textures, key, []);
      tex.source.push(page.source[0]);
      tex.add('__BASE', 0, pf.cutX, pf.cutY, pf.cutWidth, pf.cutHeight);
      const cols = Math.floor(pf.cutWidth / t.fw), rows = Math.floor(pf.cutHeight / t.fh);
      let i = 0;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        tex.add(i++, 0, pf.cutX + c * t.fw, pf.cutY + r * t.fh, t.fw, t.fh);
      }
      this.textures.list[key] = tex;
    }
    // Tilemaps need a standalone texture: copy the terrain tileset out of the atlas once.
    const tf = index.textures.terrain;
    if (tf) {
      const fr = this.textures.getFrame(tf.page, 'terrain');
      const ct = this.textures.createCanvas('terrain_ts', fr.width, fr.height);
      ct.drawFrame(tf.page, 'terrain', 0, 0);
      ct.refresh();
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
