import Phaser from 'phaser';
import { TILE, FACILITIES } from '../art/manifest.js';
import {
  FACILITY_DEFS, ITEM_DEFS, START_STOCK, HOPPER_RESERVE, MONSTER_DEFS, RESEARCH, UPGRADES, QUEST, GUILD, ADVENTURER_ROSTER,
} from '../data/defs.js';
import { Factory, DEPTH, makeItemSprite } from '../systems/Factory.js';
import { Unit, Worker, Adventurer, Monster } from '../systems/Units.js';
import { UNITS } from '../art/manifest.js';
import * as Save from '../systems/Save.js';

const W = 40, H = 26;              // map size in cells
const BUILD_LIMIT_X = 32;          // east of this = monster field (no building)
const GRASS = { tl: 0, t: 1, tr: 2, l: 9, c: 10, r: 11, bl: 18, b: 19, br: 20 };

export class WorldScene extends Phaser.Scene {
  static SPEED = Math.max(1, Math.min(16, Number(new URLSearchParams(location.search).get('speed')) || 1));

  constructor() { super('World'); }

  create() {
    this.mode = 'direct';
    this.tool = null;       // { type, dir }
    this.selected = null;
    this.guild = this.freshGuild();
    this.blockers = Array.from({ length: H }, () => Array(W).fill(false));
    this.occ = Array.from({ length: H }, () => Array(W).fill(null));

    this.buildTerrain();
    this.buildScenery();

    this.factory = new Factory(this, {
      w: W, h: H, occ: this.occ,
      blocked: (x, y) => this.blockers[y][x] || x >= BUILD_LIMIT_X,
    }, {
      deliver: (item, f) => this.onDeliver(item, f),
      takeStock: (item) => this.takeStock(item),
      bonus: (stat) => this.bonus(stat),
    });

    this.gm = new Unit(this, UNITS.guildmaster, 9 * TILE, 7.5 * TILE);
    this.gm.speed = 210;
    this.workers = [
      new Worker(this, 7 * TILE, 8 * TILE, 'gold', this.nodes.gold[0], this.dropPoint),
      new Worker(this, 8 * TILE, 8 * TILE, 'gold', this.nodes.gold[2], this.dropPoint),
      new Worker(this, 6 * TILE, 9 * TILE, 'wood', this.nodes.wood[1], this.dropPoint),
      new Worker(this, 5 * TILE, 9 * TILE, 'wood', this.nodes.wood[4], this.dropPoint),
    ];
    this.adventurers = [];

    const saved = Save.load();
    if (saved) this.applySave(saved); else this.newGame();

    // camera
    const cam = this.cameras.main;
    cam.setBounds(0, 0, W * TILE, H * TILE).setRoundPixels(true).setBackgroundColor('#47aba9');
    cam.startFollow(this.gm.sprite, true, 0.15, 0.15);

    this.setupInput();
    this.ghost = this.add.sprite(0, 0, 'belt').setAlpha(0.6).setVisible(false).setDepth(DEPTH.fx);
    this.ghostRect = this.add.graphics().setDepth(DEPTH.fx - 1);
    this.selRect = this.add.graphics().setDepth(DEPTH.fx - 1);

    this.time.addEvent({ delay: 20000, loop: true, callback: () => this.save(true) });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.save(true); });

    this.scene.launch('UI');
    this.emitState();
  }

  freshGuild() {
    return {
      stock: { ...START_STOCK }, exp: 0, level: 1, quests: 0, notes: 0, completed: 0,
      codex: {}, research: {}, autoDispatch: true,
    };
  }

  // ── terrain & scenery ────────────────────────────────────────────────────
  isLand(x, y) { return x >= 1 && y >= 1 && x <= W - 2 && y <= H - 2; }

  buildTerrain() {
    this.add.tileSprite(0, 0, W * TILE, H * TILE, 'water').setOrigin(0).setDepth(-3);
    const rt = this.add.renderTexture(0, 0, W * TILE, H * TILE).setOrigin(0).setDepth(DEPTH.ground);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!this.isLand(x, y)) { this.blockers[y][x] = true; continue; }
      const L = !this.isLand(x - 1, y), R = !this.isLand(x + 1, y), T = !this.isLand(x, y - 1), B = !this.isLand(x, y + 1);
      const k = T ? (L ? 'tl' : R ? 'tr' : 't') : B ? (L ? 'bl' : R ? 'br' : 'b') : L ? 'l' : R ? 'r' : 'c';
      rt.drawFrame('terrain', GRASS[k], x * TILE, y * TILE);
      if (L || R || T || B) this.add.sprite(x * TILE + 32, y * TILE + 32, 'foam').play({ key: 'foam', startFrame: (x + y) % 8 }).setDepth(-2);
    }
  }

  block(x0, y0, w, h) {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (this.blockers[y]) this.blockers[y][x] = true;
  }

  buildScenery() {
    const add = (key, cx, cy, ox = 0.5, oy = 1) => this.add.image(cx, cy, key).setOrigin(ox, oy).setDepth(DEPTH.world + cy);
    // guild hall (castle) = warehouse; workers deliver to its door
    add('castle', 5.5 * TILE, 6 * TILE);
    this.block(3, 3, 5, 3);
    this.dropPoint = { x: 5.5 * TILE, y: 6.4 * TILE };
    add('house1', 1.5 * TILE + 32, 4 * TILE + 20); this.block(1, 2, 2, 2);
    add('house2', 9 * TILE, 4 * TILE + 20); this.block(8, 2, 2, 2);
    add('tower', 2 * TILE, 11 * TILE); this.block(1, 9, 2, 2);
    add('barracks', 9.5 * TILE, 21 * TILE); this.block(8, 19, 3, 2);
    this.barracksSpot = { x: 9.5 * TILE, y: 21.5 * TILE };

    this.nodes = { gold: [], wood: [] };
    for (const [x, y, big] of [[13, 3, 1], [16, 2, 0], [18, 4, 1], [21, 3, 0], [15, 5, 0]]) {
      const cx = x * TILE + 32, cy = y * TILE + 32;
      const s = this.add.image(cx, cy + 8, big ? 'goldstone1' : 'goldstone3').setOrigin(0.5, 0.62).setDepth(DEPTH.world + cy + 8);
      this.add.sprite(cx, cy + 8, 'goldstone1_hl').setOrigin(0.5, 0.62).play({ key: 'gold_sparkle', startFrame: x % 6 }).setDepth(s.depth + 1).setAlpha(big ? 1 : 0);
      this.blockers[y][x] = true;
      this.nodes.gold.push({ x: cx, y: cy, sprite: s, kind: 'gold' });
    }
    const trees = [[2, 15], [4, 14], [3, 18], [5, 17], [2, 21], [4, 22], [6, 20], [7, 23], [1, 13], [6, 15], [3, 24]];
    for (const [x, y] of trees) {
      if (!this.isLand(x, y)) continue;
      const cx = x * TILE + 32, cy = y * TILE + 40;
      const key = (x + y) % 2 ? 'tree1' : 'tree2';
      const s = this.add.sprite(cx, cy, key).setOrigin(0.5, 0.86).play({ key: key + '_sway', startFrame: (x * 3 + y) % 8 }).setDepth(DEPTH.world + cy);
      this.blockers[y][x] = true;
      this.nodes.wood.push({ x: cx, y: cy - 8, sprite: s, kind: 'wood' });
    }
    for (const [x, y] of [[10, 12], [9, 16], [30, 22], [24, 23], [11, 6]]) {
      this.add.sprite(x * TILE + 32, y * TILE + 48, 'bush1').setOrigin(0.5, 0.75).play({ key: 'bush1', startFrame: x % 8 }).setDepth(DEPTH.world + y * TILE + 48);
    }
    for (const [x, y] of [[31, 3], [23, 21], [12, 22]]) add('rock1', x * TILE + 32, y * TILE + 48);
    for (const [x, y] of [[14, 22], [16, 23], [18, 21]]) {
      this.add.sprite(x * TILE, y * TILE, 'sheep_idle').play({ key: 'sheep_idle', startFrame: x % 6 }).setDepth(DEPTH.world + y * TILE + 30);
    }

    // monster field (east)
    this.monsterCamps = {
      shadow_knight: { x: 35 * TILE, y: 6 * TILE },
      violet_archer: { x: 36 * TILE, y: 12 * TILE },
      crimson_monk: { x: 35 * TILE, y: 19 * TILE },
    };
    this.monsters = [];
    for (const [id, c] of Object.entries(this.monsterCamps)) {
      for (const [dx, dy] of [[0, 0], [60, -36], [72, 40]]) this.monsters.push(new Monster(this, id, c.x + dx, c.y + dy));
    }
    const sign = this.add.text(BUILD_LIMIT_X * TILE + 20, 1.3 * TILE, '토벌 지역', { fontFamily: 'Galmuri11', fontSize: '24px', color: '#ffffff', stroke: '#5a2a2a', strokeThickness: 6 }).setDepth(DEPTH.fx);
    sign.setResolution(1);
    const g = this.add.graphics().setDepth(DEPTH.ground + 1);
    g.lineStyle(4, 0x7a3a2a, 0.35);
    for (let y = 1; y < H - 1; y += 1) if (y % 2) g.lineBetween(BUILD_LIMIT_X * TILE, y * TILE, BUILD_LIMIT_X * TILE, (y + 1) * TILE);
  }

  // ── game setup / save ────────────────────────────────────────────────────
  newGame() {
    this.guild = this.freshGuild();
    const P = (t, x, y, d = 0, extra) => this.factory.place(t, x, y, d, extra);
    const belts = (x0, x1, y, d) => { for (let x = x0; x <= x1; x++) P('belt', x, y, d); };
    const beltsV = (x, y0, y1, d) => { for (let y = y0; y <= y1; y++) P('belt', x, y, d); };
    // Line A: gold ore → ingot → sword → quest scroll → board
    P('hopper', 12, 9, 0, { filter: 'gold_ore' }); belts(13, 14, 9, 0);
    P('smelter', 15, 9); belts(17, 18, 9, 0);
    P('fabricator', 19, 9); belts(21, 22, 9, 0);
    P('quest_assembler', 23, 9); belts(25, 26, 9, 0);
    P('quest_board', 27, 8);
    // Line B: wood → exp crystal, turns up and merges into line A
    P('hopper', 12, 13, 0, { filter: 'wood' }); belts(13, 14, 13, 0);
    P('exp_generator', 15, 13); belts(17, 25, 13, 0);
    P('belt', 26, 13, 3); beltsV(26, 10, 12, 3);
    // Line C: loot → research notes (starts once adventurers bring loot home)
    P('hopper', 12, 17, 0, { filter: 'loot_shadow' }); belts(13, 14, 17, 0);
    P('loot_recycler', 15, 17); belts(17, 28, 17, 0);
    P('belt', 29, 17, 3); beltsV(29, 10, 16, 3); P('belt', 29, 9, 2);
    this.syncAdventurers();
  }

  applySave(s) {
    this.guild = { ...this.freshGuild(), ...s.guild };
    this.factory.load(s.facilities ?? []);
    if (s.gm) this.gm.sprite.setPosition(s.gm.x, s.gm.y);
    this.syncAdventurers();
    this.time.delayedCall(300, () => this.toast('저장된 게임을 불러왔습니다.'));
  }

  save(silent = false) {
    const ok = Save.write({
      v: 1, at: Date.now(), guild: this.guild, facilities: this.factory.serialize(),
      gm: { x: Math.round(this.gm.x), y: Math.round(this.gm.y) },
    });
    if (!silent) this.toast(ok ? '저장 완료 (브라우저에 보관됨)' : '저장 실패: 브라우저 저장소를 쓸 수 없습니다.');
  }

  resetGame() {
    Save.clear();
    this.scene.stop('UI');
    this.scene.restart();
  }

  syncAdventurers() {
    const max = GUILD.maxAdventurers[this.guild.level - 1] ?? 6;
    while (this.adventurers.length < max) {
      const i = this.adventurers.length;
      const home = { x: this.barracksSpot.x - 90 + (i % 3) * 70, y: this.barracksSpot.y + 40 + Math.floor(i / 3) * 50 };
      const a = new Adventurer(this, ADVENTURER_ROSTER[i], home);
      this.adventurers.push(a);
    }
  }

  // ── guild economy ────────────────────────────────────────────────────────
  addStock(item, n, x, y) {
    const st = this.guild.stock;
    st[item] = (st[item] ?? 0) + n;
    if (x !== undefined) this.floatIcon(item, `+${n}`, x, y);
    this.emitState();
  }

  takeStock(item) {
    const st = this.guild.stock;
    if ((st[item] ?? 0) <= (HOPPER_RESERVE[item] ?? 0)) return false;
    st[item]--; this.emitState(); return true;
  }

  canAfford(cost) { return Object.entries(cost ?? {}).every(([k, n]) => (this.guild.stock[k] ?? 0) >= n); }
  pay(cost) { for (const [k, n] of Object.entries(cost ?? {})) this.guild.stock[k] -= n; this.emitState(); }
  refund(cost) { for (const [k, n] of Object.entries(cost ?? {})) this.guild.stock[k] = (this.guild.stock[k] ?? 0) + n; this.emitState(); }

  bonus(stat) {
    let b = 0;
    for (const [id, m] of Object.entries(MONSTER_DEFS)) if (m.bonus.stat === stat) b += (this.guild.research[id] ?? 0) * m.bonus.per;
    return b;
  }

  onDeliver(item, f) {
    const g = this.guild;
    if (item === 'quest_scroll') { g.quests++; this.toast('새 의뢰가 게시되었습니다!'); }
    else if (item === 'exp_crystal') this.gainExp(GUILD.expPerCrystal);
    else if (item === 'research_note') g.notes++;
    this.floatIcon(item, '', f.cx, f.y * TILE - 10);
    this.emitState();
  }

  gainExp(n) {
    const g = this.guild;
    g.exp += n;
    while (g.level < GUILD.expPerLevel.length && g.exp >= GUILD.expPerLevel[g.level]) {
      g.level++;
      this.toast(`길드 레벨 ${g.level}! 새 모험가가 합류했습니다.`);
      this.syncAdventurers();
    }
  }

  unlockedMonsters() { return Object.entries(MONSTER_DEFS).filter(([, m]) => m.tier <= this.guild.level).map(([id]) => id); }

  dispatch(adv) {
    if (this.guild.quests <= 0 || adv.state !== 'idle') return false;
    const pool = this.unlockedMonsters();
    const target = pool[Math.floor(Math.random() * pool.length)];
    this.guild.quests--;
    adv.dispatch({ target, spot: this.monsterCamps[target], fightTime: QUEST.fightTime });
    this.toast(`${adv.info.name} 출발 → ${MONSTER_DEFS[target].name} 토벌`);
    this.emitState();
    return true;
  }

  completeQuest(adv, q) {
    const g = this.guild, m = MONSTER_DEFS[q.target];
    const coins = Math.round(QUEST.baseReward * m.tier * (1 + this.bonus('questReward')));
    const loot = 1 + (Math.random() < 0.5 ? 1 : 0);
    this.addStock('coin', coins, adv.x, adv.y - 70);
    this.addStock(m.loot, loot, adv.x + 30, adv.y - 40);
    const c = g.codex[q.target] ?? { found: false, kills: 0 };
    if (!c.found) this.toast(`도감 등록: ${m.name}`);
    c.found = true; c.kills++;
    g.codex[q.target] = c; g.completed++;
    this.emitState();
  }

  research(id) {
    const g = this.guild, m = MONSTER_DEFS[id], lv = g.research[id] ?? 0;
    if (!g.codex[id]?.found || lv >= RESEARCH.maxLevel) return;
    const cost = { [m.loot]: RESEARCH.loot[lv] };
    if (g.notes < RESEARCH.notes[lv] || !this.canAfford(cost)) { this.toast('연구 재료가 부족합니다.'); return; }
    g.notes -= RESEARCH.notes[lv]; this.pay(cost);
    g.research[id] = lv + 1;
    this.toast(`연구 완료: ${m.name} Lv${lv + 1} (${m.bonus.label})`);
    this.emitState();
  }

  upgradeSelected() {
    const f = this.selected;
    if (!f || f.def.kind !== 'machine' || f.level >= UPGRADES.maxLevel) return;
    const cost = UPGRADES.cost[f.level];
    if (!this.canAfford(cost)) { this.toast('전리품이 부족합니다.'); return; }
    this.pay(cost); this.factory.upgrade(f);
    this.toast(`${f.def.name} 강화 → ★${f.level}`);
    this.puff(f.cx, f.cy);
    this.emitState();
  }

  // ── input ────────────────────────────────────────────────────────────────
  setupInput() {
    const kb = this.input.keyboard;
    // capture keys so the browser doesn't scroll / change focus
    kb.addCapture('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,TAB,E,R,Q,X,ESC');
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,E,R,Q,X,ESC,TAB');
    this.keys.TAB.on('down', () => this.toggleMode());
    this.keys.R.on('down', () => this.rotate());
    this.keys.Q.on('down', () => this.rotate(-1));
    this.keys.ESC.on('down', () => { this.setTool(null); this.select(null); });
    this.keys.E.on('down', () => this.interact());
    this.keys.SPACE.on('down', () => this.interact());
    this.keys.X.on('down', () => { if (this.mode === 'manager') this.removeAt(this.input.activePointer); });
    this.input.mouse?.disableContextMenu();

    this.input.on('pointerdown', (p) => {
      if (this.scene.get('UI').hitUI(p)) return;
      if (this.mode !== 'manager') return;
      if (p.rightButtonDown()) { this.tool ? this.setTool(null) : this.removeAt(p); return; }
      this.dragBuild = !!this.tool;
      this.clickAt(p);
    });
    this.input.on('pointerup', () => { this.dragBuild = false; });
    this.input.on('pointermove', (p) => {
      if (this.dragBuild && p.isDown && this.tool?.type === 'belt' && !this.scene.get('UI').hitUI(p)) this.clickAt(p, true);
    });
    this.input.on('wheel', (p, objs, dx, dy) => {
      if (this.mode !== 'manager') return;
      const cam = this.cameras.main;
      cam.setZoom(dy > 0 ? 0.5 : 1); // integer-ratio zooms only (pixel art stays crisp)
    });
  }

  toggleMode() {
    const cam = this.cameras.main;
    if (this.mode === 'direct') {
      this.mode = 'manager';
      cam.stopFollow();
    } else {
      this.mode = 'direct';
      this.setTool(null); this.select(null);
      cam.setZoom(1);
      cam.startFollow(this.gm.sprite, true, 0.15, 0.15);
    }
    this.emitState();
  }

  setTool(type) {
    this.tool = type ? { type, dir: this.tool?.dir ?? 0 } : null;
    if (type) this.select(null);
    this.emitState();
  }

  rotate(d = 1) {
    if (this.tool) { this.tool.dir = (this.tool.dir + 4 + d) % 4; this.emitState(); return; }
    const f = this.selected;
    if (f && f.def.kind !== 'sink') {
      const snap = this.factory.serialize().find((o) => o.x === f.x && o.y === f.y);
      this.factory.remove(f);
      snap.d = (snap.d + 4 + d) % 4;
      const nf = this.factory.place(snap.t, snap.x, snap.y, snap.d, { level: snap.lv, filter: snap.fl });
      nf.inBuf = snap.i; nf.outBuf = snap.o;
      this.select(nf);
    }
  }

  // pointer.worldX is overwritten by whichever scene camera tested it last (the UI),
  // so always convert through this scene's own camera.
  wp(p) { return this.cameras.main.getWorldPoint(p.x, p.y); }

  cellOf(p) { const q = this.wp(p); return [Math.floor(q.x / TILE), Math.floor(q.y / TILE)]; }

  toolOrigin(p) {
    const d = FACILITY_DEFS[this.tool.type], q = this.wp(p);
    const x = Math.floor(q.x / TILE - d.w / 2 + 0.5), y = Math.floor(q.y / TILE - d.h / 2 + 0.5);
    return [x, y];
  }

  clickAt(p, dragging = false) {
    if (this.tool) {
      const [x, y] = this.toolOrigin(p);
      const def = FACILITY_DEFS[this.tool.type];
      if (!this.factory.canPlace(this.tool.type, x, y)) { if (!dragging) this.toast('여기에는 설치할 수 없습니다.'); return; }
      if (!this.canAfford(def.cost)) { if (!dragging) this.toast('재료가 부족합니다.'); return; }
      this.pay(def.cost);
      const f = this.factory.place(this.tool.type, x, y, this.tool.dir);
      if (this.tool.type !== 'belt') this.puff(f.cx, f.cy + 20);
      return;
    }
    const [cx, cy] = this.cellOf(p);
    const f = this.factory.at(cx, cy);
    if (f && f === this.selected && f.def.kind === 'source') this.cycleFilter(f);
    this.select(f);
  }

  cycleFilter(f) {
    const raw = Object.keys(ITEM_DEFS).filter((k) => ITEM_DEFS[k].raw);
    this.factory.setFilter(f, raw[(raw.indexOf(f.filter) + 1) % raw.length]);
    this.emitState();
  }

  removeAt(p) {
    const [cx, cy] = this.cellOf(p);
    const f = this.factory.at(cx, cy);
    if (!f) return;
    if (this.selected === f) this.select(null);
    this.refund(f.def.cost);
    this.factory.remove(f);
  }

  select(f) {
    this.selected = f;
    this.emitState();
  }

  interact() {
    if (this.mode !== 'direct' || this.gm.busy) return;
    let best = null, bd = 110;
    for (const n of [...this.nodes.gold, ...this.nodes.wood]) {
      const d = Math.hypot(n.x - this.gm.x, n.y - this.gm.y);
      if (d < bd) { bd = d; best = n; }
    }
    if (!best) { this.toast('근처에 채집할 수 있는 것이 없습니다.'); return; }
    this.gm.sprite.setFlipX(best.x < this.gm.x);
    this.gm.playOnce('gm_attack', () => {
      this.shake(best);
      this.addStock(best.kind === 'gold' ? 'gold_ore' : 'wood', 2, best.x, best.y - 60);
    });
  }

  // ── fx & ui glue ─────────────────────────────────────────────────────────
  puff(x, y) {
    const s = this.add.sprite(x, y, 'dust').setDepth(DEPTH.fx).play('dust');
    s.once('animationcomplete', () => s.destroy());
  }

  shake(node) {
    this.tweens.add({ targets: node.sprite, x: node.sprite.x + 3, yoyo: true, duration: 50, repeat: 2 });
  }

  floatIcon(item, label, x, y) {
    const ic = makeItemSprite(this, item, x, y).setDepth(DEPTH.fx);
    const tx = label ? this.add.text(x + 14, y - 10, label, { fontFamily: 'Galmuri11', fontSize: '12px', color: '#fff6c8', stroke: '#3a2a10', strokeThickness: 3 }).setDepth(DEPTH.fx) : null;
    this.tweens.add({ targets: [ic, tx].filter(Boolean), y: '-=36', alpha: 0, duration: 1100, onComplete: () => { ic.destroy(); tx?.destroy(); } });
  }

  toast(msg) { this.events.emit('toast', msg); }
  emitState() { this.events.emit('state'); }

  // ── main loop ────────────────────────────────────────────────────────────
  update(time, deltaMs) {
    // ?speed=N in the URL fast-forwards the simulation (testing only)
    const steps = WorldScene.SPEED;
    for (let i = 0; i < steps; i++) this.step(Math.min(deltaMs / 1000, 0.05));
    this.drawOverlays();
  }

  step(dt) {
    const k = this.keys;
    const ix = (k.D.isDown || k.RIGHT.isDown) - (k.A.isDown || k.LEFT.isDown);
    const iy = (k.S.isDown || k.DOWN.isDown) - (k.W.isDown || k.UP.isDown);

    if (this.mode === 'direct') {
      const len = Math.hypot(ix, iy) || 1;
      this.moveGM((ix / len) * this.gm.speed, (iy / len) * this.gm.speed, dt);
    } else {
      this.gm.move(0, 0, dt);
      const cam = this.cameras.main, sp = 700 / cam.zoom;
      cam.scrollX += ix * sp * dt; cam.scrollY += iy * sp * dt;
    }

    this.factory.update(dt);
    for (const w of this.workers) w.update(dt, this);
    for (const a of this.adventurers) a.update(dt, this);
    if (this.guild.autoDispatch && this.guild.quests > 0) {
      const idle = this.adventurers.find((a) => a.state === 'idle');
      if (idle) this.dispatch(idle);
    }
  }

  /** Guild master collides with blocked cells and machines (belts are walkable). */
  moveGM(vx, vy, dt) {
    const g = this.gm;
    const free = (x, y) => {
      const cx = Math.floor(x / TILE), cy = Math.floor(y / TILE);
      if (cx < 0 || cy < 0 || cx >= W || cy >= H || this.blockers[cy][cx]) return false;
      const f = this.occ[cy][cx];
      return !f || f.def.kind === 'belt';
    };
    const nx = g.x + vx * dt, ny = g.y + vy * dt;
    const okX = free(nx + Math.sign(vx) * 14, g.y), okY = free(g.x, ny + Math.sign(vy) * 8);
    g.move(okX ? vx : 0, okY ? vy : 0, dt);
    if (!okX && !okY && (vx || vy)) g.move(0, 0, dt);
  }

  drawOverlays() {
    const gr = this.ghostRect, p = this.input.activePointer;
    gr.clear();
    if (this.mode === 'manager' && this.tool) {
      const t = this.tool.type, d = FACILITY_DEFS[t], art = FACILITIES[t];
      const [x, y] = this.toolOrigin(p);
      const ok = this.factory.canPlace(t, x, y) && this.canAfford(d.cost);
      gr.fillStyle(ok ? 0x6cff6c : 0xff5a5a, 0.25).fillRect(x * TILE, y * TILE, d.w * TILE, d.h * TILE);
      gr.lineStyle(2, ok ? 0x6cff6c : 0xff5a5a, 0.9).strokeRect(x * TILE, y * TILE, d.w * TILE, d.h * TILE);
      const cx = (x + d.w / 2) * TILE;
      this.ghost.setVisible(true).setTexture(art.tex, art.frame ?? 0).setScale(art.scale);
      if (t === 'belt') this.ghost.setOrigin(0.5).setPosition(cx, (y + 0.5) * TILE).setAngle(this.tool.dir * 90);
      else this.ghost.setOrigin(0.5, 1).setPosition(cx, (y + d.h) * TILE + (art.oy ?? 0)).setAngle(0);
      // output direction arrow
      if (t !== 'belt' && d.kind !== 'sink') {
        const ang = [0, 90, 180, 270][this.tool.dir] * Math.PI / 180, r = 22;
        const ax = cx + Math.cos(ang) * (d.w * TILE / 2 + 8), ay = (y + d.h / 2) * TILE + Math.sin(ang) * (d.h * TILE / 2 + 8);
        gr.fillStyle(0xffffff, 0.9).fillTriangle(
          ax + Math.cos(ang) * 10, ay + Math.sin(ang) * 10,
          ax + Math.cos(ang + 2.4) * r * 0.6, ay + Math.sin(ang + 2.4) * r * 0.6,
          ax + Math.cos(ang - 2.4) * r * 0.6, ay + Math.sin(ang - 2.4) * r * 0.6,
        );
      }
    } else {
      this.ghost.setVisible(false);
    }
    const sr = this.selRect;
    sr.clear();
    const f = this.selected;
    if (f && this.factory.list.includes(f)) {
      sr.lineStyle(3, 0xfff0a0, 1).strokeRect(f.x * TILE + 1, f.y * TILE + 1, f.w * TILE - 2, f.h * TILE - 2);
    }
  }
}
