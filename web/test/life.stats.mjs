// TEST C — growth & inheritance statistics without time acceleration.
// node web/test/life.stats.mjs [--json out.json]
import { B } from '../src/data/balance.js';
import { mulberry32 } from '../src/sim/world.js';
import { makePerson, rollTalent, inheritTalentWeights, inheritTalent, rollElements, aptCount, statOf, gainXp, chooseJob } from '../src/sim/people.js';
import { Life } from '../src/sim/life.js';

const rnd = mulberry32(7007);
const out = {};
const pct = (a) => a.map((x) => (x * 100).toFixed(1) + '%').join(' / ');
const P = B.people;

// 1) founder talent distribution
{
  const N = 100000, c = [0, 0, 0, 0, 0];
  for (let i = 0; i < N; i++) c[rollTalent(rnd) - 1]++;
  out.founderTalent = c.map((x) => x / N);
  console.log(`[1] founder talent 1~5★ (N=${N}): ${pct(out.founderTalent)}   target ${pct(P.talent.probs)}`);
}
// 2) inheritance weights by parent average
{
  out.inheritTable = {};
  console.log('[2] child talent distribution by parent average a (formula W(s)=P(s)*2.2^((s-3)z), normalised)');
  for (const a of [1, 1.5, 2, 2.56, 3, 3.5, 4, 4.5, 5]) {
    const w = inheritTalentWeights(a); out.inheritTable[a] = w;
    const mean = w.reduce((s, x, i) => s + x * (i + 1), 0);
    console.log(`    a=${a.toFixed(2)}  ${pct(w)}  child mean ${mean.toFixed(2)}`);
  }
}
// 3) multi-generation drift (random mating vs assortative top-half mating)
function generations(mode, gens = 20, size = 2000) {
  let pop = Array.from({ length: size }, () => ({ t: rollTalent(rnd) }));
  const means = [];
  for (let g = 0; g <= gens; g++) {
    const m = pop.reduce((s, p) => s + p.t, 0) / pop.length;
    const five = pop.filter((p) => p.t === 5).length / pop.length;
    means.push([+m.toFixed(3), +(five * 100).toFixed(2)]);
    let parents = pop;
    if (mode === 'top') parents = [...pop].sort((a, b) => b.t - a.t).slice(0, size / 2);
    if (mode === 'sorted') parents = [...pop].sort((a, b) => b.t - a.t);       // like-with-like pairing, everybody breeds
    const next = [];
    for (let i = 0; i < size; i++) {
      let A, Bp;
      if (mode === 'sorted') { const k = Math.floor(rnd() * (size / 2)) * 2; A = parents[k]; Bp = parents[k + 1]; }
      else { A = parents[Math.floor(rnd() * parents.length)]; Bp = parents[Math.floor(rnd() * parents.length)]; }
      next.push({ t: inheritTalent(A.t, Bp.t, rnd) });
    }
    pop = next;
  }
  return means;
}
for (const mode of ['random', 'sorted', 'top']) {
  const m = generations(mode); out[`drift_${mode}`] = m;
  console.log(`[3] drift (${mode.padEnd(6)}) gen0 mean ${m[0][0]} (5★ ${m[0][1]}%) -> gen5 ${m[5][0]} (${m[5][1]}%) -> gen10 ${m[10][0]} (${m[10][1]}%) -> gen20 ${m[20][0]} (${m[20][1]}%)`);
}
// 4) elements: founders + inherited, consistency check
{
  const N = 50000; const cnt = [0, 0, 0, 0, 0, 0, 0]; let bad = 0;
  for (let i = 0; i < N; i++) { const p = { aff: rollElements(rnd) }; cnt[aptCount(p)]++; }
  out.founderApt = cnt.map((x) => x / N);
  console.log(`[4] founder element aptitude count 0..6 (N=${N}): ${pct(out.founderApt)}`);
  console.log(`    target                                         ${pct(P.aptCountProbs)}`);
  const cnt2 = [0, 0, 0, 0, 0, 0, 0]; let parentMatch = 0, childApt = 0;
  for (let i = 0; i < N; i++) {
    const pa = { aff: rollElements(rnd) }, pb = { aff: rollElements(rnd) };
    const c = { aff: rollElements(rnd, [pa, pb]) };
    cnt2[aptCount(c)]++;
    for (const e of P.elements) {
      const apt = c.aff[e] >= 60;
      if ((apt && c.aff[e] < 60) || (!apt && c.aff[e] >= 60)) bad++;
      if (apt) { childApt++; if (pa.aff[e] >= 60 || pb.aff[e] >= 60) parentMatch++; }
    }
  }
  out.childApt = cnt2.map((x) => x / N);
  console.log(`[4] child aptitude count (random parents, N=${N}): ${pct(out.childApt)}  contradictions ${bad}`);
  const base = 1 - Math.pow(1 - 0.12, 2); // rough chance a random parent pair has a given element
  console.log(`    child aptitudes shared with a parent: ${(parentMatch / childApt * 100).toFixed(1)}% (≈${(base * 100).toFixed(0)}% expected without inheritance)`);
  // all-element parents
  const allE = Object.fromEntries(P.elements.map((e) => [e, 90]));
  const cnt3 = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < 20000; i++) cnt3[aptCount({ aff: rollElements(rnd, [{ aff: allE }, { aff: allE }]) })]++;
  console.log(`    children of two 6-element parents: count dist ${pct(cnt3.map((x) => x / 20000))} (count keeps base probabilities; only WHICH elements is inherited)`);
}
// 5) growth: level 1..max, stats by talent
{
  const p = makePerson(rnd, { race: 'human', job: 'mage' });
  for (const t of [1, 3, 5]) {
    const q = JSON.parse(JSON.stringify(p)); q.talent.int = t; q.level = 50; q.edu.int = 15; q.act.int = 20;
    console.log(`[5] mage INT at Lv50 + max edu/action, talent ${t}★: ${statOf(q, 'int').toFixed(1)}  (init ${q.init.int})`);
  }
  let total = 0; for (let l = 1; l < 100; l++) total += P.xpToNext(l);
  console.log(`    total XP to Lv100: ${total}`);
}
// 6) life simulation with races (abstract activity), 120 years, housing cap 400
{
  const life = new Life(rnd);
  const pop = []; pop.byId = new Map();
  for (let i = 0; i < 120; i++) { const p = makePerson(rnd, { age: 18 + Math.floor(rnd() * 20) }); pop.push(p); pop.byId.set(p.id, p); }
  const timeline = [];
  for (let y = 1; y <= 150; y++) {
    life.year1(pop, { housingCap: 400, schoolCap: 60, abstractActivity: true });
    if (y % 25 === 0) {
      const alive = pop.filter((p) => p.alive);
      const act = alive.filter((p) => p.stage === 'adult');
      const byRace = {};
      for (const r of Object.keys(B.races)) {
        const a = act.filter((p) => p.race === r);
        byRace[r] = { n: a.length, lv: a.length ? +(a.reduce((s, p) => s + p.level, 0) / a.length).toFixed(1) : 0 };
      }
      const tmean = alive.reduce((s, p) => s + Object.values(p.talent).reduce((a, b) => a + b, 0) / 6, 0) / alive.length;
      timeline.push({ y, alive: alive.length, adults: act.length, gens: Math.max(...alive.map((p) => p.gen)), talentMean: +tmean.toFixed(2), byRace });
      console.log(`[6] year ${String(y).padStart(3)}: alive ${alive.length}, active ${act.length}, max generation ${Math.max(...alive.map((p) => p.gen))}, talent mean ${tmean.toFixed(2)}, avg Lv by race ${JSON.stringify(byRace)}`);
    }
  }
  out.lifeTimeline = timeline; out.lifeStats = life.stats;
  console.log(`    totals: ${JSON.stringify(life.stats)}`);
  // race comparison at equal elapsed years (career XP) and at retirement
  const dead = pop.filter((p) => !p.alive && p.level > 1);
  const ret = {};
  for (const r of Object.keys(B.races)) { const d = dead.filter((p) => p.race === r); ret[r] = d.length ? +(d.reduce((s, p) => s + p.level, 0) / d.length).toFixed(1) : null; }
  out.levelAtDeathByRace = ret;
  console.log(`    final level at death by race: ${JSON.stringify(ret)}`);
  for (const yrs of [3, 10, 30]) {
    const r = {};
    for (const race of Object.keys(B.races)) {
      const q = makePerson(rnd, { race, job: 'swordsman' });
      for (let y = 0; y < yrs; y++) gainXp(q, 6 * (60 + q.level * 3));
      r[race] = q.level;
    }
    console.log(`    level after ${yrs} active years (same activity): ${JSON.stringify(r)}`);
  }
}
if (process.argv.includes('--json')) { const fs = await import('fs'); fs.writeFileSync(process.argv[process.argv.indexOf('--json') + 1], JSON.stringify(out, null, 1)); }
