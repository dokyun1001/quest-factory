// Yearly life simulation for a population (abstract; used by the main game AND the life lab / Node stats).
// birth -> child -> student (education) -> adult (adventurer) -> retired (teacher/researcher) -> natural death.
import { B } from '../data/balance.js';
import { makePerson, chooseJob, gainXp, talentAvg, aptCount } from './people.js';

const P = B.people;
const isAdult = (p) => p.alive && (p.stage === 'adult' || p.stage === 'retired');

export class Life {
  constructor(rnd) { this.rnd = rnd; this.year = 0; this.history = []; this.stats = { births: 0, deaths: 0, marriages: 0, retired: 0, rare: 0 }; }
  log(text, p, kind = 'life') { const e = { year: this.year, text, id: p?.id, kind }; this.history.push(e); if (this.history.length > 3000) this.history.shift(); this.onEvent?.(e, p); }

  // ctx: { housingCap, schoolCap, abstractActivity, teacherBonus }
  year1(pop, ctx) {
    const rnd = this.rnd; this.year++;
    const alive = pop.filter((p) => p.alive);
    // aging, stage changes, death
    for (const p of alive) {
      p.age++;
      const R = B.races[p.race];
      if (p.stage === 'child' && p.age >= 6) p.stage = 'student';
      if (p.stage === 'student' && p.age >= R.adult) {
        p.stage = 'adult'; p.job = chooseJob(p);
        p.history.push(`${this.year}년 성인, 진로 ${B.jobs[p.job].name}`); this.log(`${p.name}이(가) 성인이 되어 ${B.jobs[p.job].name}의 길을 택했습니다.`, p);
      }
      if (p.stage === 'adult' && p.age >= P.retireAge[p.race]) {
        p.stage = 'retired'; this.stats.retired++;
        p.history.push(`${this.year}년 은퇴 (Lv.${p.level})`); this.log(`${p.name}이(가) Lv.${p.level}로 은퇴했습니다. 교사로 활동할 수 있습니다.`, p);
      }
      if (p.age >= p.lifespan) this.die(p, '자연사');
    }
    // education: students up to school capacity; teacher efficiency from retired adults with INT
    const students = alive.filter((p) => p.alive && p.stage === 'student');
    const teachers = alive.filter((p) => p.alive && p.stage === 'retired').length;
    const eff = Math.min(1.6, 0.6 + 0.15 * teachers + (ctx.teacherBonus || 0));     // PROPOSAL
    students.slice(0, ctx.schoolCap ?? 999).forEach((s) => {
      for (const k of P.stats) {
        const focus = s.talent[k] >= 4 ? 1.3 : 1;   // students lean towards their talents (PROPOSAL)
        s.edu[k] = Math.min(P.eduCap, s.edu[k] + P.eduGrowthPerYear * eff * focus * (0.7 + rnd() * 0.6));
      }
    });
    // abstract adventurer activity (life lab only; the real game grows adventurers through real quests)
    if (ctx.abstractActivity) {
      for (const p of alive) if (p.alive && p.stage === 'adult') {
        const quests = 4 + Math.floor(rnd() * 5);           // PROPOSAL: ~ real-game pace (10 min = 1 year)
        p.quests += quests;
        gainXp(p, quests * (60 + p.level * 3));
        for (const k of P.stats) p.act[k] = Math.min(P.actCap, p.act[k] + quests * P.actionGrowthPerQuest * (0.5 + rnd()));
      }
    }
    // abstract parties of 4 (life lab only) -> party bonds; the real game bonds through real party quests
    if (ctx.abstractActivity) {
      const act = alive.filter((p) => p.alive && p.stage === 'adult').sort((a, b) => (a.partyKey ?? (a.partyKey = rnd())) - (b.partyKey ?? (b.partyKey = rnd())));
      for (let i = 0; i < act.length; i += 4) {
        const g = act.slice(i, i + 4);
        for (let x = 0; x < g.length; x++) for (let y = x + 1; y < g.length; y++) bond(g[x], g[y], P.marriage.affinityPerPartyQuest * 2 * (0.5 + rnd()));
      }
      for (const p of act) if (rnd() < 0.15) p.partyKey = rnd();   // some party reshuffling each year
    }
    // bonds (cohabitation)
    const adults = alive.filter((p) => p.alive && p.stage !== 'child' && p.stage !== 'student');
    for (let k = 0; k < adults.length; k++) {
      const a = adults[k];
      for (let t = 0; t < 2; t++) {
        const b = adults[Math.floor(rnd() * adults.length)];
        if (b === a) continue;
        bond(a, b, P.marriage.affinityPerYearCohabit * (0.5 + rnd()));
      }
    }
    // marriage (autonomous; player can only arrange parties/meetings)
    for (const a of adults) {
      if (!a.alive || a.spouse || a.sex !== 'F') continue;
      const cand = Object.entries(a.bonds).filter(([id, v]) => v >= P.marriage.minAffinity).map(([id]) => pop.byId?.get(+id) || pop.find((x) => x.id === +id))
        .filter((b) => b && b.alive && !b.spouse && b.sex === 'M' && b.stage !== 'student');
      if (cand.length && rnd() < P.marriage.yearlyChance) {
        const b = cand[Math.floor(rnd() * cand.length)];
        a.spouse = b.id; b.spouse = a.id; this.stats.marriages++;
        a.history.push(`${this.year}년 ${b.name}와(과) 결혼`); b.history.push(`${this.year}년 ${a.name}와(과) 결혼`);
        this.log(`${a.name}와(과) ${b.name}이(가) 결혼했습니다.`, a);
      }
    }
    // births limited by housing
    let popCount = pop.filter((p) => p.alive).length;
    for (const m of adults) {
      if (popCount >= (ctx.housingCap ?? Infinity)) break;
      if (!m.alive || m.sex !== 'F' || !m.spouse || m.children.length >= P.birth.maxChildren) continue;
      const f = pop.byId?.get(m.spouse) || pop.find((x) => x.id === m.spouse);
      if (!f || !f.alive) continue;
      if (m.age > m.lifespan * P.birth.fertileUntilFrac || f.age > f.lifespan * P.birth.fertileUntilFrac) continue;
      if (rnd() >= P.birth.yearlyChance) continue;
      const race = rnd() < 0.5 ? m.race : f.race;   // PROPOSAL: mixed couples -> one parent's race at random
      const c = makePerson(rnd, { parents: [m, f], race, age: 0, born: this.year });
      c.stage = 'child'; c.job = null;
      m.children.push(c.id); f.children.push(c.id);
      pop.push(c); pop.byId?.set(c.id, c); popCount++; this.stats.births++;
      c.history.push(`${this.year}년 출생 (부모 ${m.name}, ${f.name})`);
      const rare = talentAvg(c) >= 3.8 || aptCount(c) >= 3 || Object.values(c.talent).includes(5);
      if (rare) { this.stats.rare++; c.interest = true; this.log(`희귀 인재 탄생: ${c.name} (재능 평균 ${talentAvg(c).toFixed(1)}, 원소 적성 ${aptCount(c)})`, c, 'rare'); }
      else this.log(`${m.name}와(과) ${f.name}의 아이 ${c.name}이(가) 태어났습니다.`, c);
    }
  }
  die(p, cause) {
    p.alive = false; p.stage = 'dead'; this.stats.deaths++;
    p.history.push(`${this.year}년 ${cause} (향년 ${p.age}세, Lv.${p.level}, 의뢰 ${p.quests}회)`);
    this.log(`${p.name}이(가) ${cause}했습니다. 향년 ${p.age}세. 업적: Lv.${p.level}, 의뢰 ${p.quests}회.`, p, 'death');
  }
}
export function bond(a, b, v) {
  a.bonds[b.id] = Math.min(100, (a.bonds[b.id] || 0) + v);
  b.bonds[a.id] = Math.min(100, (b.bonds[a.id] || 0) + v);
}
export { isAdult };
