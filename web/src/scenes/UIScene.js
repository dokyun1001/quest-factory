import Phaser from 'phaser';
import { FACILITIES, ITEMS, MONSTERS } from '../art/manifest.js';
import { FACILITY_DEFS, ITEM_DEFS, BUILD_MENU, MONSTER_DEFS, RESEARCH, UPGRADES, GUILD } from '../data/defs.js';

const FONT = 'Galmuri11';
const INK = '#3b2a1a';
const T = (size = 12, color = INK, extra = {}) => ({ fontFamily: FONT, fontSize: `${size}px`, color, ...extra });
const STATE_KO = { working: '가동 중', idle: '대기 (재료 없음)', blocked: '정지 (출구 막힘)' };
const ADV_KO = { idle: '대기', out: '이동 중', fight: '전투 중', back: '귀환 중' };

export class UIScene extends Phaser.Scene {
  constructor() { super('UI'); }

  create() {
    this.world = this.scene.get('World');
    this.dirty = true;
    this.modal = null;   // 'codex' | 'adv' | null
    this.hud = this.add.container(0, 0);   // built once, numbers updated in place
    this.dyn = this.add.container(0, 0);   // panels: rebuilt only when layout changes
    this.buildHud();

    this.world.events.on('state', () => { this.dirty = true; });
    this.world.events.on('toast', (m) => this.toast(m));
    this.events.once('shutdown', () => { this.world.events.off('state'); this.world.events.off('toast'); });

    // small FPS counter (helps diagnose lag on players' PCs)
    this.fpsText = this.add.text(1274, 714, '', T(11, '#ffffff', { stroke: '#000000', strokeThickness: 3 })).setOrigin(1, 1).setDepth(100);
    this.toastText = this.add.text(640, 96, '', T(14, '#ffffff', { stroke: '#2a1a0a', strokeThickness: 5, align: 'center' }))
      .setOrigin(0.5).setDepth(100).setAlpha(0);
  }

  hitUI(p) { return this.input.hitTestPointer(p).length > 0; }

  // ── widgets ──────────────────────────────────────────────────────────────
  panel(x, y, w, h, parent = this.dyn) {
    const p = this.add.nineslice(x, y, 'ui_paper', 0, w, h, 28, 28, 20, 21).setOrigin(0);
    p.setInteractive(); // swallow clicks so they don't reach the world
    parent.add(p);
    return p;
  }

  button(x, y, w, label, cb, { red = false, disabled = false, parent = this.dyn, size = 12 } = {}) {
    const h = 48;
    const b = this.add.nineslice(x, y, red ? 'ui_btn_red' : 'ui_btn_blue', 0, w, h, 21, 21, 23, 23).setOrigin(0);
    const t = this.add.text(x + w / 2, y + h / 2 - 2, label, T(size, '#ffffff', { stroke: '#1d2a44', strokeThickness: 3 })).setOrigin(0.5);
    if (disabled) { b.setAlpha(0.45); t.setAlpha(0.6); }
    b.setInteractive({ useHandCursor: !disabled });
    b.on('pointerdown', (p, lx, ly, ev) => { ev.stopPropagation(); if (!disabled) { b.setTint(0xccccdd); cb(); } });
    b.on('pointerup', () => b.clearTint());
    b.on('pointerout', () => b.clearTint());
    parent.add([b, t]);
    return b;
  }

  text(x, y, s, style, parent = this.dyn) {
    const t = this.add.text(x, y, s, style);
    parent.add(t);
    return t;
  }

  icon(item, x, y, scaleMul = 1, parent = this.dyn) {
    const v = ITEMS[item];
    const ui = v.tex.startsWith('ic_') ? 1.5 : 1; // 16px icons ×3 in UI, others ×1
    const s = this.add.image(x, y, v.tex, v.frame ?? 0).setScale((v.scale ?? 1) * ui * scaleMul);
    parent.add(s);
    return s;
  }

  costLine(cost) {
    return Object.entries(cost ?? {}).map(([k, n]) => `${ITEM_DEFS[k].name} ${n}`).join(', ') || '무료';
  }

