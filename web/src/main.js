import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene.js';
import { WorldScene } from './scenes/WorldScene.js';
import { UIScene } from './scenes/UIScene.js';

async function start() {
  // make sure the Korean pixel font is ready before any text is drawn
  try { await Promise.all([document.fonts.load('12px Galmuri11'), document.fonts.load('bold 12px Galmuri11')]); } catch { /* fallback font */ }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 1280,
    height: 720,
    backgroundColor: '#2a3d45',
    pixelArt: true,          // nearest-neighbour everywhere, no blur
    powerPreference: 'high-performance', // laptops: prefer the dedicated GPU
    fps: { target: 60, smoothStep: true },
    roundPixels: true,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    input: { mouse: { preventDefaultWheel: true } }, // wheel zooms the game, not the page
    scene: [BootScene, WorldScene, UIScene],
  });
  window.__game = game;
  // keep keyboard focus on the game so Tab/Space don't move browser focus
  window.addEventListener('keydown', (e) => {
    if (['Tab', ' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
  });
}
start();
