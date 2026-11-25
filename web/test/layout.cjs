// Test-layout check: node test/layout.cjs [url] [outdir]
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://localhost:4173/';
const out = process.argv[3] || '.';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  await page.waitForSelector('#bt-test:visible', { timeout: 20000 });
  await page.click('#bt-test');
  await page.waitForFunction(() => window.__qf && window.__qf.player, null, { timeout: 10000 });
  await page.keyboard.press('Tab');
  await page.evaluate(() => { const c = window.__qf.cameras.main; c.setZoom(3); window.__qf.zoomIdx = 2; c.scrollX = -150; c.scrollY = -90; });
  await page.waitForTimeout(9000);
  await page.screenshot({ path: `${out}/10_test_manager.png` });
  await page.evaluate(() => { const c = window.__qf.cameras.main; c.scrollX = 400; c.scrollY = 190; });
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}/11_test_factory.png` });
  // hover an item for tooltip
  const it = await page.evaluate(() => { const s = window.__qf; const v = s.logi.visibleItems; if (!v.length) return null; const c = s.cameras.main; return { x: (v[0] - c.worldView.x) * c.zoom, y: (v[1] - c.worldView.y) * c.zoom }; });
  if (it) { await page.mouse.move(it.x, it.y); await page.waitForTimeout(300); }
  console.log('tooltip', await page.evaluate(() => document.getElementById('tooltip').textContent));
  await page.keyboard.press('F3');
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${out}/12_test_debug.png` });
  console.log(JSON.stringify(await page.evaluate(() => window.__qf.stats())));
  console.log('errors', JSON.stringify(errors));
  await browser.close();
})();
