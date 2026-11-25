// Headless tests for 007 systems: node web/test/game.test.mjs
import { createMainWorld, createCombatLab, placePath } from '../src/sim/maps.js';
import { World } from '../src/sim/world.js';
import { Game } from '../src/sim/game.js';
import { B } from '../src/data/balance.js';
import { basePrice } from '../src/sim/economy.js';

let fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail++; };
const run = (g, sec, dt = 1 / B.time.simHz) => { for (let t = 0; t < sec; t += dt) g.tick(dt); };
const runW = (w, sec, dt = 1 / B.time.simHz) => { for (let t = 0; t < sec; t += dt) w.tick(dt); };
const flat = (w) => { w.explored.fill(1); };

// ---------- logistics v2 ----------
{
  const w = new World({ w: 40, h: 20, seed: 1 }); flat(w);
  const src = w.placeFacility('chest', 1, 2, 'E', { outputOn: true }); src.stock = { wood: 30 };
  placePath(w, 2, 2, [...Array(6).fill('E'), 'S', 'S', 'E', 'E']);
  const sink = w.placeFacility('chest', 10, 4, 'E');
  runW(w, 60);
  ok(Object.values(sink.stock).reduce((a, b) => a + b, 0) > 10, `basic belt 0.5 t/s delivers through corners (${sink.stock.wood})`);
  let minGap = 9;
  for (const b of w.order) for (let i = 1; i < b.items.length; i++) minGap = Math.min(minGap, b.items[i - 1].p - b.items[i].p);
  // across tile boundaries: distance from last item on a belt to first on the next
  for (const b of w.order) if (b.nextBelt && b.items.length && b.nextBelt.items.length) minGap = Math.min(minGap, b.items[0] ? (1 - b.items[0].p) + b.nextBelt.items[b.nextBelt.items.length - 1].p : 9);
  ok(minGap >= B.logistics.itemGap - 1e-6, `item gap >= 0.8 within and across tiles (min ${minGap.toFixed(3)})`);
  // storage capacity
  const w2 = new World({ w: 20, h: 10, seed: 2 }); flat(w2);
  const s2 = w2.placeFacility('chest', 1, 1, 'E', { outputOn: true }); s2.stock = { stone: 500 };
  placePath(w2, 2, 1, ['E', 'E']); const cap = w2.placeFacility('chest', 4, 1, 'S');
  runW(w2, 200);
  ok((cap.stock.stone || 0) === B.logistics.storageCap, `storage stops at capacity ${B.logistics.storageCap} (${cap.stock.stone})`);
  ok(w2.beltAt(3, 1).items.length > 0, 'full storage -> items queue on belt');
  const before = w2.beltAt(2, 1).items.length + w2.beltAt(3, 1).items.length;
  const r = w2.removeBelt(3, 1);
  ok(r && (r.stone || 0) >= 1 && r.belt_1 === 1, `removing a belt returns the belt and its items (${JSON.stringify(r)})`);
  void before;
  // upgrade in place
  const up = w2.placeBelt(2, 1, 'E', 1);
  ok(up.belt.tier === 1 && up.refund.belt_1 === 1 && up.belt.items.length >= 0, 'belt II placed over belt I upgrades in place and refunds the old belt');
  // splitter / merger / sorter
  const w3 = new World({ w: 30, h: 20, seed: 3 }); flat(w3);
  const a = w3.placeFacility('chest', 1, 5, 'E', { outputOn: true }); a.stock = { iron_ore: 20, coal: 20 };
  placePath(w3, 2, 5, ['E']);
  w3.placeFacility('sorter', 3, 5, 'E', { filter: 'coal' });
  placePath(w3, 4, 5, ['E']); const coal = w3.placeFacility('chest', 5, 5, 'E');
  placePath(w3, 3, 4, ['N']); const other1 = w3.placeFacility('chest', 3, 3, 'E');
  placePath(w3, 3, 6, ['S']); const other2 = w3.placeFacility('chest', 3, 7, 'E');
  runW(w3, 200);
  ok((coal.stock.coal || 0) > 5 && !coal.stock.iron_ore, `sorter: filtered item goes straight (${JSON.stringify(coal.stock)})`);
  ok(((other1.stock.iron_ore || 0) + (other2.stock.iron_ore || 0)) > 5 && (other1.stock.iron_ore || 0) > 0 && (other2.stock.iron_ore || 0) > 0, `sorter: others alternate to both sides (${JSON.stringify(other1.stock)} ${JSON.stringify(other2.stock)})`);
  const w4 = new World({ w: 30, h: 20, seed: 4 }); flat(w4);
  const c1 = w4.placeFacility('chest', 1, 5, 'E', { outputOn: true }); c1.stock = { wood: 50 };
  const c2 = w4.placeFacility('chest', 3, 3, 'S', { outputOn: true }); c2.stock = { stone: 50 };
  placePath(w4, 2, 5, ['E']); placePath(w4, 3, 4, ['S']);
  w4.placeFacility('merger', 3, 5, 'E'); placePath(w4, 4, 5, ['E', 'E']); const out = w4.placeFacility('chest', 6, 5, 'E');
  runW(w4, 120);
  ok((out.stock.wood || 0) > 5 && (out.stock.stone || 0) > 5, `merger takes from both inputs (${JSON.stringify(out.stock)})`);
  const w5 = new World({ w: 30, h: 20, seed: 5 }); flat(w5);
  const c5 = w5.placeFacility('chest', 1, 5, 'E', { outputOn: true }); c5.stock = { wood: 50 };
  placePath(w5, 2, 5, ['E']); w5.placeFacility('splitter', 3, 5, 'E');
  placePath(w5, 4, 5, ['E']); const s1 = w5.placeFacility('chest', 5, 5, 'E');
  placePath(w5, 3, 4, ['N']); const s2b = w5.placeFacility('chest', 3, 3, 'E');
  runW(w5, 120);
  ok((s1.stock.wood || 0) > 3 && (s2b.stock.wood || 0) > 3, `splitter alternates outputs (${s1.stock.wood}/${s2b.stock.wood})`);
}
// ---------- small miner + furnace (4 directions, fuel rules) ----------
{
  for (const rot of ['N', 'E', 'S', 'W']) {
    const w = new World({ w: 30, h: 30, seed: 9 }); flat(w);
    const f = w.placeFacility('furnace', 12, 12, rot);
    const ports = w.portsOf(f);
    const ore = ports.find((p) => p.role === 'ore'), fuel = ports.find((p) => p.role === 'fuel'), outp = ports.find((p) => p.kind === 'out');
    const V = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }; const O = { N: 'S', S: 'N', E: 'W', W: 'E' };
    // ore: miner on deposit two tiles away feeding a belt into the ore port
    const ox = ore.tx + V[ore.edge][0], oy = ore.ty + V[ore.edge][1];
    w.deposit[w.idx(ox + V[ore.edge][0], oy + V[ore.edge][1])] = 1;
    const m = w.placeFacility('small_miner', ox + V[ore.edge][0], oy + V[ore.edge][1], O[ore.edge]);
    w.placeBelt(ox, oy, O[ore.edge]);
    const fx = fuel.tx + V[fuel.edge][0], fy = fuel.ty + V[fuel.edge][1];
    const fc = w.placeFacility('chest', fx + V[fuel.edge][0], fy + V[fuel.edge][1], O[fuel.edge], { outputOn: true }); fc.stock = { coal: 5 };
    w.placeBelt(fx, fy, O[fuel.edge]);
    const ex = outp.tx + V[outp.edge][0], ey = outp.ty + V[outp.edge][1];
    w.placeBelt(ex, ey, outp.edge);
    const sink = w.placeFacility('chest', ex + V[outp.edge][0], ey + V[outp.edge][1], outp.edge);
    runW(w, 200);
    ok(m && fc && sink && (sink.stock.iron_ingot || 0) >= 3, `furnace ${rot}: miner->ore port, coal->fuel port, ingot out (${sink && sink.stock.iron_ingot} ingots, fuel left ${fc && fc.stock.coal}+${f.fuel.length})`);
  }
  // no wasted fuel when output blocked / no ore
  const w = new World({ w: 30, h: 30, seed: 10 }); flat(w);
  const f = w.placeFacility('furnace', 5, 5, 'E'); f.fuel = ['coal', 'coal'];
  runW(w, 60);
  ok(f.fuel.length === 2 && f.charge === 0, 'furnace with fuel but no ore burns nothing');
  f.ore = ['iron_ore', 'iron_ore', 'iron_ore', 'iron_ore']; f.outBuf = ['iron_ingot', 'iron_ingot', 'iron_ingot', 'iron_ingot'];
  runW(w, 60);
  ok(f.fuel.length === 2 && f.ore.length === 4, 'furnace with blocked output burns no fuel and keeps ore');
  ok(B.industry.minerSec === 12 && B.industry.furnaceSec === 20, 'basic miner 12 s / furnace 20 s test values');
}
// ---------- economy ----------
{
  ok(basePrice('sword_iron') > basePrice('iron_ingot') * 3, `crafted base price derived from recipe (iron sword ${basePrice('sword_iron')}, ingot ${basePrice('iron_ingot')})`);
}
// ---------- TEST A loop (scripted player) ----------
{
  const w = createMainWorld(); const g = new Game(w, { seed: 11 });
  w.reveal(18, 38, 60);
  const board = w.placeFacility('quest_board', 20, 42); const shop = w.placeFacility('shop', 24, 42, 'E');
  const ct = w.placeFacility('counter', 12, 42, 'S'); w.placeFacility('lab', 8, 34);
  board.stock.quest = 12;
  shop.stock = { sword_wood: 3, staff_wood: 3, bow_wood: 3, mace_wood: 3, armor_leather: 2 };
  for (let i = 0; i < 4; i++) g.recruit({ job: ['swordsman', 'mage', 'archer', 'cleric'][i] });
  const m0 = g.moneySupply();
  g.addTemplate({ type: 'hunt', target: 'slime', count: 5, party: 2, minGrade: 0, bonus: 0, concurrent: 2 });
  g.addTemplate({ type: 'explore', count: 1, party: 1, concurrent: 1 });
  run(g, 420);
  const advs = [...g.units.values()];
  ok(g.guild.completed >= 2, `adventurers completed quests in the real world (done ${g.guild.completed}, failed ${g.guild.failed}, posted ${g.guild.posted})`);
  ok(g.stats.kills >= 5, `real combat kills (${g.stats.kills})`);
  ok(advs.filter((u) => u.p.equip.weapon).length >= 3, `adventurers bought equipment at the shop (${g.stats.bought} purchases)`);
  ok((g.guild.samples.slime || 0) >= 5, `research samples accumulate permanently (slime ${g.guild.samples.slime})`);
  ok(g.stats.sold > 0 || Object.keys(ct.stock).length > 0, `loot sold to the guild counter (${g.stats.sold} items)`);
  const m1 = g.moneySupply();
  ok(m1 === m0, `money supply conserved without faucet (${m0} -> ${m1}; injected by recruits already counted)`);
  ok(w.exploredCount > 0 && g.guild.codex.size > 2, `exploration + codex (${g.guild.codex.size} entries)`);
  // save / load
  const snap = JSON.stringify(g.serialize());
  const g2 = new Game(createMainWorld(), { seed: 11 }); g2.restore(JSON.parse(snap));
  ok(g2.units.size === g.units.size && g2.world.facilities.size === w.facilities.size && g2.guild.codex.size === g.guild.codex.size, 'save/load keeps units, facilities, codex');
  ok(g2.moneySupply() === g.moneySupply(), `save/load keeps money (escrow refunded) ${g.moneySupply()} -> ${g2.moneySupply()}`);
  run(g2, 120);
  ok(g2.guild.completed >= 1, `loaded game keeps running quests (${g2.guild.completed})`);
}
// ---------- TEST B: boss with/without commands ----------
import { bossTrial } from '../src/sim/trials.js';
{
  const res = { auto: [], cmd: [] };
  for (let s = 1; s <= 30; s++) { res.auto.push(bossTrial(100 + s, false)); res.cmd.push(bossTrial(100 + s, true)); }
  const sum = (a) => ({ winRate: a.filter((x) => x.win).length / a.length, avgDowns: +(a.reduce((s, x) => s + x.downs, 0) / a.length).toFixed(2), avgTime: +(a.reduce((s, x) => s + x.t, 0) / a.length).toFixed(1) });
  const A = sum(res.auto), Cm = sum(res.cmd);
  console.log(`INFO  boss trials x30 — no commands: ${JSON.stringify(A)} | retreat/charge commander: ${JSON.stringify(Cm)}`);
  ok(Cm.avgDowns < A.avgDowns, 'player commands (retreat on telegraph, charge after) reduce downs vs no commands');
}
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
