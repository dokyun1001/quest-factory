// People model: generation, talents, elements, growth, inheritance. Pure functions (Node-testable).
// Formulas follow directive 007 §12, §13, §18. Items marked PROPOSAL are developer suggestions.
import { B } from '../data/balance.js';
import { randomAppearance } from '../data/appearance.js';

const P = B.people;
const STATS = P.stats;
const ELEMS = P.elements;
const NAMES_M = ['도윤', '카이', '렌', '토마', '하람', '루크', '이안', '단', '테오', '바론', '시온', '레오', '한결', '로이', '에반'];
const NAMES_F = ['아린', '세라', '루미', '유나', '벨라', '리아', '하나', '미라', '소라', '엘라', '노아', '다인', '이브', '라나', '시아'];

export const pickW = (weights, rnd) => {
  let s = 0; for (const w of weights) s += w;
  let r = rnd() * s;
  for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r < 0) return i; }
  return weights.length - 1;
};
const randInt = (a, b, rnd) => a + Math.floor(rnd() * (b - a + 1));
const gauss = (rnd) => { let u = 0, v = 0; while (!u) u = rnd(); while (!v) v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

// ---------- talents ----------
export function rollTalent(rnd) { return pickW(P.talent.probs, rnd) + 1; }   // 1..5 stars
// W(s) = P(s) * 2.2^((s-3) * z), z from parent average a
export function inheritTalentWeights(a) {
  const k = P.inherit;
  const z = a >= k.pivot ? (a - k.pivot) / k.upSpan : (a - k.pivot) / k.downSpan;
  const w = P.talent.probs.map((p, i) => p * Math.pow(k.talentBase, ((i + 1) - 3) * z));
  const s = w.reduce((x, y) => x + y, 0);
  return w.map((x) => x / s);
}
export function inheritTalent(ta, tb, rnd) { return pickW(inheritTalentWeights((ta + tb) / 2), rnd) + 1; }
export const talentMult = (t) => P.talent.mult[t - 1];

// ---------- elements ----------
export function rollElements(rnd, parents = null) {
  const count = pickW(P.aptCountProbs, rnd);
  const weights = ELEMS.map((e) => {
    let w = 1;
    if (parents) {
      const n = parents.filter((p) => p.aff[e] >= P.aptitudeThreshold).length;
      if (n === 1) w += P.inherit.elemOneParent; else if (n === 2) w += P.inherit.elemBothParents;
    }
    return w;
  });
  const chosen = new Set();
  while (chosen.size < count) {           // draw without replacement
    const i = pickW(weights.map((w, k) => (chosen.has(ELEMS[k]) ? 0 : w)), rnd);
    chosen.add(ELEMS[i]);
  }
  const aff = {};
  for (const e of ELEMS) {
    const apt = chosen.has(e);
    // random part: apt -> [60,100], not apt -> [0,59]
    const r = apt ? randInt(P.aptitudeThreshold, 100, rnd) : randInt(0, P.aptitudeThreshold - 1, rnd);
    let v = r;
    if (parents) {
      // parent part: average affinity of parents that HAVE aptitude for e (directive), PROPOSAL when none:
      // use nothing (100% random). Value is clamped so aptitude and affinity never contradict.
      const ap = parents.filter((p) => p.aff[e] >= P.aptitudeThreshold);
      if (ap.length) {
        const pv = ap.reduce((s, p) => s + p.aff[e], 0) / ap.length;
        v = Math.round(P.inherit.affRandom * r + P.inherit.affParent * pv);
      }
    }
    v = apt ? Math.max(P.aptitudeThreshold, Math.min(100, v)) : Math.min(P.aptitudeThreshold - 1, Math.max(0, v));
    aff[e] = v;
  }
  return aff;
}
export const aptCount = (p) => ELEMS.filter((e) => p.aff[e] >= P.aptitudeThreshold).length;

// ---------- people ----------
let nextId = 1;
export function setNextPersonId(n) { nextId = Math.max(nextId, n); }
export function makePerson(rnd, opt = {}) {
  const sex = opt.sex || (rnd() < 0.5 ? 'M' : 'F');
  const race = opt.race || Object.keys(B.races)[pickW(Object.values(B.races).map((r) => r.weight), rnd)];
  const R = B.races[race];
  const parents = opt.parents || null;
  const talent = {}; const init = {};
  for (const s of STATS) {
    talent[s] = opt.talent?.[s] ?? (parents ? inheritTalent(parents[0].talent[s], parents[1].talent[s], rnd) : rollTalent(rnd));
    init[s] = randInt(P.adultStatRange[0], P.adultStatRange[1], rnd);
  }
  const aff = opt.aff || rollElements(rnd, parents);
  const lifespan = Math.max(R.adult + 5, Math.round(R.life * (1 + gauss(rnd) * P.lifespanSd)));
  const app = opt.appearance || (parents ? inheritAppearance(parents, rnd) : randomAppearance(rnd));
  const p = {
    id: nextId++, name: (sex === 'M' ? NAMES_M : NAMES_F)[Math.floor(rnd() * 15)], sex, race,
    age: opt.age ?? R.adult + Math.floor(rnd() * 8), lifespan, stage: 'adult',
    job: opt.job || null, level: 1, xp: 0, grade: 0,
    talent, init, edu: zero(), act: zero(), aff, mastery: zero(ELEMS), weapon: 0,
    gold: opt.gold ?? 0, inv: {}, equip: { weapon: null, armor: null },
    traits: opt.traits || rollTraits(rnd), dream: null, personality: ['차분함', '대담함', '호기심', '성실함', '느긋함'][Math.floor(rnd() * 5)],
    parents: parents ? parents.map((x) => x.id) : [], spouse: null, children: [], bonds: {},
    hp: 1, mp: 1, fatigue: 0, injury: 0, quests: 0, kills: 0, history: [], gen: parents ? Math.max(parents[0].gen, parents[1].gen) + 1 : 0,
    appearance: app, alive: true, born: opt.born ?? 0, interest: false,
  };
  if (p.age < R.adult) p.stage = p.age < 6 ? 'child' : 'student';
  if (!p.job && p.stage === 'adult') p.job = chooseJob(p);
  return p;
}
const zero = (keys = STATS) => Object.fromEntries(keys.map((k) => [k, 0]));
function rollTraits(rnd) {
  const pool = ['탐험 재능', '보물 감각', '은밀함', '위험 감지', '표본 수집가', '강인함', '행운아'];
  const t = []; for (const x of pool) if (rnd() < 0.06) t.push(x); return t;
}
function inheritAppearance(parents, rnd) {
  const a = randomAppearance(rnd); const src = parents[Math.floor(rnd() * 2)].appearance;
  if (src) { a.skinId = rnd() < 0.8 ? src.skinId : a.skinId; a.hairPaletteId = rnd() < 0.7 ? parents[Math.floor(rnd() * 2)].appearance.hairPaletteId : a.hairPaletteId; }
  return a;
}
// stat = init + (level + edu + action growth) * talent multiplier   (equipment/buffs applied separately)
export function statOf(p, s) {
  const job = B.jobs[p.job];
  const lvGrowth = job ? job.growth[STATS.indexOf(s)] * (p.level - 1) : 0;
  return p.init[s] + (lvGrowth + Math.min(P.eduCap, p.edu[s]) + Math.min(P.actCap, p.act[s])) * talentMult(p.talent[s]);
}
export function stats(p) { return Object.fromEntries(STATS.map((s) => [s, statOf(p, s)])); }
// PROPOSAL job choice: highest weighted stat fit; mage needs at least one element aptitude
export function chooseJob(p) {
  const st = stats(p);
  const score = {
    swordsman: st.str * 1.2 + st.vit, archer: st.agi * 1.2 + st.sen,
    mage: aptCount(p) ? st.int * 1.3 + st.sen * 0.5 + aptCount(p) * 4 : -1, cleric: st.int + st.vit * 0.7,
  };
  return Object.keys(score).sort((a, b) => score[b] - score[a])[0];
}
export function gainXp(p, xp) {
  p.xp += xp * B.races[p.race].xp;
  let leveled = false;
  while (p.level < P.maxLevel && p.xp >= P.xpToNext(p.level)) { p.xp -= P.xpToNext(p.level); p.level++; leveled = true; }
  if (leveled) {
    const g = P.gradeByLevel.filter((l) => p.level >= l).length - 1;
    if (g > p.grade) { p.grade = g; p.history.push(`${P.grades[g]}등급 승급`); }
  }
  return leveled;
}
export const gradeName = (g) => P.grades[g];
export const talentStars = (t) => '★'.repeat(t);
export const talentAvg = (p) => STATS.reduce((s, k) => s + p.talent[k], 0) / STATS.length;
