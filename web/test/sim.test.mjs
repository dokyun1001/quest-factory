// Headless logistics tests (node web/test/sim.test.mjs). No browser needed.
import { createTestWorld, createMainWorld, buildBeltBench, placePath } from '../src/sim/maps.js';
import { World } from '../src/sim/world.js';
import { SIM_DT } from '../src/core/config.js';
let fail = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail++; };
const run = (w, sec) => { for (let i = 0; i < sec / SIM_DT; i++) w.tick(SIM_DT); };
const storageAt = (w, x, y) => w.facAt(x, y);
const total = (f) => Object.values(f.counts).reduce((a, b) => a + b, 0);

// shapes
{
  const w = new World({ w: 20, h: 20, seed: 1 });
  placePath(w, 2, 2, ['E', 'E', 'S', 'S', 'W', 'W', 'N']);
  const s = (x, y) => { const b = w.beltAt(x, y); return b.in + b.out; };
  ok(s(2, 2) === 'WE' && s(3, 2) === 'WE', 'straight W->E shape');
  ok(s(4, 2) === 'WS', 'corner W->S shape (WS)');
  ok(s(4, 4) === 'NW', 'corner N->W shape (NW)');
  ok(s(2, 4) === 'EN', 'corner E->N shape (EN)');
}
// test layout
const w = createTestWorld();
const shapes = new Set(); for (const b of w.belts) if (b) shapes.add(b.in + b.out);
ok(shapes.size === 12, `test layout uses all 12 belt combos (${[...shapes].sort().join(',')})`);
run(w, 40);
const straight = storageAt(w, 24, 3);
ok(total(straight) >= 15, `long straight 20 delivers (${total(straight)} in 40s)`);
ok(total(storageAt(w, 32, 13)) >= 15, `vertical 10 delivers (${total(storageAt(w, 32, 13))})`);
ok(total(storageAt(w, 34, 3)) >= 15, `vertical S->N delivers (${total(storageAt(w, 34, 3))})`);
const zig = w.facAt(15, 12);
ok(zig && total(zig) > 0, `zigzag east delivers (${zig && total(zig)})`);
// dead end blocks, spacing respected
const dead = w.beltAt(11, 31);
ok(dead.items.length >= 1 && Math.abs(dead.items[0].p - 0.7) < 1e-9, 'dead end: front item waits inside the last belt');
let minGap = 9; for (let x = 4; x <= 11; x++) { const it = w.beltAt(x, 31).items; for (let i = 1; i < it.length; i++) minGap = Math.min(minGap, it[i - 1].p - it[i].p); }
ok(minGap >= 0.6 - 1e-9, `blocked queue keeps spacing (min gap ${minGap.toFixed(3)})`);
// closed storage then open -> recovery
const gate = w.facAt(12, 33);
ok(total(gate) === 0 && w.beltAt(11, 33).items.length > 0, 'closed storage blocks line');
gate.open = true; run(w, 10);
ok(total(gate) > 5, `opened storage recovers flow (${total(gate)})`);
// miner -> smelter -> storage
const ingot = w.facAt(51, 25);
ok(ingot && (ingot.counts.iron_ingot || 0) > 3, `miner->smelter->storage makes iron ingots (${ingot && ingot.counts.iron_ingot})`);
const gold = [...w.facilities.values()].find((f) => f.type === 'storage' && f.counts.gold_ore && f.x > 45);
ok(!!gold, 'gold miner corner path delivers gold ore');
// save round trip
const snap = JSON.stringify(w.serialize());
const w2 = createTestWorld(); w2.clearArea(0, 0, w2.w - 1, w2.h - 1); w2.restore(JSON.parse(snap));
ok(JSON.stringify(w2.serialize()) === snap, 'save -> load -> save is identical');
// main world starts small
const m = createMainWorld();
ok(m.beltCount === 0 && m.facilities.size === 0, 'main game starts without prebuilt factory');
ok(m.clusters.some((c) => !c.discovered), 'main game has undiscovered deposits');
// perf
for (const n of [100, 500, 2000]) {
  const b = createTestWorld(); buildBeltBench(b, n); run(b, 20);
  const t0 = performance.now(); const steps = 600; for (let i = 0; i < steps; i++) b.tick(SIM_DT);
  const ms = (performance.now() - t0) / steps;
  console.log(`INFO  bench ${n} extra belts (total ${b.beltCount}, items ${b.countItems()}): ${ms.toFixed(4)} ms per sim step`);
}
console.log(fail ? `\n${fail} FAILED` : '\nALL PASS');
process.exit(fail ? 1 : 0);
