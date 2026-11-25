// Game orchestrator (pure JS): world logistics + people + adventurer agents + monsters + guild systems.
// Every agent is simulated with the SAME rules whether or not it is on screen (no view-dependent outcomes).
import { B } from '../data/balance.js';
import { ITEMS } from '../data/items.js';
import { FACILITIES } from '../data/facilities.js';
import { MONSTERS } from '../data/monsters.js';
import { TECH } from '../data/tech.js';
import { CODEX, COMMAND_SKILLS } from '../data/codex.js';
import { Emitter, mulberry32, NODES } from './world.js';
import { PathFinder } from './path.js';
import { makePerson, stats, gainXp, setNextPersonId, gradeName, pickW } from './people.js';
import { Life, bond } from './life.js';
import { Market, Ledger, basePrice } from './economy.js';

const C = B.combat;
const dist2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
const add = (m, k, n = 1) => { m[k] = (m[k] || 0) + n; };

export class Game {
  constructor(world, { seed = 1, kind = 'main' } = {}) {
    this.world = world; this.kind = kind; this.rnd = mulberry32(seed);
    this.events = new Emitter();
    this.pf = new PathFinder(world);
    this.people = []; this.people.byId = new Map();
    this.units = new Map(); this.monsters = []; this.nextMonsterId = 1;
    this.life = new Life(this.rnd); this.life.onEvent = (e, p) => this.onLifeEvent(e, p);
    this.market = new Market(); this.ledger = new Ledger(B.economy.startGuildGold);
    this.guild = { quests: [], templates: [], nextQuestId: 1, samples: {}, tech: new Set(), codex: new Set(),
      cmd: { mode: 'auto', x: 0, y: 0, target: null }, skillCd: {}, buffs: {}, escrow: 0, stalls: 0, posted: 0, completed: 0, failed: 0 };
    this.time = 0; this.yearT = 0; this.timeScale = 1; this.pathBudget = 40;
    this.gm = { x: 0, y: 0 };            // guild master position (tiles) for command range
    this.stats = { kills: 0, downs: 0, rescues: 0, revives: 0, bought: 0, sold: 0 };
    this.fx = [];                         // transient visual events for the renderer
    this.dev = { deathOnDown: false };
    this.pathQueue = [];
    world.events.on('discover', (kind, obj) => this.onDiscover(kind, obj));
    for (const h of world.habitats) h.alive = 0, h.respawnT = 0;
  }

  // ---------------- helpers ----------------
  facsOf(kind) { const r = []; for (const f of this.world.facilities.values()) if (FACILITIES[f.type].kind === kind) r.push(f); return r; }
  hall() { return this.world.landmarks.find((l) => l.kind === 'guild'); }
  hallPoint() { const h = this.hall(); return { x: h.x + h.w / 2, y: h.y + h.h + 0.6 }; }
  facPoint(f) { const d = FACILITIES[f.type]; return { x: f.x + d.footprint[0] / 2, y: f.y + d.footprint[1] + 0.6 }; }
  housingCap() { return B.housing.guildHall + this.facsOf('dorm').length * B.housing.dormCap; }
  schoolCap() { return this.facsOf('school').length * B.housing.schoolCap; }
  toast(msg, kind = 'info') { this.events.emit('toast', msg, kind); }
  codexAdd(id) {
    if (!CODEX[id] || this.guild.codex.has(id)) return;
    this.guild.codex.add(id); this.events.emit('codex', id); this.toast(`도감 등록: ${CODEX[id][1]}`, 'codex');
    for (const [k, s] of Object.entries(COMMAND_SKILLS)) if (this.skillUnlocked(k) && !this.guild['sk_' + k]) { this.guild['sk_' + k] = 1; this.toast(`도감 보상: 지휘 스킬 '${s.name}' 해금`, 'codex'); }
  }
  codexCount(cat) { let n = 0; for (const id of this.guild.codex) if (CODEX[id][0] === cat) n++; return n; }
  skillUnlocked(k) { return Object.entries(COMMAND_SKILLS[k].need).every(([cat, n]) => this.codexCount(cat) >= n); }
  techUnlocked(id) { return !id || this.guild.tech.has(id); }
  canResearch(id) {
    const t = TECH[id]; if (!t || this.guild.tech.has(id)) return { ok: false };
    if (!this.facsOf('lab').length) return { ok: false, why: '연구소 필요' };
    const r = t.req; const miss = [];
    for (const p of r.prereq || []) if (!this.guild.tech.has(p)) miss.push(`선행: ${TECH[p].name}`);
    for (const [m, n] of Object.entries(r.samples || {})) if ((this.guild.samples[m] || 0) < n) miss.push(`${MONSTERS[m].name} 표본 ${this.guild.samples[m] || 0}/${n}`);
    for (const [k, n] of Object.entries(r.milestones || {})) { const v = this.milestone(k); if (v < n) miss.push(`${milestoneName(k)} ${v}/${n}`); }
    return { ok: !miss.length, miss };
  }
  milestone(k) {
    if (k === 'adventurers') return this.units.size;
    if (k === 'used_bought') return this.guild.usedBought || 0;
    return this.world.made[k] || 0;
  }
  research(id) { const c = this.canResearch(id); if (!c.ok) return c; this.guild.tech.add(id); this.toast(`연구 완료: ${TECH[id].name}`, 'tech'); this.events.emit('tech', id); return c; }

