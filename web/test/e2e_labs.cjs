// Browser checks for TEST B/C/D/E + sandbox full loop: node test/e2e_labs.cjs [url] [outdir] [only]
const { chromium } = require('playwright');
const url = process.argv[2] || 'http://localhost:4174/'; const out = process.argv[3] || '.'; const only = process.argv[4] || 'BCDES';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fps = (page, ms = 3000) => page.evaluate((ms) => new Promise((res) => { const ts = []; let last = performance.now(); const t0 = last; const f = () => { const n = performance.now(); ts.push(n - last); last = n; if (n - t0 < ms) requestAnimationFrame(f); else { ts.sort((a, b) => a - b); const avg = ts.reduce((a, b) => a + b, 0) / ts.length; const s = window.__qf ? window.__qf.stats() : {}; res({ fps: +(1000 / avg).toFixed(1), p95: +ts[Math.floor(ts.length * 0.95)].toFixed(1), sim: s['sim(ms/frame)'], frame: s['frame(ms)'], steps: s['sim steps/frame'], tex: s.textures }); } }; requestAnimationFrame(f); }), ms);
(async () => {
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1280, height: 760 } });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e))); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url); await page.waitForSelector('#bt-new:visible', { timeout: 20000 });
  const menu = async () => { await page.click('#bt-menu'); await page.waitForSelector('#bt-new:visible'); };
  if (only.includes('B')) {
    await page.click('[data-mode="combat"]'); await page.waitForFunction(() => window.__qf && window.__qf.player); await sleep(500);
    await page.keyboard.press('F10'); await sleep(300); await page.screenshot({ path: `${out}/b01_dev.png` });
    await page.click('#d-party'); await sleep(200); await page.click('#d-close');
    await page.evaluate(() => { const s = window.__qf; s.player.x = 38 * 16; s.player.y = 21 * 16; });
    await sleep(6000);
    await page.keyboard.press('F10'); await sleep(200); await page.click('#d-boss'); await page.click('#d-close');
    let shot = false;
    for (let i = 0; i < 80 && !shot; i++) { await sleep(150); const tele = await page.evaluate(() => window.__qf.game.monsters.some((m) => m.tele && m.tele.t > 0.8)); if (tele) { await page.screenshot({ path: `${out}/b02_boss_telegraph.png` }); shot = true; } }
    // issue a retreat with the command bar
    await page.click('#cmdbar [data-c="retreat"]').catch(() => {}); await sleep(1500); await page.screenshot({ path: `${out}/b03_retreat.png` });
    await page.click('#cmdbar [data-c="charge"]').catch(() => {}); await sleep(8000);
    console.log('B: boss alive?', await page.evaluate(() => window.__qf.game.monsters.filter((m) => m.type === 'golem').map((m) => Math.round(m.hp))), 'downs', await page.evaluate(() => window.__qf.game.stats.downs));
    await page.keyboard.press('F10'); await sleep(200); await page.click('#d-trial'); await page.waitForFunction(() => document.getElementById('d-out').innerHTML.includes('승률'), null, { timeout: 120000 });
    console.log('B trial:', (await page.$eval('#d-out', (e) => e.innerText)).replace(/\n/g, ' | '));
    await page.screenshot({ path: `${out}/b04_trial.png` }); await page.click('#d-close');
    await menu();
  }
  if (only.includes('C')) {
    await page.click('[data-lab="life"]'); await sleep(300);
    await page.click('#lb-50'); await sleep(300); await page.click('#lb-50'); await sleep(300);
    const row = await page.$('#lab-body tr.click'); if (row) await row.click(); await sleep(200);
    await page.screenshot({ path: `${out}/c01_life.png`, fullPage: false });
    await page.click('#lb-stats'); await page.waitForFunction(() => document.getElementById('lb-out').innerText.includes('모순'), null, { timeout: 120000 });
    await page.evaluate(() => document.getElementById('lb-out').scrollIntoView());
    await page.screenshot({ path: `${out}/c02_life_stats.png` });
    console.log('C:', (await page.$eval('#lab-body .kv', (e) => e.innerText)).replace(/\n/g, ' | '));
    await page.click('#lb-back'); await sleep(200);
  }
  if (only.includes('D')) {
    await page.click('[data-lab="econ"]'); await sleep(300);
    await page.fill('#eb-m', '20'); await page.click('#eb-run');
    await page.waitForFunction(() => document.getElementById('ec-money'), null, { timeout: 180000 });
    await sleep(300); await page.screenshot({ path: `${out}/d01_econ.png` });
    console.log('D:', (await page.$eval('#lab-body .kv', (e) => e.innerText)).replace(/\n/g, ' | '));
    await page.click('#eb-back'); await sleep(200);
  }
  if (only.includes('E')) {
    await page.click('[data-mode="perf"]'); await page.waitForFunction(() => window.__qf && window.__qf.player); await sleep(800);
    await page.keyboard.press('F3');
    const res = [];
    res.push(['empty perf world', await fps(page)]);
    for (const n of [1000, 5000, 10000]) {
      await page.keyboard.press('F10'); await sleep(150); await page.click(`[data-belts="${n}"]`); await sleep(500); const t = await page.$eval('#d-out', (e) => e.innerText); await page.click('#d-close');
      await sleep(8000);
      await page.evaluate(() => { const s = window.__qf; s.manager || s.toggleManager(); const c = s.cameras.main; c.setZoom(2); s.zoomIdx = 1; c.centerOn(150 * 16, 20 * 16); });
      res.push([`belts ${n} (view on belts, zoom2) ${t}`, await fps(page)]);
      await page.evaluate(() => { const s = window.__qf; const c = s.cameras.main; c.centerOn(14 * 16, 86 * 16); });
      res.push([`belts ${n} (view elsewhere)`, await fps(page)]);
    }
    await page.screenshot({ path: `${out}/e01_belts10k.png` });
    for (const n of [10, 50, 100, 200, 500]) {
      await page.keyboard.press('F10'); await sleep(150); await page.click(`[data-advs="${n}"]`); await sleep(300); await page.click('#d-close');
      await sleep(10000);
      await page.evaluate(() => { const s = window.__qf; const c = s.cameras.main; c.setZoom(2); c.centerOn(40 * 16, 80 * 16); });
      res.push([`adventurers ${n} + belts 10000`, await fps(page)]);
    }
    await page.screenshot({ path: `${out}/e02_advs500.png` });
    await page.keyboard.press('F10'); await sleep(150); await page.click('#d-res1000'); await sleep(500); console.log('E residents:', await page.$eval('#d-out', (e) => e.innerText));
    await page.click('#d-saveload'); await page.waitForFunction(() => document.getElementById('d-out').innerText.includes('복원'), null, { timeout: 120000 });
    console.log('E save/load:', await page.$eval('#d-out', (e) => e.innerText)); await page.click('#d-close');
    res.push(['500 adv + 1000 residents + 10000 belts', await fps(page)]);
    console.log('E stats:', JSON.stringify(await page.evaluate(() => window.__qf.stats())));
    for (const [k, v] of res) console.log(`PERF ${k}: ${JSON.stringify(v)}`);
    await menu();
  }
  if (only.includes('S')) {
    // sandbox: full TEST A loop with dev resources at x10 speed (verifies the whole chain in a real browser)
    await page.click('[data-mode="sandbox"]'); await page.waitForFunction(() => window.__qf && window.__qf.player); await sleep(500);
    await page.evaluate(() => {
      const s = window.__qf, g = s.game, w = s.world;
      w.reveal(18, 40, 60);
      const board = w.placeFacility('quest_board', 20, 43); const shop = w.placeFacility('shop', 24, 43, 'E'); const ct = w.placeFacility('counter', 12, 43, 'S'); w.placeFacility('lab', 8, 34);
      board.stock.quest = 10; shop.stock = { sword_wood: 2, staff_wood: 2, bow_wood: 2, mace_wood: 2, armor_leather: 2 };
      for (let i = 0; i < 6; i++) g.recruit({}, true);
      g.addTemplate({ type: 'hunt', target: 'slime', count: 5, party: 2, concurrent: 2 });
      g.timeScale = 10;
    });
    await sleep(25000);
    await page.evaluate(() => { const s = window.__qf; s.toggleManager(); s.cameras.main.setZoom(2); s.zoomIdx = 1; const u = [...s.game.units.values()].find((x) => x.state === 'fight') || [...s.game.units.values()][0]; s.followUnit(u); });
    await sleep(1200); await page.screenshot({ path: `${out}/s01_sandbox_follow.png` });
    console.log('S:', JSON.stringify(await page.evaluate(() => { const g = window.__qf.game; return { done: g.guild.completed, failed: g.guild.failed, kills: g.stats.kills, bought: g.stats.bought, sold: g.stats.sold, samples: g.guild.samples, codex: g.guild.codex.size, money: g.moneySupply() }; })));
    await page.keyboard.press('g'); await sleep(300); await page.click('[data-t="econ"]'); await sleep(200); await page.screenshot({ path: `${out}/s02_guild_econ.png` });
    await page.click('[data-t="research"]'); await sleep(200); await page.screenshot({ path: `${out}/s03_research.png` });
    await page.click('[data-t="adv"]'); await sleep(200); await page.screenshot({ path: `${out}/s04_adventurers.png` });
    await page.keyboard.press('Escape');
    await menu();
  }
  console.log('keys', await page.evaluate(() => Object.keys(localStorage).join(',')));
  console.log('errors', JSON.stringify(errors));
  await browser.close();
})();
