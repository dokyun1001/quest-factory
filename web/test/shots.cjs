// Screenshots + measurements for the dev report: node test/shots.cjs [url] [outdir]
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://localhost:4173/';
const out = process.argv[3] || '.';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(url);
  await page.waitForSelector('#bt-test:visible', { timeout: 20000 });
  await page.click('#bt-test');
  await page.waitForFunction(() => window.__qf && window.__qf.player);
  await page.keyboard.press('Tab');
  const look = (tx, ty, z) => page.evaluate(([tx, ty, z]) => { const s = window.__qf; const c = s.cameras.main; s.zoomIdx = z - 1; c.setZoom(z); c.centerOn(tx * 16, ty * 16); s.hudTimer = 999; }, [tx, ty, z]);
  await sleep(10000);
  await look(12, 11, 6); await sleep(700); await page.screenshot({ path: `${out}/s1_zigzag_corners_x6.png` });
  await look(14, 4, 4); await sleep(700); await page.screenshot({ path: `${out}/s2_straight20_x4.png` });
  await look(45, 27, 5); await sleep(700); await page.screenshot({ path: `${out}/s3_miner_smelter_x5.png` });
  await look(9, 31, 6); await sleep(700); await page.screenshot({ path: `${out}/s4_blocked_queue_x6.png` });
  // tooltip on an item
  const it = await page.evaluate(() => { const s = window.__qf; const v = s.logi.visibleItems; const c = s.cameras.main; return v.length ? { x: (v[0] - c.worldView.x) * c.zoom, y: (v[1] - c.worldView.y) * c.zoom } : null; });
  if (it) { await page.mouse.move(it.x, it.y); await sleep(400); }
  await page.screenshot({ path: `${out}/s5_item_tooltip.png` });
  console.log('tooltip:', await page.evaluate(() => document.getElementById('tooltip').textContent));
  await page.mouse.move(5, 300);
  await page.click('#bt-settings'); await sleep(400);
  await page.screenshot({ path: `${out}/s6_item_size_compare.png` });
  await page.click('#st-close');
  // item size 12 on belts
  await page.evaluate(() => window.__qf.setItemSize(12)); await look(9, 26, 6); await sleep(500);
  await page.screenshot({ path: `${out}/s7_items_12px.png` });
  await page.evaluate(() => window.__qf.setItemSize(8)); await sleep(300);
  await page.screenshot({ path: `${out}/s8_items_8px.png` });
  await page.evaluate(() => window.__qf.setItemSize(10));
  await look(30, 20, 1); await sleep(500); await page.screenshot({ path: `${out}/s9_overview_x1.png` });

  // ---------- performance (headless Chromium, software GL; NOT a user PC) ----------
  const measure = async (label) => {
    await sleep(1500);
    const r = await page.evaluate(() => new Promise((res) => {
      const s = window.__qf; const ts = []; let last = performance.now(); const t0 = last;
      const f = () => { const n = performance.now(); ts.push(n - last); last = n; if (n - t0 < 3000) requestAnimationFrame(f); else {
        ts.sort((a, b) => a - b); const avg = ts.reduce((a, b) => a + b, 0) / ts.length;
        res({ fps: (1000 / avg).toFixed(1), p95ms: ts[Math.floor(ts.length * 0.95)].toFixed(1), stats: s.stats() }); } };
      requestAnimationFrame(f);
    }));
    console.log(`PERF ${label}: fps=${r.fps} p95=${r.p95ms}ms sim=${r.stats['sim(ms/frame)']}ms update=${r.stats['frame(ms)']}ms belts=${r.stats.belts} items=${r.stats.items} drawn=${r.stats['items drawn']} chars=${r.stats.characters} charTex=${r.stats['char textures']} tex=${r.stats.textures}`);
  };
  await page.evaluate(() => { window.__qf.cameras.main.setZoom(3); window.__qf.zoomIdx = 2; });
  await look(14, 30, 3); await measure('baseline test layout, zoom3');
  await page.evaluate(() => window.__qf.benchBelts(100)); await sleep(15000); await look(30, 42, 3); await measure('+100 belts (view on bench)');
  await page.evaluate(() => window.__qf.benchBelts(500)); await sleep(20000); await look(30, 45, 3); await measure('+500 belts (view on bench)');
  await look(56, 40, 1); await measure('+500 belts, zoom1 (whole map visible)');
  await page.screenshot({ path: `${out}/s10_bench500_x1.png` });
  for (const n of [1, 10, 50, 100]) { await page.evaluate((n) => window.__qf.benchCharacters(n), n); await look(14, 30, 3); await measure(`${n} characters + 500 belts, zoom3`); }
  await page.screenshot({ path: `${out}/s11_100_characters.png` });
  // save / load round trip of the test layout
  const sz = await page.evaluate(() => window.__qf.save(true));
  console.log('save bytes', sz);
  console.log('errors', JSON.stringify(errors));
  await browser.close();
})();
