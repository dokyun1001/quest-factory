// Mouse-driven build + save/reload check on the MAIN game: node test/build_save.cjs [url] [outdir]
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://localhost:4173/';
const out = process.argv[3] || '.';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  // A legacy save from the old demo must survive untouched
  await page.goto(url);
  await page.evaluate(() => localStorage.setItem('questfactory.save.v1', '{"legacy":true}'));
  await page.reload();
  await page.waitForSelector('#bt-new:visible');
  await page.click('#bt-new');
  // pick skin 3, blonde hair, blue shirt
  await page.click('#cr-skin button:nth-child(3)');
  await page.click('#cr-hairpal button[title="금발"]');
  await page.click('#cr-outpal button[title="푸른색 (시험)"]');
  await page.click('#cr-ok');
  await page.waitForFunction(() => window.__qf && window.__qf.player);
  await sleep(500);
  const scr = (tx, ty) => page.evaluate(([tx, ty]) => { const c = window.__qf.cameras.main; return [((tx + 0.5) * 16 - c.worldView.x) * c.zoom, ((ty + 0.5) * 16 - c.worldView.y) * c.zoom]; }, [tx, ty]);
  // walk to the first iron deposit (discovers it), then go to manager view
  await page.evaluate(() => { const s = window.__qf; s.player.x = 18 * 16; s.player.y = 25 * 16; s.world.discoverAround(18, 24); });
  await page.keyboard.press('Tab'); await sleep(200);
  await page.evaluate(() => { const c = window.__qf.cameras.main; c.centerOn(22 * 16, 24 * 16); });
  await sleep(200);
  const dep = await page.evaluate(() => { const w = window.__qf.world; const c = w.clusters[0]; const xs = c.tiles.map((i) => [i % w.w, Math.floor(i / w.w)]); return xs; });
  // place a miner on a deposit tile (miner origin = clicked tile - 1 row)
  let minerAt = null;
  await page.keyboard.press('2');
  for (const [x, y] of dep) {
    if (await page.evaluate(([x, y]) => window.__qf.world.canPlaceFacility('miner', x, y - 1).ok, [x, y])) {
      const [sx, sy] = await scr(x, y); await page.mouse.click(sx, sy); minerAt = [x, y - 1]; break;
    }
  }
  console.log('miner at', minerAt, 'facilities', await page.evaluate(() => window.__qf.world.facilities.size));
  // drag a conveyor from the miner output east 4 tiles then south 3 tiles
  await page.keyboard.press('1');
  const [ox, oy] = [minerAt[0] + 2, minerAt[1] + 1];
  let [sx, sy] = await scr(ox, oy);
  await page.mouse.move(sx, sy); await page.mouse.down();
  for (let i = 1; i <= 4; i++) { const [x, y] = await scr(ox + i, oy); await page.mouse.move(x, y, { steps: 3 }); }
  for (let i = 1; i <= 3; i++) { const [x, y] = await scr(ox + 4, oy + i); await page.mouse.move(x, y, { steps: 3 }); }
  await page.mouse.up();
  // storage at the end
  await page.keyboard.press('5');
  [sx, sy] = await scr(ox + 4, oy + 4); await page.mouse.click(sx, sy);
  await page.keyboard.press('q');
  const shapes = await page.evaluate(([ox, oy]) => { const w = window.__qf.world; const r = []; for (let i = 0; i <= 4; i++) { const b = w.beltAt(ox + i, oy); r.push(b && b.in + b.out); } for (let i = 1; i <= 3; i++) { const b = w.beltAt(ox + 4, oy + i); r.push(b && b.in + b.out); } return r; }, [ox, oy]);
  console.log('dragged belt shapes', shapes.join(' '));
  await sleep(12000);
  const delivered = await page.evaluate(([x, y]) => { const f = window.__qf.world.facAt(x, y); return f && f.counts; }, [ox + 4, oy + 4]);
  console.log('storage received', JSON.stringify(delivered));
  await page.screenshot({ path: `${out}/20_main_built.png` });
  // right-click delete one belt, then re-place it
  [sx, sy] = await scr(ox + 4, oy + 2); await page.keyboard.press('1'); await page.mouse.click(sx, sy, { button: 'right' });
  console.log('after delete belt exists?', await page.evaluate(([x, y]) => !!window.__qf.world.beltAt(x, y), [ox + 4, oy + 2]));
  await page.keyboard.press('Tab');
  // recruit 2 adventurers
  await page.evaluate(() => { window.__qf.recruit(); window.__qf.recruit(); });
  const before = await page.evaluate(() => JSON.stringify({ w: window.__qf.world.serialize().belts.length, a: window.__qf.player.appearance, adv: window.__qf.adventurers.map((a) => a.data) }));
  await page.click('#bt-save'); await sleep(300);
  await page.reload();
  await page.waitForSelector('#bt-continue:visible');
  await page.click('#bt-continue');
  await page.waitForFunction(() => window.__qf && window.__qf.player); await sleep(500);
  const after = await page.evaluate(() => JSON.stringify({ w: window.__qf.world.serialize().belts.length, a: window.__qf.player.appearance, adv: window.__qf.adventurers.map((a) => a.data) }));
  console.log('reload identical (belt count, appearance, adventurers):', before === after);
  console.log('legacy save untouched:', await page.evaluate(() => localStorage.getItem('questfactory.save.v1')));
  console.log('keys:', await page.evaluate(() => Object.keys(localStorage).sort().join(',')));
  await page.click('#bt-roster'); await sleep(300); await page.screenshot({ path: `${out}/21_roster.png` }); await page.click('#rs-close');
  await page.screenshot({ path: `${out}/22_after_reload.png` });
  console.log('errors', JSON.stringify(errors));
  await browser.close();
})();
