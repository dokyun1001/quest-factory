// Browser smoke test: node test/smoke.cjs [url] [outdir]
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://localhost:4173/';
const out = process.argv[3] || '.';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.waitForSelector('#bt-new:visible', { timeout: 20000 });
  await page.screenshot({ path: `${out}/01_title.png` });
  await page.click('#bt-new');
  await page.click('#cr-random'); await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/02_creator.png` });
  await page.click('#cr-ok');
  await page.waitForFunction(() => window.__qf && window.__qf.player, null, { timeout: 10000 });
  await page.waitForTimeout(800);
  await page.keyboard.down('d'); await page.waitForTimeout(1200); await page.keyboard.up('d');
  await page.keyboard.down('s'); await page.waitForTimeout(600); await page.keyboard.up('s');
  const p = await page.evaluate(() => ({ x: window.__qf.player.x, y: window.__qf.player.y, f: window.__qf.player.facing }));
  console.log('player after move', JSON.stringify(p));
  await page.screenshot({ path: `${out}/03_main_direct.png` });
  console.log('errors', JSON.stringify(errors));
  await browser.close();
})();