  // ---------------- people / adventurers ----------------
  addPerson(p) { this.people.push(p); this.people.byId.set(p.id, p); return p; }
  recruit(opt = {}, free = false) {
    if (!free && !this.ledger.pay('guild', null, B.economy.recruitCost, 'recruit')) { this.toast('길드 자금이 부족합니다.'); return null; }
    const r = B.population.recruitAdultAge;            // human range; other races offset by their adult age
    const race = opt.race || Object.keys(B.races)[pickW(Object.values(B.races).map((x) => x.weight), this.rnd)];
    const age = B.races[race].adult + Math.floor(this.rnd() * (r[1] - r[0]));
    const p = makePerson(this.rnd, { age, gold: 0, ...opt, race });
    // new recruits bring their own savings: this is EXTERNAL money entering the economy (tracked)
    const g = opt.gold ?? B.economy.startAdventurerGold[0] + Math.floor(this.rnd() * (B.economy.startAdventurerGold[1] - B.economy.startAdventurerGold[0]));
    p.gold = g; this.ledger.injected += g;
    if (opt.job) p.job = opt.job;
    this.addPerson(p);
    p.history.push(`${this.life.year}년 길드 가입 (${B.jobs[p.job].name})`);
    this.spawnUnit(p);
    return p;
  }
  spawnUnit(p, at) {
    const hp = at || this.hallPoint();
    const u = { id: p.id, p, x: hp.x + (this.rnd() - 0.5) * 2, y: hp.y + this.rnd() * 1.5, kind: 'adv', state: 'idle', stateT: 0,
      hp: 0, mp: 0, maxHp: 1, maxMp: 1, cd: 0, path: null, pathI: 0, goal: null, target: null, quest: null, downT: 0,
      facing: 'S', moving: false, wait: 0, buff: {}, injuredT: 0, castT: 0 };
    this.refreshUnit(u, true);
    this.units.set(p.id, u); this.events.emit('unit', u, 'add');
    return u;
  }
  removeUnit(u) {
    if (u.quest) this.leaveQuest(u, false);
    this.units.delete(u.id); this.events.emit('unit', u, 'remove');
  }
  refreshUnit(u, full) {
    const p = u.p; const st = stats(p); const job = B.jobs[p.job];
    const armor = p.equip.armor ? ITEMS[p.equip.armor].def : 0;
    u.st = st; u.def = armor + st.vit * 0.15;
    u.atkPow = (p.equip.weapon ? ITEMS[p.equip.weapon].atk : 1);
    const injured = u.injuredT > 0 ? 0.6 : 1;
    u.maxHp = Math.round((job.hp + st.vit * 4) * injured); u.maxMp = Math.round(job.mp + st.int * 2);
    if (full) { u.hp = u.maxHp; u.mp = u.maxMp; }
    u.hp = Math.min(u.hp, u.maxHp); u.mp = Math.min(u.mp, u.maxMp);
  }

  // ---------------- quests ----------------
  questCost(t) { const k = t.type === 'hunt' ? Math.ceil(t.count / B.quests.paperPerKills) : t.type === 'gather' ? Math.ceil(t.count / 10) : 1; return k; }
  questReward(t) {
    const Q = B.quests;
    const base = t.type === 'hunt' ? Q.rewardPerKill * t.count * (MONSTERS[t.target]?.boss ? 20 : 1) : t.type === 'survey' ? Q.rewardPerSurvey : t.type === 'gather' ? Q.rewardPerGather * t.count : Q.rewardPerExplore;
    return Math.round(base + (t.bonus || 0));
  }
  addTemplate(t) { t.id = this.guild.nextQuestId++; t.active = 0; t.enabled = true; t.concurrent ??= 1; this.guild.templates.push(t); return t; }
  tickBoard(dt) {
    this.boardT = (this.boardT || 0) - dt; if (this.boardT > 0) return; this.boardT = 2;
    const board = this.facsOf('board')[0]; if (!board) return;
    if (this.devBoardRefill) board.stock.quest = Math.max(board.stock.quest || 0, 30);   // TEST E only
    for (const t of this.guild.templates) {
      if (!t.enabled || t.active >= t.concurrent) continue;
      const cost = this.questCost(t); const reward = this.questReward(t);
      const target = this.resolveTarget(t);
      if (!target) { t.status = t.type === 'explore' ? '탐험할 곳 없음' : '대상 미발견'; continue; }
      if ((board.stock.quest || 0) < cost) { t.status = `빈 의뢰서 부족 (${board.stock.quest || 0}/${cost})`; continue; }
      if (this.ledger.guild < reward) { t.status = '길드 자금 부족 (보상 예치 불가)'; this.guild.stalls++; continue; }
      board.stock.quest -= cost; if (!board.stock.quest) delete board.stock.quest;
      this.ledger.guild -= reward; this.guild.escrow += reward;
      const q = { id: this.guild.nextQuestId++, tmpl: t.id, type: t.type, target: t.target, count: t.count, minGrade: t.minGrade || 0,
        size: t.party || 1, reward, party: [], progress: 0, state: 'open', goal: target, postedAt: this.time, kills: {} };
      this.guild.quests.push(q); t.active++; t.status = '게시됨'; this.guild.posted++;
      this.events.emit('quest', q, 'post');
    }
  }
  resolveTarget(t) {
    const W = this.world;
    if (t.type === 'hunt' || t.type === 'survey') {
      const hs = W.habitats.filter((h) => h.type === t.target && h.found);
      if (!hs.length) return null;
      const g = this.hallPoint(); hs.sort((a, b) => dist2(a, g) - dist2(b, g));
      return { x: hs[0].x + 0.5, y: hs[0].y + 0.5, habitat: W.habitats.indexOf(hs[0]) };
    }
    if (t.type === 'gather') {
      const code = Object.entries(NODES).find(([, v]) => v === t.target)?.[0];
      if (!code) return null;
      const g = this.hallPoint(); let best = null, bd = Infinity;
      for (let i = 0; i < W.node.length; i++) if (W.node[i] === +code && W.explored[i]) {
        const x = i % W.w, y = (i / W.w) | 0; const d = (x - g.x) ** 2 + (y - g.y) ** 2; if (d < bd) { bd = d; best = { x, y }; }
      }
      return best ? { x: best.x + 0.5, y: best.y + 0.5, code: +code } : null;
    }
    if (t.type === 'explore') {
      // nearest unexplored walkable tile that touches explored land, picked with some randomness
      const g = this.hallPoint(); const cands = [];
      for (let y = 1; y < W.h - 1; y += 2) for (let x = 1; x < W.w - 1; x += 2) {
        const i = W.idx(x, y); if (W.explored[i] || W.solidAt(x, y)) continue;
        if (W.explored[i - 1] || W.explored[i + 1] || W.explored[i - W.w] || W.explored[i + W.w]) cands.push({ x: x + 0.5, y: y + 0.5, d: (x - g.x) ** 2 + (y - g.y) ** 2 });
      }
      if (!cands.length) return null;
      cands.sort((a, b) => a.d - b.d);
      const pick = cands[Math.floor(this.rnd() * Math.min(12, cands.length))];
      // walk a bit beyond the frontier
      const ang = Math.atan2(pick.y - g.y, pick.x - g.x);
      return { x: Math.max(1, Math.min(W.w - 2, pick.x + Math.cos(ang) * 6)), y: Math.max(1, Math.min(W.h - 2, pick.y + Math.sin(ang) * 6)) };
    }
    return null;
  }
  finishQuest(q, ok) {
    q.state = ok ? 'done' : 'failed';
    const t = this.guild.templates.find((x) => x.id === q.tmpl); if (t) t.active = Math.max(0, t.active - 1);
    const members = q.party.map((id) => this.units.get(id)).filter(Boolean);
    if (ok) {
      const share = Math.floor(q.reward / Math.max(1, members.length));
      for (const u of members) { u.p.gold += share; u.p.quests++; u.p.history.push(`${this.life.year}년 의뢰 완료: ${questLabel(q)}`); this.actionGrowth(u.p); }
      const spent = share * members.length; this.guild.escrow -= q.reward; this.ledger.guild += q.reward - spent; this.ledger.flows.quest += spent;
      this.guild.completed++;
      for (let i = 0; i < members.length; i++) for (let j = i + 1; j < members.length; j++) bond(members[i].p, members[j].p, B.people.marriage.affinityPerPartyQuest);
    } else {
      this.guild.escrow -= q.reward; this.ledger.guild += q.reward; this.guild.failed++;   // escrow returned
    }
    for (const u of members) { u.quest = null; }
    this.guild.quests = this.guild.quests.filter((x) => x !== q);
    this.events.emit('quest', q, ok ? 'done' : 'fail');
  }
  leaveQuest(u, failIfEmpty = true) {
    const q = u.quest; if (!q) return;
    q.party = q.party.filter((id) => id !== u.id); u.quest = null;
    if (failIfEmpty && q.state === 'taken' && !q.party.length) this.finishQuest(q, false);
    if (q.state === 'open' && !q.party.length) q.ready = false;
  }
  actionGrowth(p) {
    const job = B.jobs[p.job]; const g = B.people.actionGrowthPerQuest;
    B.people.stats.forEach((s, i) => { p.act[s] = Math.min(B.people.actCap, p.act[s] + g * job.growth[i]); });
  }

