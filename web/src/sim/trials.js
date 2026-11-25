// TEST B: boss trials with and without player commands (same seeds, same rules).
import { createCombatLab } from './maps.js';
import { Game } from './game.js';
import { B } from '../data/balance.js';

export function bossTrial(seed, commander) {
  const w = createCombatLab(); const g = new Game(w, { seed });
  g.guild.cmd.scope = 'all';
  const team = ['swordsman', 'swordsman', 'mage', 'archer', 'cleric'].map((job, i) => {
    const p = g.recruit({ job, gold: 0, race: 'human' }, true); p.level = 10;
    p.equip.weapon = { swordsman: 'sword_wood', mage: 'staff_wood', archer: 'bow_wood', cleric: 'mace_wood' }[job]; p.equip.armor = 'armor_leather';
    p.inv.potion_hp = 2; const u = g.units.get(p.id); u.x = 40 + (i % 3) * 0.7; u.y = 19 + (i >> 1) * 0.7; g.refreshUnit(u, true); u.state = 'fight'; u.prevState = 'work';
    return u;
  });
  const q = { type: 'hunt', target: 'golem', count: 1, progress: 0, state: 'taken', party: team.map((x) => x.id), startedAt: 0, goal: w.arena, reward: 0 };
  for (const u of team) u.quest = q;
  const boss = g.spawnMonster('golem', w.arena.x, w.arena.y);
  g.gm = { x: 40, y: 20 };
  let t = 0; const dt = 1 / B.time.simHz; let wasTele = false; let cmdAt = 0;
  while (t < 180 && !boss.dead && team.some((u) => u.state !== 'downed')) {
    if (commander) {
      if (boss.tele && !wasTele) g.command('retreat');
      if (!boss.tele && wasTele) { g.command('charge'); cmdAt = g.time; }
      if (!boss.tele && g.guild.cmd.mode === 'charge' && g.time - cmdAt > 4) g.command('auto');
      wasTele = !!boss.tele;
    }
    g.tick(dt); t += dt;
  }
  return { win: !!boss.dead, t: +t.toFixed(1), downs: g.stats.downs, bossHp: Math.max(0, Math.round(boss.hp)) };
}
export function summarize(a) {
  return { winRate: a.filter((x) => x.win).length / a.length, avgDowns: +(a.reduce((s, x) => s + x.downs, 0) / a.length).toFixed(2), avgTime: +(a.reduce((s, x) => s + x.t, 0) / a.length).toFixed(1) };
}
export function bossTrials(n = 10) {
  const auto = [], cmd = [];
  for (let s = 1; s <= n; s++) { auto.push(bossTrial(100 + s, false)); cmd.push(bossTrial(100 + s, true)); }
  const A = summarize(auto), C = summarize(cmd);
  return `<table><tr><th></th><th>승률</th><th>평균 전투 불능</th><th>평균 시간(초)</th></tr>` +
    `<tr><td>명령 없음 (자율)</td><td>${Math.round(A.winRate * 100)}%</td><td>${A.avgDowns}</td><td>${A.avgTime}</td></tr>` +
    `<tr><td>예고 시 후퇴 → 직후 돌격</td><td>${Math.round(C.winRate * 100)}%</td><td>${C.avgDowns}</td><td>${C.avgTime}</td></tr></table>` +
    `<div>같은 시드 ${n}회씩, Lv10 기본 장비 5인 파티 vs 시험 보스. 명령 스크립트는 사람이 하는 판단을 단순화한 것입니다.</div>`;
}