  toast(msg) {
    this.toastText.setText(msg).setAlpha(1);
    this.tweens.killTweensOf(this.toastText);
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 2200, duration: 500 });
  }

  // ── layout ───────────────────────────────────────────────────────────────
  // Creating Text objects is expensive (each one is a canvas + GPU texture), so:
  //  · HUD numbers: setText only when the value changed (checked 5×/s)
  //  · panels: rebuilt when the layout changes, or ≤3×/s while a live panel is open
  update(time) {
    const w = this.world;
    const sig = [w.mode, w.tool?.type, w.tool?.dir, w.selected ? `${w.selected.x},${w.selected.y},${w.selected.dir}` : '',
      this.modal, this.hover, w.adventurers.length].join('|');
    const livePanel = this.modal || (w.mode === 'manager' && w.selected);
    if (sig !== this.sig || (this.dirty && livePanel && time - (this.lastBuild ?? 0) > 330)) {
      this.sig = sig; this.lastBuild = time; this.dirty = false;
      this.rebuildPanels();
    }
    if (time - (this.lastHud ?? 0) > 200) { this.lastHud = time; this.refreshHud(); }
    if (time - (this.lastFps ?? 0) > 1000) {
      this.lastFps = time;
      const r = this.game.renderer.type === Phaser.WEBGL ? 'WebGL' : 'Canvas';
      this.setIf(this.fpsText, `${Math.round(this.game.loop.actualFps)} FPS · ${r}`);
    }
  }

  rebuildPanels() {
    const w = this.world;
    this.dyn.removeAll(true);
    this.barIcons = [];
    if (w.mode === 'manager') { this.drawBuildBar(w); if (w.selected) this.drawInfo(w, w.selected); }
    else this.drawHint();
    if (this.modal === 'codex') this.drawCodex(w);
    if (this.modal === 'adv') this.drawAdventurers(w);
  }

  setIf(t, v) { if (t.text !== v) t.setText(v); }

  buildHud() {
    const h = this.hud, w = this.world;
    this.panel(6, 6, 330, 170, h);
    this.hudNums = {};
    [['coin', 0], ['wood', 1], ['gold_ore', 2]].forEach(([k, i]) => {
      this.icon(k, 46 + i * 100, 44, 1, h);
      this.hudNums[k] = this.text(76 + i * 100, 36, '0', T(16), h);
    });
    ['loot_shadow', 'loot_violet', 'loot_crimson'].forEach((k, i) => {
      this.icon(k, 46 + i * 100, 84, 0.67, h);
      this.hudNums[k] = this.text(76 + i * 100, 76, '0', T(16), h);
    });
    this.hudLine1 = this.text(28, 112, '', T(12), h);
    this.hudLine2 = this.text(28, 134, '', T(12), h);
    this.panel(860, 6, 414, 128, h);
    this.hudMode = this.text(1067, 32, '', T(16)).setOrigin(0.5); h.add(this.hudMode);
    this.text(1067, 52, 'Tab 키로 모드 전환', T(11, '#6a5a44'), h).setOrigin(0.5);
    this.button(872, 68, 92, '도감', () => this.toggleModal('codex'), { parent: h });
    this.button(970, 68, 92, '모험가', () => this.toggleModal('adv'), { parent: h });
    this.button(1068, 68, 92, '저장', () => w.save(), { parent: h });
    this.button(1166, 68, 96, '새 게임', () => {
      if (window.confirm('저장 데이터를 지우고 새 게임을 시작할까요?')) w.resetGame();
    }, { red: true, parent: h });
    this.refreshHud();
  }

  refreshHud() {
    const w = this.world, g = w.guild, st = g.stock;
    for (const [k, t] of Object.entries(this.hudNums)) this.setIf(t, `${st[k] ?? 0}`);
    const next = GUILD.expPerLevel[g.level] ?? null;
    this.setIf(this.hudLine1, `길드 Lv ${g.level}   경험치 ${g.exp}${next ? ` / ${next}` : ' (최대)'}`);
    this.setIf(this.hudLine2, `게시된 의뢰 ${g.quests}   연구 기록 ${g.notes}   완료 ${g.completed}`);
    const direct = w.mode === 'direct';
    if (this.hudMode.text !== (direct ? '직접 조작 모드' : '관리자 모드')) {
      this.hudMode.setText(direct ? '직접 조작 모드' : '관리자 모드').setColor(direct ? '#2b5a2b' : '#7a3a12');
    }
    for (const [type, im] of this.barIcons ?? []) im.setAlpha(w.canAfford(FACILITY_DEFS[type].cost) ? 1 : 0.4);
  }

  toggleModal(m) { this.modal = this.modal === m ? null : m; }

  drawHint() {
    this.panel(280, 650, 720, 64);
    this.text(640, 680, 'WASD/방향키 이동   E·Space 채집(나무·금광)   Tab 관리자 모드(건설)', T(12)).setOrigin(0.5);
  }

  drawBuildBar(w) {
    const n = BUILD_MENU.length, slot = 64, gap = 10;
    const total = n * (slot + gap) - gap + 40;
    const x0 = 640 - total / 2;
    this.panel(x0, 600, total, 116);
    BUILD_MENU.forEach((type, i) => {
      const x = x0 + 20 + i * (slot + gap), y = 616;
      const on = w.tool?.type === type;
      const afford = w.canAfford(FACILITY_DEFS[type].cost);
      const fr = this.add.image(x, y, 'kenney', on ? 0 : 1).setOrigin(0).setScale(2);
      fr.setInteractive({ useHandCursor: true });
      fr.on('pointerdown', (p, lx, ly, ev) => { ev.stopPropagation(); w.setTool(on ? null : type); });
      fr.on('pointerover', () => { this.hover = type; });
      fr.on('pointerout', () => { if (this.hover === type) this.hover = null; });
      const ic = FACILITIES[type].icon;
      const im = this.add.image(x + slot / 2, y + slot / 2, ic.tex, ic.frame ?? 0).setScale(ic.scale);
      if (!afford) im.setAlpha(0.4);
      this.barIcons.push([type, im]);
      this.dyn.add([fr, im]);
      this.text(x + slot / 2, y + slot + 4, `${i + 1}`, T(11, '#6a5a44')).setOrigin(0.5, 0);
    });
    const t = this.hover ?? w.tool?.type;
    const info = t
      ? `${FACILITY_DEFS[t].name} — ${FACILITY_DEFS[t].desc}  [비용: ${this.costLine(FACILITY_DEFS[t].cost)}]`
      : '시설을 고르세요 · 좌클릭 설치/선택 · 우클릭 철거 · R/Q 회전 · 휠 확대/축소 · WASD 시점 이동';
    const bg = this.add.rectangle(640, 588, Math.min(1260, info.length * 8 + 40), 26, 0x2a1d10, 0.85);
    this.dyn.add(bg);
    this.text(640, 588, info, T(12, '#fff4d6')).setOrigin(0.5);
  }

  drawInfo(w, f) {
    const d = f.def, x = 960, y = 140, pw = 314;
    this.panel(x, y, pw, d.kind === 'machine' ? 330 : 230);
    this.text(x + 24, y + 26, `${d.name}${f.level > 1 ? `  ★${f.level}` : ''}`, T(16));
    this.text(x + 24, y + 52, d.desc, T(11, '#5a4a34', { wordWrap: { width: pw - 48 } }));
    let yy = y + 96;
    if (d.kind === 'machine') {
      this.text(x + 24, yy, `상태: ${STATE_KO[f.state]}`, T(12)); yy += 22;
      const inb = Object.entries(f.inBuf).filter(([, n]) => n > 0).map(([k, n]) => `${ITEM_DEFS[k].name}×${n}`).join(', ') || '없음';
      const outb = Object.entries(f.outBuf).filter(([, n]) => n > 0).map(([k, n]) => `${ITEM_DEFS[k].name}×${n}`).join(', ') || '없음';
      this.text(x + 24, yy, `투입: ${inb}`, T(11)); yy += 20;
      this.text(x + 24, yy, `산출: ${outb}`, T(11)); yy += 20;
      this.text(x + 24, yy, `속도: ×${UPGRADES.speed[f.level - 1]} (강화 Lv${f.level}/${UPGRADES.maxLevel})`, T(11)); yy += 28;
      if (f.level < UPGRADES.maxLevel) {
        const cost = UPGRADES.cost[f.level];
        this.text(x + 24, yy, `전리품 강화 비용: ${this.costLine(cost)}`, T(11, '#7a3a12')); yy += 22;
        this.button(x + 24, yy, 130, '전리품 강화', () => w.upgradeSelected(), { disabled: !w.canAfford(cost) });
      } else {
        this.text(x + 24, yy, '최대 강화 완료', T(12, '#7a3a12'));
      }
    } else if (d.kind === 'source') {
      this.text(x + 24, yy, '꺼낼 자원:', T(12));
      this.icon(f.filter, x + 120, yy + 6);
      this.text(x + 140, yy, `${ITEM_DEFS[f.filter].name} (창고 ${w.guild.stock[f.filter] ?? 0})`, T(12));
      yy += 30;
      this.button(x + 24, yy, 130, '자원 변경', () => w.cycleFilter(f));
    } else if (d.kind === 'sink') {
      this.text(x + 24, yy, '받는 물품: 의뢰서, 경험치 결정, 연구 기록', T(11, INK, { wordWrap: { width: pw - 48 } }));
    }
    const by = y + (d.kind === 'machine' ? 330 : 230) - 64;
    if (d.kind !== 'sink') this.button(x + 24, by, 80, '회전', () => w.rotate());
    this.button(x + pw - 124, by, 100, '철거', () => { w.refund(d.cost); w.factory.remove(f); w.select(null); }, { red: true });
  }

  drawCodex(w) {
    const g = w.guild, x = 240, y = 130, pw = 800, ph = 440;
    this.panel(x, y, pw, ph);
    this.text(x + pw / 2, y + 30, '몬스터 도감 · 연구', T(18)).setOrigin(0.5);
    this.text(x + pw / 2, y + 54, `연구 기록 보유: ${g.notes}  — 모험가가 토벌하면 도감에 등록되고, 전리품과 연구 기록으로 연구하면 길드 전체가 강해집니다.`, T(11, '#5a4a34')).setOrigin(0.5);
    Object.entries(MONSTER_DEFS).forEach(([id, m], i) => {
      const cx = x + 40, cy = y + 90 + i * 110;
      const c = g.codex[id];
      const lv = g.research[id] ?? 0;
      const art = MONSTERS[id];
      const spr = this.add.sprite(cx + 50, cy + 52, w.anims.get(art.idle).frames[0].textureKey, 0).setScale(0.5);
      spr.setTint(c?.found ? art.tint : 0x000000).setAlpha(c?.found ? 1 : 0.5);
      this.dyn.add(spr);
      this.text(cx + 110, cy + 8, c?.found ? `${m.name}  (등급 ${m.tier} · 처치 ${c.kills})` : `??? (미발견 · 등급 ${m.tier}${m.tier > g.level ? ` · 길드 Lv${m.tier} 필요` : ''})`, T(14));
      this.text(cx + 110, cy + 32, c?.found ? m.desc : '아직 만나지 못한 몬스터입니다.', T(11, '#5a4a34'));
      this.text(cx + 110, cy + 54, `연구 Lv ${lv}/${RESEARCH.maxLevel} · 효과: ${m.bonus.label} (현재 +${Math.round(lv * m.bonus.per * 100)}%)`, T(11));
      if (c?.found) this.icon(m.loot, cx + 118, cy + 84);
      if (c?.found && lv < RESEARCH.maxLevel) {
        const cost = `연구 기록 ${RESEARCH.notes[lv]}, ${ITEM_DEFS[m.loot].name} ${RESEARCH.loot[lv]}`;
        this.text(cx + 136, cy + 76, `다음 연구: ${cost}`, T(11, '#7a3a12'));
        const ok = g.notes >= RESEARCH.notes[lv] && (g.stock[m.loot] ?? 0) >= RESEARCH.loot[lv];
        this.button(x + pw - 170, cy + 28, 130, '연구하기', () => w.research(id), { disabled: !ok });
      }
    });
    this.button(x + pw - 70, y + 14, 50, 'X', () => this.toggleModal('codex'), { red: true });
  }

  drawAdventurers(w) {
    const g = w.guild, x = 330, y = 140, pw = 620, ph = 120 + w.adventurers.length * 46 + 60;
    this.panel(x, y, pw, ph);
    this.text(x + pw / 2, y + 30, '모험가 파견', T(18)).setOrigin(0.5);
    this.text(x + pw / 2, y + 54, `게시된 의뢰 ${g.quests}건 · 길드 Lv${g.level} 정원 ${GUILD.maxAdventurers[g.level - 1]}명`, T(11, '#5a4a34')).setOrigin(0.5);
    w.adventurers.forEach((a, i) => {
      const yy = y + 80 + i * 46;
      const job = { warrior: '전사', archer: '궁수', monk: '수도승' }[a.info.kind];
      this.text(x + 40, yy + 12, `${a.info.name} (${job})`, T(13));
      const where = a.quest ? ` → ${MONSTER_DEFS[a.quest.target].name}` : '';
      this.text(x + 220, yy + 12, `${ADV_KO[a.state]}${where}`, T(12, '#5a4a34'));
      if (a.state === 'idle') this.button(x + pw - 160, yy, 120, '파견', () => w.dispatch(a), { disabled: g.quests <= 0 });
    });
    const by = y + ph - 62;
    this.button(x + 40, by, 220, g.autoDispatch ? '자동 파견: 켜짐' : '자동 파견: 꺼짐', () => { g.autoDispatch = !g.autoDispatch; this.dirty = true; });
    this.button(x + pw - 100, y + 14, 50, 'X', () => this.toggleModal('adv'), { red: true });
  }
}
