import Phaser from 'phaser';
import { ZOOMS, DEFAULT_ZOOM } from '../core/config.js';
import { OPP, CW, VEC, dirBetween } from '../core/dir.js';
import { B } from '../data/balance.js';
import { ITEMS } from '../data/items.js';
import { FACILITIES } from '../data/facilities.js';
import { CODEX } from '../data/codex.js';
import { MONSTERS } from '../data/monsters.js';
import { createMainWorld, createCombatLab, createPerfLab } from '../sim/maps.js';
import { NODES, DEPOSITS, TERRAIN } from '../sim/world.js';
import { Game } from '../sim/game.js';
import { Inventory } from '../sim/inventory.js';
import { sanitizeAppearance } from '../data/appearance.js';
import { WorldView } from '../render/worldView.js';
import { LogisticsRenderer } from '../render/logisticsRenderer.js';
import { UnitView } from '../render/unitView.js';
import { CharComposer } from '../render/charComposer.js';
import { Character } from '../render/characters.js';
import { loadSave, writeSave, loadSettings } from '../core/save.js';
import { ui } from '../ui/ui.js';

const T = 16;
export const MODES = {
  main: { name: 'TEST A — 기초 공장·의뢰 순환', save: true, dev: false },
  sandbox: { name: '개발자 샌드박스 (TEST A 월드)', save: true, dev: true },
  combat: { name: 'TEST B — 전투·지휘 실험실', save: true, dev: true },
  perf: { name: 'TEST E — 성능 실험실', save: false, dev: true },
};

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }
  init(data) { this.cfg = data; }

  create() {
    const { mode, load, appearance } = this.cfg;
    this.mode = mode; this.modeDef = MODES[mode];
    this.settings = loadSettings();
    const world = mode === 'combat' ? createCombatLab() : mode === 'perf' ? createPerfLab() : createMainWorld();
    const game = new Game(world, { seed: 7000 + Object.keys(MODES).indexOf(mode), kind: mode });
    this.game = game; this.world = world;
    this.inv = new Inventory();
    const saved = load ? loadSave(mode) : null;
    if (saved) { game.restore(saved.game); this.inv.restore(saved.inv); }
    else this.setupNew();
    if (this.modeDef.dev) game.dev.labMode = true;

    this.composer = new CharComposer(this);
    this.wv = new WorldView(this, game);
    this.logi = new LogisticsRenderer(this, world);
    this.logi.setItemSize(this.settings.itemSize || 10);
    this.uv = new UnitView(this, game, this.composer);
    this.portGfx = this.add.graphics().setDepth(2.5);
    const sp = saved?.player;
    const app = sanitizeAppearance(saved?.appearance || appearance);
    this.player = new Character(this, this.composer, app, sp ? sp.x : (world.spawn.x + 0.5) * T, sp ? sp.y : (world.spawn.y + 1) * T - 2);
    if (sp?.facing) this.player.facing = sp.facing;
    world.reveal(this.player.x / T, this.player.y / T, mode === 'main' || mode === 'sandbox' ? B.world.startRevealRadius : 8);

    const cam = this.cameras.main;
    cam.setBackgroundColor('#0b0d0c'); cam.setBounds(0, 0, world.w * T, world.h * T); cam.setRoundPixels(true);
    this.zoomIdx = ZOOMS.indexOf(saved?.zoom) >= 0 ? ZOOMS.indexOf(saved.zoom) : ZOOMS.indexOf(DEFAULT_ZOOM);
    cam.setZoom(ZOOMS[this.zoomIdx]);
    cam.startFollow(this.player.sprite, true, 1, 1, 0, 12);
    this.manager = false; this.follow = null;
    this.rot = 'E';
    this.ghost = this.add.image(0, 0, 'atlas', 'belt_WE_0').setOrigin(0, 0).setAlpha(0.65).setDepth(4).setVisible(false);
    this.cursorGfx = this.add.graphics().setDepth(4.5);
    this.dragging = null;
    this.setupInput();
    this.acc = 0; this.simMs = 0; this.frameMs = 0; this.saveTimer = 0; this.hudTimer = 0; this.gatherCd = 0; this.lastSteps = 0;
    this.pointerScreen = { x: -1, y: -1 };
    game.events.on('toast', (m, k) => ui.toast(m, k));
    game.events.on('tech', () => ui.refresh());
    game.events.on('telegraph', (m, t) => { if (this.near(m, 18)) ui.toast(`⚠ ${MONSTERS[m.type].name}: ${t.name} 준비 (${t.windup}초)`, 'boss'); });
    ui.enterGame(this);
    this.events.once('shutdown', () => this.cleanup());
    window.__qf = this;
  }
  setupNew() {
    const g = this.game, w = this.world;
    if (this.mode === 'main') {
      ui.toast('TEST A 시작: 나무와 돌을 모아(E) 제작(C)하고 소형 채굴기를 설치해 보세요.', 'tip');
    }
    if (this.mode === 'sandbox') {
      g.dev.allRecipes = true; for (const t of ['logistics', 'schooling', 'alchemy', 'iron_arms', 'recycling', 'natural_power']) g.guild.tech.add(t);
      for (const [k, n] of Object.entries({ wood: 99, stone: 99, coal: 60, iron_ingot: 60, belt_1: 99, fac_small_miner: 6, fac_furnace: 3, fac_chest: 6, fac_quest_board: 1, fac_shop: 1, fac_counter: 1, fac_lab: 1 })) this.inv.add(k, n);
    }
    if (this.mode === 'combat') {
      w.placeFacility('quest_board', 8, 22); const shop = w.placeFacility('shop', 12, 22, 'E'); w.placeFacility('counter', 8, 26, 'S');
      shop.stock = { sword_wood: 4, staff_wood: 4, bow_wood: 4, mace_wood: 4, armor_leather: 4, potion_hp: 10 };
      g.dev.allSkills = true; g.guild.cmd.scope = 'all';
    }
  }
  near(e, r) { return (e.x - this.player.x / T) ** 2 + (e.y - this.player.y / T) ** 2 < r * r; }

  // ---------------- input ----------------
  setupInput() {
    const kb = this.input.keyboard;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT');
    kb.addCapture('TAB,F1,F2,F3,F10');
    kb.on('keydown', (e) => this.onKey(e));
    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', (p) => this.onDown(p));
    this.input.on('pointermove', (p) => this.onMove(p));
    this.input.on('pointerup', () => { this.dragging = null; });
    this.input.on('wheel', (p, o, dx, dy) => this.zoomBy(dy > 0 ? -1 : 1, p));
  }
  onKey(e) {
    if (ui.typing()) return;
    const k = e.key;
    if (k === 'Escape') { if (!ui.closeTop()) { this.inv.sel = -1; this.refreshTool(); } return; }
    if (ui.modalOpen()) { if (k === 'c' || k === 'C' || k === 'g' || k === 'G' || k === 'i' || k === 'I') ui.closeTop(); return; }
    if (k === 'Tab') { e.preventDefault(); this.toggleManager(); }
    else if (/^[0-9]$/.test(k)) { const i = k === '0' ? 9 : +k - 1; this.inv.sel = this.inv.sel === i ? -1 : i; this.refreshTool(); }
    else if (k === 'r' || k === 'R') { if (ui.inspTarget?.fac && !this.tool()) { this.world.rotateFacility(ui.inspTarget.fac); } else { this.rot = CW[this.rot]; ui.refreshHud(); } }
    else if (k === 'e' || k === 'E') this.interact();
    else if (k === 'c' || k === 'C') ui.openCraft();
    else if (k === 'g' || k === 'G') ui.openGuild();
    else if (k === 'i' || k === 'I') ui.openInventory();
    else if (k === 'q' || k === 'Q') { this.inv.sel = -1; this.refreshTool(); ui.inspect(null); }
    else if (k === 'F3') { e.preventDefault(); ui.toggleDebug(); }
    else if (k === 'F10') { e.preventDefault(); if (this.modeDef.dev) ui.openDev(); else ui.toast('개발자 메뉴는 실험실/샌드박스 모드에서만 사용할 수 있습니다 (일반 저장 보호).'); }
    else if (k === '+' || k === '=') this.zoomBy(1);
    else if (k === '-') this.zoomBy(-1);
  }
  tool() {
    const s = this.inv.selected(); if (!s) return null;
    const it = ITEMS[s.id]; if (!it) return null;
    if (it.place === 'belt') return { kind: 'belt', item: s.id, tier: it.tier };
    if (it.place === 'facility') return { kind: 'fac', item: s.id, fac: it.facility };
    return null;
  }
  refreshTool() { ui.refreshHud(); ui.renderHotbar(); this.refreshDirs(); }
  refreshDirs() { this.logi.setShowDirs(this.manager || !!this.tool() || this.settings.dirsInDirect); this.drawPorts(); }
  drawPorts() {
    const g = this.portGfx; g.clear();
    if (!this.manager && !this.tool()) return;
    for (const f of this.world.facilities.values()) for (const p of this.world.portsOf(f)) {
      const cx = (p.tx + 0.5 + VEC[p.edge][0] * 0.5) * T, cy = (p.ty + 0.5 + VEC[p.edge][1] * 0.5) * T;
      const col = p.kind === 'out' ? 0x7be08a : p.role === 'fuel' ? 0xffa040 : 0x76b7ff;
      g.fillStyle(col, 1).fillRect(cx - 1.5, cy - 1.5, 3, 3);
    }
  }
  toggleManager() {
    this.manager = !this.manager; this.follow = null;
    const cam = this.cameras.main;
    if (this.manager) cam.stopFollow(); else cam.startFollow(this.player.sprite, true, 1, 1, 0, 12);
    this.player.moving = false; ui.refreshHud(); this.refreshDirs();
  }
  followUnit(u) { this.follow = u; if (!this.manager) this.toggleManager(); this.follow = u; ui.toast(`${u.p.name} 추적 중 (Tab: 해제)`); }
  zoomBy(d, p) {
    const ni = Phaser.Math.Clamp(this.zoomIdx + d, 0, ZOOMS.length - 1); if (ni === this.zoomIdx) return;
    const cam = this.cameras.main; const before = p ? cam.getWorldPoint(p.x, p.y) : null;
    this.zoomIdx = ni; cam.setZoom(ZOOMS[ni]);
    if (before && this.manager && !this.follow) { const after = cam.getWorldPoint(p.x, p.y); cam.scrollX += before.x - after.x; cam.scrollY += before.y - after.y; }
    ui.refreshHud();
  }
  tileAt(p) { const w = this.cameras.main.getWorldPoint(p.x, p.y); return [Math.floor(w.x / T), Math.floor(w.y / T), w.x / T, w.y / T]; }
  free() { return this.modeDef.dev && this.game.dev.freeBuild; }
  onDown(p) {
    if (ui.modalOpen()) return;
    const [tx, ty, wx, wy] = this.tileAt(p);
    const tool = this.tool();
    if (p.middleButtonDown() || (p.rightButtonDown() && !tool && this.manager)) { this.dragging = { pan: true, sx: p.x, sy: p.y, cx: this.cameras.main.scrollX, cy: this.cameras.main.scrollY }; this.follow = null; return; }
    if (p.rightButtonDown()) { this.deconstruct(tx, ty); this.dragging = { del: true, tx, ty }; return; }
    if (ui.cmdPlacing) { this.game.command(ui.cmdPlacing, { x: wx, y: wy }); ui.toast(`명령: ${ui.cmdPlacing === 'rally' ? '집결' : '위치 지정'} (${wx.toFixed(0)}, ${wy.toFixed(0)})`); ui.cmdPlacing = null; return; }
    if (!tool) {
      const u = this.uv.pick(wx, wy); if (u) { this.uv.selected = u; ui.inspect({ unit: u }); return; }
      const m = this.uv.pickMonster(wx, wy); if (m) { ui.inspect({ monster: m }); if (ui.focusPick) { this.game.command('focus', { target: m }); ui.focusPick = false; ui.toast(`집중 공격 대상: ${MONSTERS[m.type].name}`); } return; }
      const f = this.world.facAt(tx, ty); if (f) { ui.inspect({ fac: f }); return; }
      const b = this.world.beltAt(tx, ty); if (b) { ui.inspect({ belt: b }); return; }
      ui.inspect(null); return;
    }
    if (!this.world.isExplored(tx, ty)) { ui.toast('탐험하지 않은 곳에는 건설할 수 없습니다.'); return; }
    if (tool.kind === 'belt') { if (this.placeBeltAt(tx, ty, this.rot, tool)) this.dragging = { belt: true, tx, ty }; return; }
    this.placeFacAt(tx, ty, tool);
  }
  placeBeltAt(x, y, dir, tool) {
    if (!this.free() && this.inv.count(tool.item) < 1) { ui.toast(`${ITEMS[tool.item].name}이(가) 없습니다.`); return false; }
    const ex = this.world.beltAt(x, y);
    const r = this.world.placeBelt(x, y, dir, tool.tier);
    if (!r) { ui.toast('여기에는 컨베이어를 놓을 수 없습니다.'); return false; }
    if (!r.same && (!ex || ex.tier !== tool.tier) && !this.free()) this.inv.remove(tool.item, 1);
    if (r.refund && !this.free()) this.giveAll(r.refund);
    ui.renderHotbar();
    return true;
  }
  placeFacAt(tx, ty, tool) {
    const def = FACILITIES[tool.fac];
    if (!this.free() && this.inv.count(tool.item) < 1) { ui.toast(`${def.name}이(가) 없습니다.`); return; }
    const [ox, oy] = this.facOrigin(tx, ty, def);
    const chk = this.world.canPlaceFacility(tool.fac, ox, oy, this.rot);
    if (!chk.ok) { ui.toast(chk.why); return; }
    for (let y = 0; y < def.footprint[1]; y++) for (let x = 0; x < def.footprint[0]; x++) if (this.player.occupiesTile(ox + x, oy + y)) { ui.toast('길드마스터가 서 있는 자리입니다.'); return; }
    const f = this.world.placeFacility(tool.fac, ox, oy, this.rot);
    if (f && !this.free()) this.inv.remove(tool.item, 1);
    if (f && def.kind === 'miner') ui.toast(`${def.name}: ${ITEMS[f.mineType].name} 채굴 · 출력 ${this.rot} (${B.industry.minerSec}초/개)`);
    ui.renderHotbar(); this.drawPorts();
  }
  facOrigin(tx, ty, def) { return def.footprint[0] === 2 ? [tx, ty - 1] : [tx, ty]; }
  deconstruct(tx, ty) {
    const f = this.world.facAt(tx, ty);
    if (f) { if (ui.inspTarget?.fac === f) ui.inspect(null); const r = this.world.removeFacility(f); if (!this.free()) this.giveAll(r); ui.renderHotbar(); this.drawPorts(); return; }
    const r = this.world.removeBelt(tx, ty);
    if (r && !this.free()) this.giveAll(r);
    if (r) ui.renderHotbar();
  }
  // items that do not fit go to the guild holding box (never silently lost)
  giveAll(map) {
    let over = 0; const box = (this.game.guild.overflow ||= {});
    for (const [k, n] of Object.entries(map || {})) { const left = this.inv.add(k, n); if (left) { box[k] = (box[k] || 0) + left; over += left; } }
    if (over) ui.toast(`인벤토리가 가득 차 ${over}개를 길드 보관함으로 보냈습니다 (인벤토리 화면에서 회수).`);
  }
  onMove(p) {
    this.pointerScreen.x = p.x; this.pointerScreen.y = p.y;
    const d = this.dragging; if (!d) return;
    if (d.pan) { const z = this.cameras.main.zoom; this.cameras.main.scrollX = d.cx - (p.x - d.sx) / z; this.cameras.main.scrollY = d.cy - (p.y - d.sy) / z; return; }
    if (!p.isDown) { this.dragging = null; return; }
    const [tx, ty] = this.tileAt(p);
    if (tx === d.tx && ty === d.ty) return;
    if (d.del) { this.deconstruct(tx, ty); d.tx = tx; d.ty = ty; return; }
    if (d.belt) {
      const tool = this.tool(); if (!tool || tool.kind !== 'belt') { this.dragging = null; return; }
      let guard = 0;
      while ((d.tx !== tx || d.ty !== ty) && guard++ < 64) {
        const nx = d.tx !== tx ? d.tx + Math.sign(tx - d.tx) : d.tx, ny = d.tx !== tx ? d.ty : d.ty + Math.sign(ty - d.ty);
        const dir = dirBetween(d.tx, d.ty, nx, ny);
        this.world.placeBelt(d.tx, d.ty, dir, this.world.beltAt(d.tx, d.ty)?.tier ?? tool.tier); this.rot = dir;
        if (!this.world.isExplored(nx, ny) || !this.placeBeltAt(nx, ny, dir, tool)) { this.dragging = null; break; }
        d.tx = nx; d.ty = ny;
      }
      ui.refreshHud();
    }
  }
  interact() {
    if (this.manager || this.gatherCd > 0) return;
    const W = this.world, g = this.game;
    const px = this.player.x / T, py = (this.player.y - 3) / T;
    const fv = VEC[this.player.facing];
    const cands = [[Math.floor(px + fv[0] * 0.9), Math.floor(py + fv[1] * 0.9)], [Math.floor(px), Math.floor(py)]];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) cands.push([Math.floor(px) + dx, Math.floor(py) + dy]);
    for (const t of W.treasures) if (!t.taken && Math.hypot(t.x + 0.5 - px, t.y + 0.5 - py) < 1.6) {
      t.taken = true; g.ledger.inject(t.gold, 'treasure'); g.codexAdd('treasure'); ui.toast(`보물 상자: 길드 자금 +${t.gold}G (탐험 보상, 외부 유입으로 기록)`, 'discover'); return;
    }
    for (const [x, y] of cands) {
      if (!W.inBounds(x, y)) continue; const i = W.idx(x, y); let got = null, n = 1;
      if (W.tree[i] === 1) { W.chopTree(x, y); got = 'wood'; n = 3; g.codexAdd('tree'); }
      else if (W.node[i]) { if ((g.nodeCd?.get(i) || 0) > g.time) { ui.toast('아직 다시 자라는 중입니다.'); return; } (g.nodeCd ||= new Map()).set(i, g.time + 20); got = NODES[W.node[i]]; n = 2; }
      else if (W.deposit[i] && W.explored[i] && !W.occ[i]) got = DEPOSITS[W.deposit[i]];
      else if (W.terrain[i] === TERRAIN.WATER) got = 'water';
      else if (W.terrain[i] === TERRAIN.SAND) got = 'sand';
      if (got) {
        const lost = this.inv.add(got, n); if (CODEX[got]) g.codexAdd(got);
        this.gatherCd = B.player.gatherCd; ui.toast(lost ? '인벤토리가 가득 찼습니다.' : `${ITEMS[got].name} +${n}`, 'gather'); ui.renderHotbar(); return;
      }
    }
    const f = W.facAt(cands[0][0], cands[0][1]); if (f) { ui.inspect({ fac: f }); return; }
    ui.toast('주변에 채집할 대상이 없습니다 (나무·광맥·풀·물가 옆에서 E).');
  }

  // ---------------- save ----------------
  save(manual = false) {
    if (!this.modeDef.save) { if (manual) ui.toast('성능 실험실은 저장하지 않습니다 (저장 시간 측정은 개발자 메뉴).'); return 0; }
    const t0 = performance.now();
    const bytes = writeSave(this.mode, {
      game: this.game.serialize(), inv: this.inv.serialize(),
      player: { x: Math.round(this.player.x * 10) / 10, y: Math.round(this.player.y * 10) / 10, facing: this.player.facing },
      appearance: this.player.appearance, zoom: ZOOMS[this.zoomIdx],
    });
    this.lastSave = { bytes, ms: performance.now() - t0 };
    if (manual) ui.toast(bytes ? `저장했습니다 (${(bytes / 1024).toFixed(1)} KB, ${this.lastSave.ms.toFixed(0)} ms)` : '저장 실패 (브라우저 저장 공간 부족 가능)');
    return bytes;
  }

  // ---------------- loop ----------------
  update(time, delta) {
    const t0 = performance.now();
    const dt = Math.min(delta, 100) / 1000;
    const g = this.game; const SDT = 1 / B.time.simHz;
    if (!ui.paused) this.acc += Math.min(delta, 250) / 1000 * g.timeScale;
    let steps = 0; const s0 = performance.now(); const maxSteps = Math.max(8, Math.min(400, Math.ceil(g.timeScale * 2)));
    while (this.acc >= SDT && steps < maxSteps) { g.tick(SDT); this.acc -= SDT; steps++; if (performance.now() - s0 > 40) break; }
    if (this.acc > SDT * maxSteps) this.acc = 0;
    this.lastSteps = steps;
    const sm = performance.now() - s0; this.simMs = this.simMs * 0.9 + sm * 0.1;
    this.gatherCd = Math.max(0, this.gatherCd - dt);
    // player
    const K = this.keys; let mx = (K.D.isDown || K.RIGHT.isDown ? 1 : 0) - (K.A.isDown || K.LEFT.isDown ? 1 : 0); let my = (K.S.isDown || K.DOWN.isDown ? 1 : 0) - (K.W.isDown || K.UP.isDown ? 1 : 0);
    if (ui.modalOpen() || ui.typing()) { mx = 0; my = 0; }
    const cam = this.cameras.main;
    if (this.manager) {
      if (this.follow && g.units.has(this.follow.id)) cam.centerOn(this.follow.x * T, this.follow.y * T);
      else { const sp = (K.SHIFT.isDown ? 1400 : 700) / cam.zoom * dt; cam.scrollX += mx * sp; cam.scrollY += my * sp; if (mx || my) this.follow = null; }
      this.player.moving = false;
    } else {
      const p = this.player; p.moving = !!(mx || my);
      if (p.moving) {
        const len = Math.hypot(mx, my); const sp = B.player.speed * T * dt / len;
        p.facing = mx > 0 ? 'E' : mx < 0 ? 'W' : my > 0 ? 'S' : 'N';
        p.move(this.world, mx * sp, my * sp);
        this.world.reveal(p.x / T, p.y / T, B.player.revealRadius);
      }
    }
    g.gm.x = this.player.x / T; g.gm.y = this.player.y / T;
    // render
    const v = cam.worldView;
    const view = { x0: Math.floor(v.x / T) - 1, y0: Math.floor(v.y / T) - 1, x1: Math.ceil((v.x + v.width) / T) + 1, y1: Math.ceil((v.y + v.height) / T) + 1 };
    this.wv.update(delta, view);
    this.logi.update(delta, view);
    this.uv.update(delta, cam);
    this.player.render(delta, true);
    this.updateGhost();
    this.hudTimer += delta;
    if (this.hudTimer > 150) { this.hudTimer = 0; this.updateHover(); ui.tick(this); }
    this.saveTimer += dt;
    if (this.saveTimer > 30) { this.saveTimer = 0; this.save(false); }
    this.frameMs = this.frameMs * 0.9 + (performance.now() - t0) * 0.1;
  }
  updateGhost() {
    const gfx = this.cursorGfx; gfx.clear();
    const tool = this.tool();
    if (!tool || this.pointerScreen.x < 0 || ui.modalOpen()) { this.ghost.setVisible(false); return; }
    const [tx, ty] = this.tileAt(this.input.activePointer);
    if (tool.kind === 'belt') {
      this.ghost.setTexture('atlas', `belt_${OPP[this.rot]}${this.rot}_0`).setPosition(tx * T, ty * T).setVisible(!this.world.beltAt(tx, ty) || this.world.beltAt(tx, ty).tier !== tool.tier);
      const ok = this.world.canPlaceBelt(tx, ty) && this.world.isExplored(tx, ty);
      this.ghost.setTint(ok ? 0xffffff : 0xff6060);
      gfx.lineStyle(1, ok ? 0xfff2a8 : 0xff5a5a, 1).strokeRect(tx * T + 0.5, ty * T + 0.5, T - 1, T - 1); return;
    }
    const def = FACILITIES[tool.fac]; const [ox, oy] = this.facOrigin(tx, ty, def);
    const fake = { x: ox, y: oy, rot: this.rot, type: tool.fac };
    if (def.placeholder) this.ghost.setTexture('ph7', `fac_${tool.fac}`); else this.ghost.setTexture('atlas', def.art(fake, 'off', 0));
    this.ghost.setPosition(ox * T, oy * T + def.footprint[1] * T - def.imageSize[1]).setVisible(true);
    const ok = this.world.canPlaceFacility(tool.fac, ox, oy, this.rot).ok && this.world.isExplored(tx, ty);
    this.ghost.setTint(ok ? 0xffffff : 0xff6060);
    gfx.lineStyle(1, ok ? 0xfff2a8 : 0xff5a5a, 1).strokeRect(ox * T + 0.5, oy * T + 0.5, def.footprint[0] * T - 1, def.footprint[1] * T - 1);
    // port preview (output direction visible before placing)
    for (const p of def.ports(this.rot)) {
      const cx = (ox + p.tile[0] + 0.5 + VEC[p.edge][0] * 0.5) * T, cy = (oy + p.tile[1] + 0.5 + VEC[p.edge][1] * 0.5) * T;
      gfx.fillStyle(p.kind === 'out' ? 0x7be08a : p.role === 'fuel' ? 0xffa040 : 0x76b7ff, 1).fillRect(cx - 2, cy - 2, 4, 4);
      if (p.kind === 'out') gfx.lineStyle(1, 0x7be08a, 1).lineBetween(cx, cy, cx + VEC[p.edge][0] * 7, cy + VEC[p.edge][1] * 7);
    }
  }
  updateHover() {
    const p = this.input.activePointer;
    if (this.pointerScreen.x < 0 || ui.modalOpen()) { ui.tooltip(null); return; }
    const [tx, ty, wx, wy] = this.tileAt(p);
    if (!this.world.isExplored(tx, ty)) { ui.tooltip('미탐험 지역', p.x, p.y); return; }
    const it = this.logi.itemNear(wx * T, wy * T, 7); if (it) { ui.tooltip(ITEMS[it].name, p.x, p.y); return; }
    const u = this.uv.pick(wx, wy); if (u) { ui.tooltip(`${u.p.name} · ${B.jobs[u.p.job].name} Lv.${u.p.level} (${stateName(u.state)})`, p.x, p.y); return; }
    const m = this.uv.pickMonster(wx, wy); if (m) { ui.tooltip(`${MONSTERS[m.type].name} (임시 그래픽) ${Math.ceil(m.hp)}/${m.maxHp}`, p.x, p.y); return; }
    const f = this.world.facAt(tx, ty); if (f) { ui.tooltip(FACILITIES[f.type].name + (FACILITIES[f.type].placeholder ? ' (임시 그래픽)' : ''), p.x, p.y); return; }
    const W = this.world; const i = W.idx(tx, ty);
    if (W.deposit[i]) { ui.tooltip(`${ITEMS[DEPOSITS[W.deposit[i]]].name} 광맥 (무한, 임시 그래픽)`, p.x, p.y); return; }
    if (W.node[i]) { ui.tooltip(`${ITEMS[NODES[W.node[i]]].name} (임시 그래픽)`, p.x, p.y); return; }
    ui.tooltip(null);
  }
  stats() {
    let texBytes = 0, texCount = 0;
    for (const [k, t] of Object.entries(this.textures.list)) { if (k.startsWith('__')) continue; texCount++; for (const s of t.source) texBytes += s.width * s.height * 4; }
    const g = this.game;
    return {
      FPS: this.game && this.sys.game.loop.actualFps.toFixed(0), 'frame(ms)': this.frameMs.toFixed(2), 'sim(ms/frame)': this.simMs.toFixed(2),
      'sim steps/frame': this.lastSteps, 'time scale': `x${g.timeScale}`,
      belts: this.world.beltCount, items: this.world.countItems(), facilities: this.world.facilities.size,
      adventurers: `${g.units.size} (보임 ${this.uv.visibleUnits})`, monsters: g.monsters.length, people: g.people.filter((p) => p.alive).length,
      'path searches': g.pf.searches, 'char textures': this.composer.cachedCount, textures: `${texCount} (~${(texBytes / 1048576).toFixed(1)} MB)`,
      save: this.lastSave ? `${(this.lastSave.bytes / 1024).toFixed(0)} KB / ${this.lastSave.ms.toFixed(0)} ms` : '-',
    };
  }
  cleanup() { this.uv.destroy(); this.player.destroy(); window.__qf = null; }
}
export function stateName(s) {
  return { idle: '대기', board: '게시판으로', shop: '상점', wait: '파티 대기', travel: '이동', work: '수행 중', fight: '전투', return: '귀환', home: '보고 대기', sell: '판매', rest: '휴식', downed: '전투 불능' }[s] || s;
}
