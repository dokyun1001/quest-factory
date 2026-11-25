// TEST A browser check with real keyboard/mouse input: node test/e2e_a.cjs [url] [outdir]
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://localhost:4174/'; const out = process.argv[3] || '.';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url); await page.waitForSelector('#bt-new:visible', { timeout: 20000 });
  await page.screenshot({ path: `${out}/a01_title.png` });
  await page.click('#bt-new'); await page.click('#cr-random'); await page.click('#cr-ok');
  await page.waitForFunction(() => window.__qf && window.__qf.player); await sleep(800);
  await page.screenshot({ path: `${out}/a02_start.png` });
  const scr = (tx, ty) => page.evaluate(([tx, ty]) => { const c = window.__qf.cameras.main; return [((tx + 0.5) * 16 - c.worldView.x) * c.zoom, ((ty + 0.5) * 16 - c.worldView.y) * c.zoom]; }, [tx, ty]);
  const pos = () => page.evaluate(() => [window.__qf.player.x / 16, window.__qf.player.y / 16]);
  const walkTo = async (tx, ty) => {
    for (let k = 0; k < 120; k++) {
      const p = await pos(); const dx = tx - p[0], dy = ty - p[1];
      if (Math.abs(dx) < 0.35 && Math.abs(dy) < 0.35) return true;
      const key = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'd' : 'a') : (dy > 0 ? 's' : 'w');
      await page.keyboard.down(key); await sleep(Math.min(250, Math.max(30, Math.max(Math.abs(dx), Math.abs(dy)) * 160))); await page.keyboard.up(key);
    }
    return false;
  };
  const nearestTree = () => page.evaluate(() => { const w = window.__qf.world; let b = null, bd = 1e9; const px = window.__qf.player.x / 16, py = window.__qf.player.y / 16; for (let i = 0; i < w.tree.length; i++) if (w.tree[i] === 1 && w.explored[i]) { const x = i % w.w, y = (i / w.w) | 0; const d = (x - px) ** 2 + (y - py) ** 2; if (d < bd) { bd = d; b = [x, y]; } } return b; });
  for (let k = 0; k < 5; k++) { const t = await nearestTree(); await walkTo(t[0] + 0.5, t[1] + 1.55); await page.keyboard.press('w'); await page.keyboard.press('e'); await sleep(400); }
  console.log('wood after chopping 5 trees with E:', await page.evaluate(() => window.__qf.inv.count('wood')));
  const dep = await page.evaluate(() => { const w = window.__qf.world; for (let i = 0; i < w.deposit.length; i++) if (w.deposit[i] === 4 && w.explored[i]) return [i % w.w, (i / w.w) | 0]; });
  await walkTo(dep[0] + 0.5, dep[1] + 0.9);
  for (let i = 0; i < 14; i++) { await page.keyboard.press('e'); await sleep(380); }
  console.log('inventory', await page.evaluate(() => JSON.stringify(window.__qf.inv.totals())));
  // crafting UI
  await page.keyboard.press('c'); await sleep(300);
  await page.screenshot({ path: `${out}/a03_craft.png` });
  const pick = async (label) => { for (const r of await page.$$('#cr-list .rrow')) { const t = await r.textContent(); if (t.startsWith(label)) { await r.click(); await sleep(120); return true; } } return false; };
  await page.click('[data-f="all"]'); await sleep(150);
  await pick('소형 채굴기'); await page.screenshot({ path: `${out}/a04_craft_miner.png` });
  const can = await page.$eval('#cr-go', (b) => !b.disabled); if (can) await page.click('#cr-go');
  await pick('컨베이어'); await page.click('[data-q="5"]'); await page.click('#cr-go').catch(() => {});
  await page.keyboard.press('Escape'); await sleep(200);
  console.log('crafted miner:', can, 'inv', await page.evaluate(() => JSON.stringify(window.__qf.inv.totals())));
  // place miner on iron with hotbar key, R to rotate, mouse click
  const iron = await page.evaluate(() => { const w = window.__qf.world; for (let i = 0; i < w.deposit.length; i++) if (w.deposit[i] === 1 && w.explored[i]) return [i % w.w, (i / w.w) | 0]; return null; });
  const slot = await page.evaluate(() => window.__qf.inv.slots.findIndex((s) => s && s.id === 'fac_small_miner'));
  if (iron && slot >= 0) {
    await walkTo(iron[0] - 1.5, iron[1] + 2.5);
    await page.keyboard.press(String((slot + 1) % 10)); await sleep(100);
    await page.keyboard.press('r'); await sleep(100);
    const [x, y] = await scr(iron[0], iron[1]); await page.mouse.move(x, y); await sleep(250);
    await page.screenshot({ path: `${out}/a05_miner_ghost.png` });
    await page.mouse.click(x, y); await sleep(300);
    // belt from the miner output (south) with drag
    const bslot = await page.evaluate(() => window.__qf.inv.slots.findIndex((s) => s && s.id === 'belt_1'));
    if (bslot >= 0) {
      await page.keyboard.press(String((bslot + 1) % 10));
      const [ax, ay] = await scr(iron[0], iron[1] + 1); const [bx, by] = await scr(iron[0], iron[1] + 4);
      await page.mouse.move(ax, ay); await page.mouse.down(); await page.mouse.move(bx, by, { steps: 8 }); await page.mouse.up();
    }
  }
  console.log('facilities', await page.evaluate(() => [...window.__qf.world.facilities.values()].map((f) => `${f.type}:${f.rot}:${f.mineType}`).join(',')), 'belts', await page.evaluate(() => window.__qf.world.beltCount));
  await page.keyboard.press('q'); await sleep(200);
  await page.screenshot({ path: `${out}/a06_built.png` });
  // guild: recruit + quest tab
  await page.keyboard.press('g'); await sleep(300); await page.click('#g-recruit'); await sleep(200);
  await page.screenshot({ path: `${out}/a07_guild.png` });
  await page.click('[data-t="quests"]'); await sleep(200); await page.screenshot({ path: `${out}/a08_quests.png` });
  await page.keyboard.press('Escape');
  console.log('adventurers', await page.evaluate(() => window.__qf.game.units.size));
  await sleep(14000);  // let the miner produce (12 s per ore at basic tier)
  console.log('miner made', await page.evaluate(() => [...window.__qf.world.facilities.values()].map((f) => f.made).join(',')), 'items on belts', await page.evaluate(() => window.__qf.world.countItems()));
  await page.screenshot({ path: `${out}/a09_running.png` });
  await page.click('#bt-save'); await sleep(300);
  const snap = () => page.evaluate(() => JSON.stringify({ f: window.__qf.world.facilities.size, b: window.__qf.world.beltCount, u: window.__qf.game.units.size, inv: window.__qf.inv.totals() }));
  const before = await snap();
  await page.reload(); await page.waitForSelector('#bt-continue:visible'); await page.click('#bt-continue');
  await page.waitForFunction(() => window.__qf && window.__qf.player); await sleep(500);
  const after = await snap();
  console.log('save/reload identical:', before === after, before, after);
  console.log('keys', await page.evaluate(() => Object.keys(localStorage).join(',')));
  console.log('errors', JSON.stringify(errors));
  await browser.close();
})();