  // ---------------- monsters ----------------
  spawnMonster(type, x, y, habitat = null) {
    const d = MONSTERS[type];
    const m = { id: this.nextMonsterId++, kind: 'mon', type, x, y, hp: d.hp, maxHp: d.hp, cd: this.rnd() * d.cd, habitat, home: { x, y },
      target: null, wanderT: 0, gx: x, gy: y, tele: null, patT: d.patterns ? d.patterns.map((p) => p.every * 0.6) : null, facing: 'S' };
    this.monsters.push(m); this.events.emit('monster', m, 'add');
    if (habitat) habitat.alive++;
    return m;
  }
  killMonster(m, killer) {
    const d = MONSTERS[m.type];
    m.dead = true; this.events.emit('monster', m, 'remove'); this.stats.kills++;
    if (m.habitat) { m.habitat.alive--; m.habitat.respawnT = Math.max(m.habitat.respawnT, B.world.habitatRespawnSec / m.habitat.max); }
    add(this.guild.samples, m.type);                         // permanent research samples
    this.codexAdd(m.type);
    if (B.economy.testFaucet.enabled) this.ledger.inject(B.economy.testFaucet.goldPerKill);
    // xp & loot shared by nearby party members
    const near = [...this.units.values()].filter((u) => u.state !== 'downed' && dist2(u, m) < 64 && (killer && (u === killer || (u.quest && u.quest === killer.quest))));
    if (!near.length && killer) near.push(killer);
    for (const u of near) {
      if (gainXp(u.p, d.xp / near.length)) { this.refreshUnit(u); this.fxPush('lvl', u.x, u.y, `Lv.${u.p.level}`); }
      u.p.kills++;
      if (u.quest && u.quest.type === 'hunt' && u.quest.target === m.type) u.quest.progress = Math.min(u.quest.count, u.quest.progress + 1 / near.length);
    }
    const looter = killer || near[0];
    if (looter) for (const [it, ch, n] of d.loot) if (this.rnd() < ch) { add(looter.p.inv, it, n); this.codexAdd(it); }
    if (d.boss) this.toast(`${d.name} 토벌!`, 'boss');
  }
  tickHabitats(dt) {
    // habitats refill gradually after kills (no permanent extinction)
    for (const h of this.world.habitats) {
      if (h.alive >= h.max) { h.filled = true; continue; }
      h.respawnT -= dt;
      if (!h.filled || h.respawnT <= 0) {
        for (let tries = 0; tries < 6; tries++) {
          const a = this.rnd() * Math.PI * 2, r = this.rnd() * h.r;
          const x = h.x + 0.5 + Math.cos(a) * r, y = h.y + 0.5 + Math.sin(a) * r;
          if (!this.world.solidAt(x | 0, y | 0)) { this.spawnMonster(h.type, x, y, h); break; }
        }
        h.respawnT = B.world.habitatRespawnSec / h.max;
      }
    }
  }

