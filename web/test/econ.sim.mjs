// TEST D — economy lab (headless, real adventurer AI + real market/ledger rules).
// The factory is abstracted as a SUPPLY RATE of finished goods into the shop (the variable under test).
// node web/test/econ.sim.mjs [--json out.json]
import { createMainWorld } from '../src/sim/maps.js';
import { Game } from '../src/sim/game.js';
import { B } from '../src/data/balance.js';

const GOODS = ['sword_wood', 'staff_wood', 'bow_wood', 'mace_wood', 'armor_leather', 'sword_iron', 'mace_iron', 'staff_gel', 'bow_fang', 'armor_iron', 'potion_hp'];
function scenario(name, { advs, supplyPerMin, minutes, faucet = false, startGold = B.economy.startGuildGold, seed = 5, recruitPaid = false }) {
  B.economy.testFaucet.enabled = faucet;
  const w = createMainWorld(); w.reveal(40, 40, 120);
  const g = new Game(w, { seed }); g.ledger.guild = startGold; g.ledger.injected = startGold;
  for (const t of ['iron_arms', 'alchemy']) g.guild.tech.add(t);
  const board = w.placeFacility('quest_board', 20, 42); const shop = w.placeFacility('shop', 24, 42, 'E');
  const ct = w.placeFacility('counter', 12, 42, 'S');
  for (let i = 0; i < advs; i++) g.recruit({}, !recruitPaid);
  const m0 = g.moneySupply();
  g.addTemplate({ type: 'hunt', target: 'slime', count: 5, party: 2, concurrent: Math.max(1, Math.ceil(advs / 4)) });
  g.addTemplate({ type: 'hunt', target: 'wolf', count: 5, party: 3, concurrent: Math.max(1, Math.ceil(advs / 8)) });
  const dt = 1 / B.time.simHz; let supplyAcc = 0; let k = 0;
  const trace = []; const firstGear = new Map();
  for (let t = 0; t < minutes * 60; t += dt) {
    g.tick(dt);
    board.stock.quest = 30;                              // paper/ink production assumed sufficient here
    supplyAcc += supplyPerMin * dt / 60;
    while (supplyAcc >= 1) { supplyAcc--; const id = GOODS[k++ % GOODS.length]; shop.stock[id] = (shop.stock[id] || 0) + 1; }
    // the guild's factory consumes bought-back loot (it leaves the counter into production)
    if (Math.floor(t / dt) % 200 === 0) for (const kk of Object.keys(ct.stock)) delete ct.stock[kk];
    for (const u of g.units.values()) if (u.p.equip.weapon && !firstGear.has(u.id)) firstGear.set(u.id, t);
    if (Math.floor(t / dt) % (60 / dt) === 0) {
      trace.push({ min: Math.round(t / 60), guild: Math.round(g.ledger.guild), escrow: g.guild.escrow, advGold: Math.round(g.people.reduce((s, p) => s + p.gold, 0)), supply: g.moneySupply(),
        price: { sword_wood: g.market.price('sword_wood'), sword_iron: g.market.price('sword_iron'), slime: g.market.price('slime'), wolf_pelt: g.market.price('wolf_pelt'), potion_hp: g.market.price('potion_hp') },
        shopStock: Object.values(shop.stock).reduce((a, b) => a + b, 0), done: g.guild.completed });
    }
  }
  const prices = trace.map((x) => x.price);
  const swing = {};
  for (const id of Object.keys(prices[0])) { const v = prices.map((p) => p[id]); swing[id] = [Math.min(...v), Math.max(...v)]; }
  const geared = [...firstGear.values()];
  const r = {
    name, advs, supplyPerMin, minutes, faucet,
    moneyStart: m0, moneyEnd: g.moneySupply(), injectedTotal: g.ledger.injected, faucet: g.ledger.faucet, flows: g.ledger.flows,
    guildEnd: Math.round(g.ledger.guild), advGoldEnd: Math.round(g.people.reduce((s, p) => s + p.gold, 0)),
    quests: { posted: g.guild.posted, done: g.guild.completed, failed: g.guild.failed, stalls: g.guild.stalls },
    bought: g.stats.bought, sold: g.stats.sold,
    gearedFrac: +(geared.length / g.units.size).toFixed(2), avgSecToFirstGear: geared.length ? Math.round(geared.reduce((a, b) => a + b, 0) / geared.length) : null,
    priceRange: swing, trace,
  };
  console.log(`\n[${name}] advs ${advs}, supply ${supplyPerMin}/min, ${minutes} min${faucet ? ', TEST faucet ON' : ''}`);
  console.log(`  money supply ${m0} -> ${r.moneyEnd} (faucet ${r.faucet}); guild ${r.guildEnd}, adventurers ${r.advGoldEnd}, escrow ${g.guild.escrow}`);
  console.log(`  quests posted ${r.quests.posted}, done ${r.quests.done}, failed ${r.quests.failed}, stalls(no funds) ${r.quests.stalls}; purchases ${r.bought}, loot sold ${r.sold}`);
  console.log(`  geared ${Math.round(r.gearedFrac * 100)}%, avg time to first weapon ${r.avgSecToFirstGear}s; price ranges ${JSON.stringify(swing)}`);
  console.log(`  flows ${JSON.stringify(r.flows)}`);
  return r;
}
const t0 = Date.now();
const res = [
  scenario('balanced-10', { advs: 10, supplyPerMin: 3, minutes: 30 }),
  scenario('oversupply-10', { advs: 10, supplyPerMin: 15, minutes: 30 }),
  scenario('undersupply-10', { advs: 10, supplyPerMin: 0.5, minutes: 30 }),
  scenario('crowd-50', { advs: 50, supplyPerMin: 8, minutes: 30 }),
  scenario('paid-recruits-10', { advs: 10, supplyPerMin: 3, minutes: 30, recruitPaid: true }),
  scenario('poor-guild-10', { advs: 10, supplyPerMin: 3, minutes: 30, startGold: 60 }),
  scenario('faucet-10', { advs: 10, supplyPerMin: 3, minutes: 30, faucet: true }),
];
console.log(`\n(sim time ${(Date.now() - t0) / 1000}s)`);
B.economy.testFaucet.enabled = false;
if (process.argv.includes('--json')) { const fs = await import('fs'); fs.writeFileSync(process.argv[process.argv.indexOf('--json') + 1], JSON.stringify(res, null, 1)); }