  // ---------------- movement ----------------
  requestPath(e, tx, ty) {
    e.goal = { x: tx, y: ty }; e.path = null; e.pathI = 0; e.pathPending = true;
    this.pathQueue.push(e);
  }
  processPaths() {
    let n = 0;
    while (this.pathQueue.length && n < this.pathBudget) {
      const e = this.pathQueue.shift(); if (!e.pathPending || e.dead) continue;
      e.pathPending = false; n++;
      const p = this.pf.find(e.x, e.y, e.goal.x, e.goal.y);
      e.path = p || [[e.goal.x, e.goal.y]]; e.pathI = 0; e.pathFail = !p;
    }
  }
  // returns true when arrived
  follow(e, speed, dt) {
    if (!e.goal) return true;
    if (e.pathPending) return false;
    if (!e.path) { this.requestPath(e, e.goal.x, e.goal.y); return false; }
    let budget = speed * dt;
    while (budget > 0 && e.pathI < e.path.length) {
      const [tx, ty] = e.path[e.pathI];
      const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
      if (d <= budget) { e.x = tx; e.y = ty; budget -= d; e.pathI++; }
      else { e.x += dx / d * budget; e.y += dy / d * budget; budget = 0; setFacing(e, dx, dy); }
    }
    e.moving = true;
    if (e.pathI >= e.path.length) { e.goal = null; e.path = null; e.moving = false; return true; }
    return false;
  }
  stepToward(e, tx, ty, speed, dt) {
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy); if (d < 0.01) return;
    const s = Math.min(d, speed * dt); const nx = e.x + dx / d * s, ny = e.y + dy / d * s;
    if (!this.world.solidAt(nx | 0, e.y | 0)) e.x = nx;
    if (!this.world.solidAt(e.x | 0, ny | 0)) e.y = ny;
    e.moving = true; setFacing(e, dx, dy);
  }
  goTo(u, x, y) { if (!u.goal || Math.abs(u.goal.x - x) > 0.6 || Math.abs(u.goal.y - y) > 0.6) this.requestPath(u, x, y); }

  // ---------------- combat ----------------
  buildBuckets() {
    const cs = 8; const b = new Map();
    const put = (e) => { const k = ((e.x / cs) | 0) * 4096 + ((e.y / cs) | 0); let l = b.get(k); if (!l) b.set(k, (l = [])); l.push(e); };
    for (const m of this.monsters) if (!m.dead) put(m);
    for (const u of this.units.values()) put(u);
    this.buckets = b; this.cs = cs;
  }
  nearby(e, r, filter) {
    const cs = this.cs, r2 = r * r, out = [];
    const x0 = ((e.x - r) / cs) | 0, x1 = ((e.x + r) / cs) | 0, y0 = ((e.y - r) / cs) | 0, y1 = ((e.y + r) / cs) | 0;
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
      const l = this.buckets.get(cx * 4096 + cy); if (!l) continue;
      for (const o of l) if (o !== e && filter(o) && dist2(o, e) <= r2) out.push(o);
    }
    return out;
  }
  nearestEnemy(u, r) {
    const l = this.nearby(u, r, (o) => o.kind === 'mon' && !o.dead);
    let best = null, bd = Infinity; for (const m of l) { const d = dist2(m, u); if (d < bd) { bd = d; best = m; } }
    return best;
  }
  commandFor(u) {
    const c = this.guild.cmd;
    if (c.mode === 'auto') return 'auto';
    if (c.scope === 'all' || dist2(u, this.gm) <= 14 * 14) return c.mode;
    return 'auto';
  }
  dmgTo(target, raw, elem) {
    if (target.kind === 'mon') {
      const d = MONSTERS[target.type];
      const mult = elem ? (d.weak?.[elem] || d.resist?.[elem] || 1) : 1;
      const v = Math.max(1, raw * mult - d.def);
      target.hp -= v; return v;
    }
    let v = Math.max(1, raw - target.def * 0.5);
    if (target.buff.guardT > 0) v *= COMMAND_SKILLS.guard.effect.dmgTaken;
    if (target.cmdNow === 'defend') v *= 0.6;
    target.hp -= v; target.lastHitT = this.time;
    if (target.hp <= 0) this.downUnit(target);
    return v;
  }
  downUnit(u) {
    if (u.state === 'downed') return;
    u.hp = 0; u.state = 'downed'; u.downT = B.people.downedRescueSec; u.moving = false; u.path = null; u.goal = null;
    this.stats.downs++; this.fxPush('down', u.x, u.y);
    u.p.history.push(`${this.life.year}년 전투 불능`);
  }
  unitAttack(u, target, dt) {
    const job = B.jobs[u.p.job]; const st = u.st; const cmd = u.cmdNow;
    const atkMul = (cmd === 'charge' ? 1.25 : 1) * (cmd === 'defend' ? 0.6 : 1) * (u.buff.powerT > 0 ? COMMAND_SKILLS.rally_power.effect.atk : 1);
    if (job.role === 'heal') {
      const allies = this.nearby(u, job.range, (o) => o.kind === 'adv' && o.state !== 'downed' && o.hp < o.maxHp * 0.6);
      allies.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
      if (allies.length && u.mp >= C.healMpCost) {
        const a = allies[0]; const amt = a.maxHp * C.healAmount * (1 + st.int / 100);
        a.hp = Math.min(a.maxHp, a.hp + amt); u.mp -= C.healMpCost; u.cd = job.cd; this.fxPush('heal', a.x, a.y);
        add(u.p.mastery, 'water', 0.02); return;
      }
    }
    const d = Math.sqrt(dist2(u, target));
    if (d > job.range + 0.2) return false;
    let raw; let elem = null;
    if (job.role === 'melee') raw = st.str * 0.8 + u.atkPow * 1.5;
    else if (job.role === 'ranged') raw = st.agi * 0.6 + st.sen * 0.3 + u.atkPow * 1.4;
    else if (job.role === 'aoe') {
      const aff = u.p.aff; elem = Object.keys(aff).sort((a, b) => aff[b] - aff[a])[0];
      if (aff[elem] < B.people.aptitudeThreshold) elem = null;
      if (u.mp >= C.mageMpCost) {
        u.mp -= C.mageMpCost;
        raw = (st.int * 0.9 + u.atkPow * 1.5) * (1 + (elem ? (u.p.mastery[elem] || 0) / 100 : 0));
        if (elem) u.p.mastery[elem] = Math.min(100, (u.p.mastery[elem] || 0) + 0.05);
        for (const m of this.nearby(target, C.mageAoeRadius, (o) => o.kind === 'mon' && !o.dead && o !== target)) { this.dmgTo(m, raw * 0.6 * atkMul, elem); if (m.hp <= 0 && !m.dead) this.killMonster(m, u); }
        this.fxPush('aoe', target.x, target.y, elem);
      } else raw = st.int * 0.3 + u.atkPow;
    } else raw = st.str * 0.5 + st.int * 0.3 + u.atkPow;
    raw *= atkMul * (0.9 + this.rnd() * 0.2);
    if (this.rnd() < 0.03 + st.luk * 0.004) raw *= 1.6;
    this.dmgTo(target, raw, elem);
    this.fxPush(job.role === 'melee' ? 'slash' : job.role === 'aoe' ? 'bolt' : 'arrow', target.x, target.y, null, u);
    u.cd = job.cd;
    if (target.hp <= 0 && !target.dead) this.killMonster(target, u);
    return true;
  }
  fxPush(type, x, y, extra, from) { if (this.fx.length < 400) this.fx.push({ type, x, y, extra, fx: from?.x, fy: from?.y }); }

  // ---------------- adventurer AI ----------------
  tickUnit(u, dt) {
    const p = u.p; const job = B.jobs[p.job];
    u.moving = false; u.cd -= dt; u.stateT += dt;
    if (u.buff.powerT > 0) u.buff.powerT -= dt; if (u.buff.guardT > 0) u.buff.guardT -= dt;
    if (u.injuredT > 0) { u.injuredT -= dt; if (u.injuredT <= 0) this.refreshUnit(u); }
    u.cmdNow = u.quest || u.state === 'fight' ? this.commandFor(u) : 'auto';
    if (u.state === 'downed') {
      u.downT -= dt;
      // allies (any non-downed party member or cleric) nearby revive
      const helper = this.nearby(u, 1.6, (o) => o.kind === 'adv' && o.state !== 'downed')[0];
      if (helper) { u.reviveT = (u.reviveT || 0) + dt * (B.jobs[helper.p.job].role === 'heal' ? 2 : 1); if (u.reviveT >= 3) { u.state = 'fight'; u.hp = u.maxHp * 0.3; u.reviveT = 0; this.stats.revives++; this.fxPush('heal', u.x, u.y); } }
      if (u.downT <= 0 && u.state === 'downed') {
        // rescue: carried back to the guild, injured (no instant death)
        this.stats.rescues++;
        if (this.dev.deathOnDown) { this.life.die(p, '전투 중 사망'); this.removeUnit(u); return; }
        const h = this.hallPoint(); u.x = h.x; u.y = h.y; u.state = 'rest'; u.stateT = 0; u.injuredT = 120; this.refreshUnit(u); u.hp = u.maxHp * 0.5;
        p.history.push(`${this.life.year}년 구조됨 (부상)`); this.fxPush('rescue', u.x, u.y);
        if (u.quest) this.leaveQuest(u, true);
      }
      return;
    }
    // regen out of combat
    if (u.state !== 'fight') { u.mp = Math.min(u.maxMp, u.mp + dt * 0.5); }
    if (u.hp < u.maxHp * C.potionAt && u.p.inv.potion_hp > 0) { u.p.inv.potion_hp--; u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.5); this.fxPush('heal', u.x, u.y); }
    if (u.mp < job.mp * 0.2 && u.p.inv.potion_mp > 0) { u.p.inv.potion_mp--; u.mp = u.maxMp; }

    // commands
    const cmd = u.cmdNow; const c = this.guild.cmd;
    if (cmd === 'withdraw') { if (u.quest) this.leaveQuest(u, true); u.state = 'return'; }
    if (cmd === 'rally' || cmd === 'move') { this.goTo(u, c.x + (u.id % 3 - 1) * 0.8, c.y + ((u.id >> 2) % 3 - 1) * 0.8); this.follow(u, C.moveSpeed * 1.1, dt); this.opportunistic(u, dt); return; }
    if (cmd === 'retreat') {
      const boss = this.monsters.find((m) => !m.dead && MONSTERS[m.type].boss && dist2(m, u) < 100);
      const from = boss || this.nearestEnemy(u, 8);
      if (from) { const d = Math.sqrt(dist2(u, from)) || 1; if (d < 6.5) { this.stepToward(u, u.x + (u.x - from.x) / d * 3, u.y + (u.y - from.y) / d * 3, C.moveSpeed * 1.2, dt); return; } }
      if (job.role !== 'melee') this.opportunistic(u, dt); return;
    }
    if (cmd === 'hold') { return; }

    // threats while active
    if (u.state !== 'rest' && u.state !== 'idle' && u.state !== 'board' && u.state !== 'shop') {
      const range = cmd === 'focus' && c.target && !c.target.dead ? 30 : C.aggroRange;
      const en = cmd === 'focus' && c.target && !c.target.dead && dist2(u, c.target) < 30 * 30 ? c.target : this.nearestEnemy(u, range);
      if (en && (u.state === 'fight' || u.state === 'travel' || u.state === 'work' || u.state === 'return' && dist2(u, en) < 9)) {
        if (u.state !== 'fight') { u.prevState = u.state === 'fight' ? u.prevState : u.state; u.state = 'fight'; }
        u.target = en; this.fight(u, en, dt); return;
      }
      if (u.state === 'fight') { u.state = u.prevState || 'work'; u.target = null; u.goal = null; u.path = null; }
    }
    switch (u.state) {
      case 'idle': {
        if (u.injuredT > 0 || p.fatigue > 70 || u.hp < u.maxHp * 0.6) { u.state = 'rest'; u.stateT = 0; break; }
        if (p.stage !== 'adult') break;
        const board = this.facsOf('board')[0];
        if (!board) { if (u.stateT > 4) { u.stateT = 0; const h = this.hallPoint(); this.goTo(u, h.x + this.rnd() * 4 - 2, h.y + this.rnd() * 2); } this.follow(u, 1.2, dt); break; }
        const open = this.guild.quests.filter((q) => q.state === 'open' && q.party.length < q.size && p.grade >= q.minGrade);
        if (!open.length) { if (u.stateT > 5) { u.stateT = 0; const bp = this.facPoint(board); this.goTo(u, bp.x + this.rnd() * 4 - 2, bp.y + this.rnd() * 2); } this.follow(u, 1.2, dt); break; }
        u.state = 'board'; u.stateT = 0; const bp = this.facPoint(board); this.goTo(u, bp.x, bp.y); break;
      }
      case 'board': {
        if (!this.follow(u, C.moveSpeed, dt)) break;
        const open = this.guild.quests.filter((q) => q.state === 'open' && q.party.length < q.size && p.grade >= q.minGrade);
        if (!open.length) { u.state = 'idle'; break; }
        open.sort((a, b) => b.reward / b.size - a.reward / a.size + (b.party.length - a.party.length) * 5);
        const q = open[0]; q.party.push(u.id); u.quest = q;
        u.state = 'shop'; u.stateT = 0;
        const shop = this.facsOf('shop')[0]; if (shop) { const sp = this.facPoint(shop); this.goTo(u, sp.x, sp.y); }
        break;
      }
      case 'shop': {
        const shop = this.facsOf('shop')[0];
        if (shop && !this.follow(u, C.moveSpeed, dt)) break;
        if (shop) this.shopVisit(u, shop);
        u.state = 'wait'; u.stateT = 0; break;
      }
      case 'wait': {
        const q = u.quest; if (!q) { u.state = 'idle'; break; }
        if (q.party.length >= q.size || u.stateT > 25) {
          if (q.state === 'open') { q.state = 'taken'; q.startedAt = this.time; this.events.emit('quest', q, 'take'); }
          u.state = 'travel'; u.stateT = 0;
          const lead = q.party[0] === u.id; const off = q.party.indexOf(u.id);
          this.goTo(u, q.goal.x + (off % 2) * 0.9 - 0.45, q.goal.y + (off >> 1) * 0.9 - 0.45); void lead;
        }
        break;
      }
      case 'travel': {
        const q = u.quest; if (!q) { u.state = 'return'; break; }
        if (u.pathFail && !u.pathPending && u.stateT > 2) { this.leaveQuest(u, true); u.state = 'return'; break; }
        if (this.follow(u, C.moveSpeed, dt)) { u.state = 'work'; u.stateT = 0; }
        break;
      }
      case 'work': this.work(u, dt); break;
      case 'return': {
        const h = this.hallPoint();
        if (!u.goal && Math.hypot(u.x - h.x, u.y - h.y) > 1.5) this.goTo(u, h.x + this.rnd() * 2 - 1, h.y + this.rnd());
        if (this.follow(u, C.moveSpeed, dt) || Math.hypot(u.x - h.x, u.y - h.y) < 1.5) {
          const q = u.quest;
          if (q && q.state === 'taken' && q.progress < q.count) this.leaveQuest(u, true);
          if (q && q.state === 'taken' && q.progress >= q.count) {
            // report when the whole surviving party is back (or after a short wait)
            const party = q.party.map((id) => this.units.get(id)).filter(Boolean);
            if (party.every((m) => m === u || m.state === 'home') || u.stateT > 20) this.finishQuest(q, true); else { u.state = 'home'; break; }
          }
          u.state = 'sell'; u.stateT = 0;
          const ct = this.facsOf('counter')[0]; if (ct) { const cp = this.facPoint(ct); this.goTo(u, cp.x, cp.y); }
        }
        break;
      }
      case 'home': { const q = u.quest; if (!q || q.state !== 'taken') { u.state = 'sell'; break; } if (u.stateT > 20) this.finishQuest(q, true); break; }
      case 'sell': {
        const ct = this.facsOf('counter')[0];
        if (ct && !this.follow(u, C.moveSpeed, dt)) break;
        if (ct) this.sellLoot(u, ct);
        p.fatigue = Math.min(100, p.fatigue + C.fatiguePerQuest);
        u.state = 'idle'; u.stateT = 0; break;
      }
      case 'rest': {
        u.hp = Math.min(u.maxHp, u.hp + u.maxHp * dt / C.restSec); u.mp = u.maxMp;
        p.fatigue = Math.max(0, p.fatigue - 100 * dt / C.restSec);
        if (u.stateT < 0.1) { const h = this.hallPoint(); this.goTo(u, h.x + this.rnd() * 3 - 1.5, h.y - 0.5); }
        this.follow(u, 1.5, dt);
        if (p.fatigue <= 5 && u.hp >= u.maxHp * 0.95 && u.injuredT <= 0) { u.state = 'idle'; u.stateT = 0; }
        break;
      }
      default: u.state = 'idle';
    }
  }
  opportunistic(u, dt) {
    if (u.cmdNow === 'hold') return;
    const en = this.nearestEnemy(u, B.jobs[u.p.job].range + 0.3);
    if (en && u.cd <= 0) this.unitAttack(u, en, dt);
  }
  fight(u, en, dt) {
    const job = B.jobs[u.p.job];
    const d = Math.sqrt(dist2(u, en));
    const want = job.role === 'melee' ? 0.9 : Math.max(1.2, job.range - 0.8);
    if (u.cmdNow === 'charge' || job.role === 'melee') { if (d > want) this.stepToward(u, en.x, en.y, C.moveSpeed, dt); }
    else if (d > job.range) this.stepToward(u, en.x, en.y, C.moveSpeed, dt);
    else if (d < 1.5 && job.role !== 'melee') this.stepToward(u, u.x + (u.x - en.x), u.y + (u.y - en.y), C.moveSpeed * 0.7, dt);  // kite
    setFacing(u, en.x - u.x, en.y - u.y);
    if (u.cd <= 0) this.unitAttack(u, en, dt);
  }
  work(u, dt) {
    const q = u.quest; if (!q || q.state !== 'taken') { u.state = 'return'; return; }
    if (this.time - q.startedAt > B.quests.abandonAfterSec) { this.finishQuest(q, false); u.state = 'return'; this.toast(`의뢰 시간 초과: ${questLabel(q)}`); return; }
    const W = this.world;
    if (q.type === 'hunt') {
      if (q.progress >= q.count) { u.state = 'return'; return; }
      // search the habitat: wander inside it
      if (!u.goal) { const a = this.rnd() * 6.28, r = 1 + this.rnd() * 4; this.goTo(u, q.goal.x + Math.cos(a) * r, q.goal.y + Math.sin(a) * r); }
      this.follow(u, C.moveSpeed * 0.8, dt);
    } else if (q.type === 'survey') {
      if (!u.goal && u.stateT % 4 < dt) { const a = this.rnd() * 6.28; this.goTo(u, q.goal.x + Math.cos(a) * 3, q.goal.y + Math.sin(a) * 3); }
      this.follow(u, 1.4, dt);
      q.progress += dt / B.quests.surveySec / q.party.length;
      if (q.progress >= 1) { q.progress = q.count = 1; const h = W.habitats[q.goal.habitat]; add(this.guild.samples, h.type, 3); this.codexAdd(h.type); this.codexAdd(h.region); u.state = 'return'; }
    } else if (q.type === 'gather') {
      if (q.progress >= q.count) { u.state = 'return'; return; }
      if (!u.goal) {
        const code = q.goal.code; let best = null, bd = Infinity;
        const x0 = Math.max(0, (u.x | 0) - 12), x1 = Math.min(W.w - 1, (u.x | 0) + 12), y0 = Math.max(0, (u.y | 0) - 12), y1 = Math.min(W.h - 1, (u.y | 0) + 12);
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
          const i = W.idx(x, y); if (W.node[i] !== code || (this.nodeCd?.get(i) || 0) > this.time) continue;
          const d = (x - u.x) ** 2 + (y - u.y) ** 2; if (d < bd) { bd = d; best = [x, y, i]; }
        }
        if (!best) { u.state = 'return'; return; }
        u.gatherAt = best; this.goTo(u, best[0] + 0.5, best[1] + 1.2);
      }
      if (this.follow(u, C.moveSpeed, dt) && u.gatherAt) {
        (this.nodeCd ||= new Map()).set(u.gatherAt[2], this.time + 20);
        add(u.p.inv, NODES[q.goal.code], 1); q.progress += 1; u.gatherAt = null; this.codexAdd(NODES[q.goal.code]);
      }
    } else if (q.type === 'explore') {
      W.reveal(u.x, u.y, 6);
      if (this.follow(u, C.moveSpeed, dt) || !u.goal) { q.progress = q.count = 1; u.state = 'return'; }
    }
  }
  shopVisit(u, shop) {
    const p = u.p; const job = p.job;
    const buy = (id, oldId) => {
      const price = this.market.price(id);
      if (p.gold < price || !shop.stock[id]) return false;
      this.ledger.pay(p, 'guild', price, 'sales'); shop.stock[id]--; if (!shop.stock[id]) delete shop.stock[id];
      this.market.noteSale(id); this.stats.bought++;
      if (oldId) {   // trade in used equipment at the used-market price
        const up = this.market.usedPrice(oldId);
        if (this.ledger.pay('guild', p, up, 'used')) {
          const ct = this.facsOf('counter')[0]; if (ct) add(ct.stock, oldId); else add(shop.stock, oldId);
          this.guild.usedBought = (this.guild.usedBought || 0) + 1;
        }
      }
      p.history.push(`${this.life.year}년 ${ITEMS[id].name} 구매 (${price}G)`);
      return true;
    };
    // weapon upgrade
    const curT = p.equip.weapon ? ITEMS[p.equip.weapon].tier : 0;
    const ws = Object.keys(shop.stock).filter((id) => ITEMS[id].slot === 'weapon' && ITEMS[id].job === job && ITEMS[id].tier > curT).sort((a, b) => ITEMS[b].tier - ITEMS[a].tier);
    for (const id of ws) if (buy(id, p.equip.weapon)) { p.equip.weapon = id; this.codexAdd(id); break; }
    const curA = p.equip.armor ? ITEMS[p.equip.armor].tier : 0;
    const as = Object.keys(shop.stock).filter((id) => ITEMS[id].slot === 'armor' && ITEMS[id].tier > curA).sort((a, b) => ITEMS[b].tier - ITEMS[a].tier);
    for (const id of as) if (buy(id, p.equip.armor)) { p.equip.armor = id; this.codexAdd(id); break; }
    while ((p.inv.potion_hp || 0) < 2 && shop.stock.potion_hp && buy('potion_hp')) add(p.inv, 'potion_hp');
    if ((job === 'mage' || job === 'cleric') && (p.inv.potion_mp || 0) < 1 && shop.stock.potion_mp && buy('potion_mp')) add(p.inv, 'potion_mp');
    if (!p.equip.weapon) u.wantedGear = true;
    this.refreshUnit(u);
  }
  sellLoot(u, ct) {
    const p = u.p;
    for (const [id, n] of Object.entries(p.inv)) {
      if (ITEMS[id]?.cat !== 'loot' && !['herb', 'fiber', 'berry'].includes(id)) continue;
      for (let i = 0; i < n; i++) {
        const price = this.market.price(id);
        if (!this.ledger.pay('guild', p, price, 'loot')) { this.guild.stalls++; break; }
        p.inv[id]--; add(ct.stock, id); this.market.noteBuyback(id); this.stats.sold++;
      }
      if (!p.inv[id]) delete p.inv[id];
    }
  }

  // ---------------- monsters AI ----------------
  tickMonster(m, dt) {
    const d = MONSTERS[m.type];
    m.cd -= dt; m.moving = false;
    if (d.boss) return this.tickBoss(m, d, dt);
    const tgt = this.nearby(m, C.aggroRange, (o) => o.kind === 'adv' && o.state !== 'downed');
    let best = null, bd = Infinity; for (const u of tgt) { const x = dist2(u, m); if (x < bd) { bd = x; best = u; } }
    const leash = m.habitat ? dist2(m, m.home) > 100 : false;
    if (best && !leash) {
      const dd = Math.sqrt(bd);
      if (dd > d.range) this.stepToward(m, best.x, best.y, d.speed, dt);
      else if (m.cd <= 0) { m.cd = d.cd; this.dmgTo(best, d.atk * (0.8 + this.rnd() * 0.4)); this.fxPush('hit', best.x, best.y); }
      setFacing(m, best.x - m.x, best.y - m.y);
    } else {
      m.wanderT -= dt;
      if (m.wanderT <= 0) { m.wanderT = 2 + this.rnd() * 3; const a = this.rnd() * 6.28; m.gx = m.home.x + Math.cos(a) * 2.5; m.gy = m.home.y + Math.sin(a) * 2.5; }
      if (Math.hypot(m.gx - m.x, m.gy - m.y) > 0.2) this.stepToward(m, m.gx, m.gy, d.speed * 0.5, dt);
      if (m.hp < m.maxHp) m.hp = Math.min(m.maxHp, m.hp + dt * 2);
    }
  }
  tickBoss(m, d, dt) {
    const tgt = this.nearby(m, 14, (o) => o.kind === 'adv' && o.state !== 'downed');
    if (m.tele) {
      m.tele.t += dt;
      if (m.tele.t >= m.tele.windup) {
        for (const u of this.nearby(m, m.tele.r, (o) => o.kind === 'adv' && o.state !== 'downed')) { this.dmgTo(u, d.atk * m.tele.dmg); this.fxPush('hit', u.x, u.y); }
        this.fxPush('quake', m.x, m.y, m.tele.r); this.guild.bossHits = (this.guild.bossHits || 0) + 1;
        m.tele = null; m.cd = 0.8;
      }
      return;
    }
    if (!tgt.length) return;
    m.patT.forEach((t, i) => { m.patT[i] = t - dt; });
    const ready = d.patterns.findIndex((p, i) => m.patT[i] <= 0);
    if (ready >= 0) {
      const p = d.patterns[ready]; m.patT[ready] = p.every;
      m.tele = { id: p.id, name: p.name, t: 0, windup: p.windup, r: p.radius, dmg: p.dmg, x: m.x, y: m.y };
      this.events.emit('telegraph', m, m.tele); return;
    }
    tgt.sort((a, b) => dist2(a, m) - dist2(b, m)); const best = tgt[0];
    const dd = Math.sqrt(dist2(best, m));
    if (dd > d.range) this.stepToward(m, best.x, best.y, d.speed, dt);
    else if (m.cd <= 0) { m.cd = d.cd; this.dmgTo(best, d.atk); this.fxPush('hit', best.x, best.y); }
  }

  // ---------------- commands / skills ----------------
  command(mode, opt = {}) { Object.assign(this.guild.cmd, { mode, ...opt }); this.events.emit('command', mode); }
  useSkill(k) {
    const s = COMMAND_SKILLS[k]; if (!this.skillUnlocked(k) && !this.dev.allSkills) return false;
    if ((this.guild.skillCd[k] || 0) > this.time) return false;
    this.guild.skillCd[k] = this.time + s.cd;
    for (const u of this.units.values()) {
      if (dist2(u, this.gm) > 14 * 14 && this.guild.cmd.scope !== 'all') continue;
      if (k === 'rally_power') u.buff.powerT = s.dur;
      if (k === 'guard') u.buff.guardT = s.dur;
      if (k === 'heal' && u.state !== 'downed') u.hp = Math.min(u.maxHp, u.hp + u.maxHp * s.effect.healFrac);
      if (k === 'mana') u.mp = Math.min(u.maxMp, u.mp + u.maxMp * s.effect.manaFrac);
    }
    this.fxPush('skill', this.gm.x, this.gm.y, s.name); return true;
  }

  // ---------------- life integration ----------------
  onLifeEvent(e, p) { this.events.emit('life', e, p); if (e.kind === 'rare' || (p && p.interest && e.kind !== 'life')) this.toast(e.text, 'rare'); }
  tickYear() {
    const before = new Map(this.people.map((p) => [p.id, p.stage]));
    this.life.year1(this.people, { housingCap: this.housingCap(), schoolCap: this.schoolCap(), abstractActivity: false });
    for (const p of this.people) {
      const was = before.get(p.id);
      if (was === undefined) continue;
      const u = this.units.get(p.id);
      if (p.stage === 'adult' && was !== 'adult' && !u) { p.gold = p.gold || 10; this.spawnUnit(p); this.toast(`${p.name}이(가) 성인이 되어 모험가로 활동을 시작합니다.`, 'life'); }
      if ((p.stage === 'retired' || !p.alive) && u) this.removeUnit(u);
      if (!p.alive && was !== 'dead' && p.gold > 0) {   // inheritance keeps money inside the economy
        const heirs = [p.spouse, ...p.children].map((id) => this.people.byId.get(id)).filter((h) => h && h.alive);
        if (heirs.length) { const s = Math.floor(p.gold / heirs.length); heirs.forEach((h) => (h.gold += s)); this.ledger.guild += p.gold - s * heirs.length; }
        else this.ledger.guild += p.gold;
        p.gold = 0;
      }
    }
  }
  onDiscover(kind, obj) {
    if (kind === 'region') { this.codexAdd(obj.id); this.toast(`새 지역 발견: ${obj.name}`, 'discover'); }
    if (kind === 'habitat') this.toast(`몬스터 서식지 발견: ${MONSTERS[obj.type].name}`, 'discover');
    if (kind === 'treasure') this.toast('보물을 발견했습니다! (가까이 가서 E)', 'discover');
  }

  // ---------------- main tick ----------------
  tick(dt) {
    this.time += dt;
    this.world.tick(dt);
    this.tickHabitats(dt);
    this.tickBoard(dt);
    this.buildBuckets();
    this.processPaths();
    for (const u of this.units.values()) {
      this.tickUnit(u, dt);
      if (u.state === 'travel' || u.state === 'work' || u.state === 'fight') { u.revealT = (u.revealT || 0) - dt; if (u.revealT <= 0) { u.revealT = 0.5; this.world.reveal(u.x, u.y, 5); } }
    }
    for (const m of this.monsters) if (!m.dead) this.tickMonster(m, dt);
    if (this.monsters.some((m) => m.dead)) this.monsters = this.monsters.filter((m) => !m.dead);
    this.market.tick(dt, (id) => this.stockOf(id));
    this.yearT += dt;
    if (this.yearT >= B.time.realSecondsPerYear) { this.yearT -= B.time.realSecondsPerYear; this.tickYear(); }
  }
  stockOf(id) { let n = 0; for (const f of this.facsOf('shop')) n += f.stock[id] || 0; for (const f of this.facsOf('counter')) n += f.stock[id] || 0; return n; }
  moneySupply() { return this.ledger.moneySupply(this.people) + this.guild.escrow; }

  // ---------------- save ----------------
  serialize() {
    return {
      world: this.world.serialize(), time: this.time, yearT: this.yearT, year: this.life.year, lifeStats: this.life.stats,
      history: this.life.history.slice(-400),
      people: this.people.map((p) => p),
      units: [...this.units.values()].map((u) => ({ id: u.id, x: +u.x.toFixed(2), y: +u.y.toFixed(2), hp: Math.round(u.hp), mp: Math.round(u.mp), injuredT: u.injuredT })),
      guild: { ...this.guild, tech: [...this.guild.tech], codex: [...this.guild.codex], quests: [], cmd: { mode: 'auto' } },
      openQuests: this.guild.quests.map((q) => ({ tmpl: q.tmpl, reward: q.reward })),
      market: this.market.serialize(), ledger: { guild: this.ledger.guild, injected: this.ledger.injected, faucet: this.ledger.faucet, flows: this.ledger.flows },
      stats: this.stats, nextMonsterId: this.nextMonsterId,
    };
  }
  restore(s) {
    this.world.restore(s.world);
    this.time = s.time || 0; this.yearT = s.yearT || 0; this.life.year = s.year || 0; this.life.stats = s.lifeStats || this.life.stats;
    this.life.history = s.history || [];
    let maxId = 0;
    for (const p of s.people || []) { this.addPerson(p); maxId = Math.max(maxId, p.id); }
    setNextPersonId(maxId + 1);
    const g = s.guild || {};
    Object.assign(this.guild, g, { tech: new Set(g.tech || []), codex: new Set(g.codex || []), quests: [], cmd: { mode: 'auto', x: 0, y: 0 } });
    // open quests: refund escrow to the guild and let templates repost (active counts reset)
    for (const t of this.guild.templates) t.active = 0;
    const esc = (s.openQuests || []).reduce((a, q) => a + q.reward, 0);
    this.guild.escrow = 0;
    Object.assign(this.ledger, s.ledger || {}); this.ledger.guild += esc;
    // quest scrolls of refunded quests are returned to the board
    const board = this.facsOf('board')[0];
    if (board) for (const q of s.openQuests || []) { const t = this.guild.templates.find((x) => x.id === q.tmpl); if (t) board.stock.quest = (board.stock.quest || 0) + this.questCost(t); }
    this.market.restore(s.market); this.stats = s.stats || this.stats;
    for (const ud of s.units || []) {
      const p = this.people.byId.get(ud.id); if (!p || !p.alive || p.stage !== 'adult') continue;
      const u = this.spawnUnit(p, { x: ud.x, y: ud.y }); u.x = ud.x; u.y = ud.y; u.hp = ud.hp; u.mp = ud.mp; u.injuredT = ud.injuredT || 0; this.refreshUnit(u);
    }
  }
}
export function setFacing(e, dx, dy) { if (Math.abs(dx) > Math.abs(dy)) e.facing = dx > 0 ? 'E' : 'W'; else if (dy) e.facing = dy > 0 ? 'S' : 'N'; }
export function questLabel(q) {
  const T = { hunt: '토벌', survey: '조사', gather: '채집', explore: '탐험' }[q.type];
  const tgt = q.type === 'hunt' || q.type === 'survey' ? MONSTERS[q.target]?.name : q.type === 'gather' ? ITEMS[q.target]?.name : '미탐험 지역';
  return `${T}: ${tgt}${q.type === 'hunt' || q.type === 'gather' ? ` ×${q.count}` : ''}`;
}
export function milestoneName(k) {
  if (k === 'adventurers') return '모험가 수';
  if (k === 'used_bought') return '중고 장비 매입';
  const m = k.match(/^(.*)_(made|mined)$/); if (m) return `${ITEMS[m[1]]?.name || m[1]} ${m[2] === 'made' ? '생산' : '채굴'}`;
  return k;
}
export { basePrice, gradeName };
