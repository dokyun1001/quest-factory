import Phaser from 'phaser';
import { TILE, SIM_DT, PLAYER_SPEED, ZOOMS, DEFAULT_ZOOM, AUTOSAVE_SEC } from '../core/config.js';
import { OPP, CW, VEC, dirBetween } from '../core/dir.js';
import { FACILITIES } from '../data/facilities.js';
import { ITEMS } from '../data/items.js';
import { randomAppearance, sanitizeAppearance } from '../data/appearance.js';
import { createMainWorld, createTestWorld, buildBeltBench } from '../sim/maps.js';
import { mulberry32 } from '../sim/world.js';
import { buildPlaceholderTexture, buildGround, redrawGround } from '../render/placeholders.js';
import { LogisticsRenderer } from '../render/logisticsRenderer.js';
import { CharComposer } from '../render/charComposer.js';
import { Character } from '../render/characters.js';
import { loadSave, writeSave, loadSettings, saveSettings } from '../core/save.js';
import { ui } from '../ui/ui.js';

const TOOLS = { 1: 'belt', 2: 'miner', 3: 'smelter', 4: 'supplier', 5: 'storage' };
const JOBS = ['검사', '마법사', '탐험가'];
const NAMES = ['아린', '도윤', '세라', '카이', '루미', '하람', '벨라', '토마', '유나', '렌'];

export class GameScene extends Phaser.Scene {
  constructor() { super('Game'); }

  init(data) { this.cfg = data; }

  create() {
    const { kind, load, appearance } = this.cfg;
    this.kind = kind;
    this.settings = loadSettings();
    const saved = load ? loadSave(kind) : null;
    this.world = kind === 'test' ? createTestWorld() : createMainWorld();
    if (saved) {
      if (kind === 'test') this.world.clearArea(0, 0, this.world.w - 1, this.world.h - 1);
      this.world.restore(saved.world);
    }
    const W = this.world;
    if (!this.textures.exists('ph')) buildPlaceholderTexture(this);
    this.groundTex = buildGround(this, W);
    this.add.image(0, 0, 'ground').setOrigin(0, 0).setDepth(0);
    W.events.on('discover', (c) => {
      redrawGround(this, W, this.groundTex);
      if (this.player) ui.toast(`${c.type === 2 ? '금' : '철'} 광맥을 발견했습니다!`);
    });
    // static placeholders
    for (let y = 0; y < W.h; y++) for (let x = 0; x < W.w; x++) {
      if (W.tree[W.idx(x, y)]) this.add.image(x * TILE, (y + 1) * TILE, 'ph', 'ph_tree').setOrigin(0, 1).setDepth(1000 + (y + 1) * TILE - 2);
    }
    for (const l of W.landmarks) if (l.kind === 'guild') {
      this.add.image(l.x * TILE, (l.y + l.h) * TILE, 'ph', 'ph_guild').setOrigin(0, 1).setDepth(1000 + (l.y + l.h) * TILE);
      this.add.text((l.x + l.w / 2) * TILE, (l.y - 0.2) * TILE, '길드 (임시 표시)', { fontFamily: 'sans-serif', fontSize: '24px', color: '#fff', stroke: '#2a1f22', strokeThickness: 4 })
        .setOrigin(0.5, 1).setScale(0.25).setDepth(3000);
    }
    // facilities
    this.facSprites = new Map();
    this.portGfx = this.add.graphics().setDepth(2.5);
    W.events.on('fac', (f, what) => this.onFac(f, what));
    for (const f of W.facilities.values()) this.onFac(f, 'add');

    this.logi = new LogisticsRenderer(this, W);
    this.logi.setItemSize(this.settings.itemSize);
    this.composer = new CharComposer(this);

    // characters
    const sp = saved?.player;
    const app = sanitizeAppearance(saved?.appearance || appearance);
    this.player = new Character(this, this.composer, app, sp ? sp.x : (W.spawn.x + 0.5) * TILE, sp ? sp.y : (W.spawn.y + 1) * TILE - 2);
    if (sp?.facing) this.player.facing = sp.facing;
    this.adventurers = [];
    for (const a of saved?.adventurers || []) this.spawnAdventurer(a);
    this.benchChars = [];
    this.inv = { ...(saved?.inv || {}) };

    // camera
    const cam = this.cameras.main;
    cam.setBackgroundColor('#2b3a2c');
    cam.setBounds(0, 0, W.w * TILE, W.h * TILE);
    cam.setRoundPixels(true);
    this.zoomIdx = ZOOMS.indexOf(saved?.zoom) >= 0 ? ZOOMS.indexOf(saved.zoom) : ZOOMS.indexOf(DEFAULT_ZOOM);
    cam.setZoom(ZOOMS[this.zoomIdx]);
    cam.startFollow(this.player.sprite, true, 1, 1, 0, 12);
    this.manager = false;

    // build state
    this.tool = null; this.rot = 'E';
    this.ghost = this.add.image(0, 0, 'atlas', 'belt_WE_0').setOrigin(0, 0).setAlpha(0.65).setDepth(4).setVisible(false);
    this.cursorGfx = this.add.graphics().setDepth(4.5);
    this.dragging = null;

    this.setupInput();
    this.acc = 0; this.simMs = 0; this.simSteps = 0; this.frameMs = 0; this.saveTimer = 0; this.hudTimer = 0;
    this.gatherCd = 0;
    this.pointerScreen = { x: -1, y: -1 };
    W.discoverAround(this.player.x / TILE, this.player.y / TILE);

    ui.enterGame(this);
    this.refreshDirs();
    this.drawPorts();
    if (saved) ui.toast('저장된 진행을 불러왔습니다.');
    else ui.toast(kind === 'test' ? '테스트 배치를 열었습니다. (게임 진행과 별도 저장)' : 'WASD로 이동, Tab으로 관리자 시점. 주변을 탐험해 광맥을 찾아보세요.');
    this.events.once('shutdown', () => this.cleanup());
    window.__qf = this; // for automated checks
  }

  // ---------------- facilities ----------------
  onFac(f, what) {
    let s = this.facSprites.get(f.id);
    if (what === 'remove') { if (s) { s.destroy(); this.facSprites.delete(f.id); } this.drawPorts(); return; }
    const def = FACILITIES[f.type];
    const frame = this.facFrame(f);
    const tex = def.placeholder ? 'ph' : 'atlas';
    const [fw, fh] = def.footprint;
    const x = f.x * TILE, y = f.y * TILE + fh * TILE - def.imageSize[1];
    if (!s) { s = this.add.image(x, y, tex, frame).setOrigin(0, 0); this.facSprites.set(f.id, s); }
    s.setFrame(frame);
    s.setDepth(1000 + f.y * TILE + def.anchorPx[1]);
    this.drawPorts();
  }
  facFrame(f) {
    const def = FACILITIES[f.type];
    if (f.type === 'supplier') return `ph_supplier_${f.rot}`;
    if (f.type === 'storage') return f.open ? 'ph_storage' : 'ph_storage_closed';
    return def.artFrame;
  }
  drawPorts() {
    const g = this.portGfx; g.clear();
    if (!this.manager && !this.tool) return;
    for (const f of this.world.facilities.values()) {
      for (const p of this.world.portsOf(f)) {
        const cx = (p.tx + 0.5 + VEC[p.edge][0] * 0.5) * TILE, cy = (p.ty + 0.5 + VEC[p.edge][1] * 0.5) * TILE;
        g.fillStyle(p.kind === 'out' ? 0x7be08a : 0x76b7ff, 1).fillRect(cx - 1.5, cy - 1.5, 3, 3);
      }
    }
  }
  refreshDirs() {
    this.logi.setShowDirs(this.manager || !!this.tool || this.settings.dirsInDirect);
    this.drawPorts();
  }

  // ---------------- adventurers (stage-1 test of the shared appearance system) ----------------
  spawnAdventurer(data) {
    const W = this.world; const l = W.landmarks.find((m) => m.kind === 'guild') || { x: W.spawn.x, y: W.spawn.y, w: 1, h: 1 };
    const c = new Character(this, this.composer, sanitizeAppearance(data.appearance), (l.x + 1 + Math.random() * 2) * TILE, (l.y + l.h + 2) * TILE);
    c.data = data; c.ai = { t: 0, dx: 0, dy: 0, home: { x: c.x, y: c.y } };
    this.adventurers.push(c);
    return c;
  }
  recruit() {
    if (this.adventurers.length >= 6) { ui.toast('시험 모집은 최대 6명입니다.'); return; }
    const rnd = Math.random;
    const data = { id: Date.now().toString(36), name: NAMES[Math.floor(rnd() * NAMES.length)], job: JOBS[Math.floor(rnd() * JOBS.length)], appearance: randomAppearance(rnd) };
    this.spawnAdventurer(data);
    ui.toast(`${data.job} ${data.name}이(가) 길드에 합류했습니다. (외형 무작위·저장됨)`);
    ui.refreshRoster();
  }
  benchCharacters(n) {
    for (const c of this.benchChars) c.destroy();
    this.benchChars = [];
    const rnd = mulberry32(42 + n);
    for (let i = 0; i < n; i++) {
      const c = new Character(this, this.composer, randomAppearance(rnd), this.player.x + (rnd() - 0.5) * 200, this.player.y + (rnd() - 0.5) * 140);
      c.ai = { t: 0, dx: 0, dy: 0, home: { x: c.x, y: c.y } };
      this.benchChars.push(c);
    }
    ui.toast(`캐릭터 ${n}명 생성 (외형 텍스처 ${this.composer.cachedCount}개 공유)`);
  }
  benchBelts(n) {
    const placed = buildBeltBench(this.world, n);
    ui.toast(`벤치마크 컨베이어 ${placed}개 배치 (하단 영역)`);
  }
  wander(c, dt) {
    const ai = c.ai; ai.t -= dt;
    if (ai.t <= 0) {
      ai.t = 0.6 + Math.random() * 2;
      const r = Math.random();
      const back = Math.hypot(c.x - ai.home.x, c.y - ai.home.y) > 80;
      if (back) { const d = dirBetween(0, 0, Math.sign(Math.round((ai.home.x - c.x) / 20)), Math.sign(Math.round((ai.home.y - c.y) / 20))) || 'S'; [ai.dx, ai.dy] = VEC[d]; }
      else if (r < 0.35) { ai.dx = 0; ai.dy = 0; }
      else { const d = ['N', 'E', 'S', 'W'][Math.floor(Math.random() * 4)]; [ai.dx, ai.dy] = VEC[d]; }
    }
    c.moving = !!(ai.dx || ai.dy);
    if (c.moving) { c.facing = dirBetween(0, 0, ai.dx, ai.dy); c.move(this.world, ai.dx * 2.5 * TILE * dt, ai.dy * 2.5 * TILE * dt); }
  }

  // ---------------- input ----------------
  setupInput() {
    const kb = this.input.keyboard;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SHIFT');
    kb.addCapture('TAB');
    kb.on('keydown', (e) => this.onKey(e));
    this.input.mouse.disableContextMenu();
    this.input.on('pointerdown', (p) => this.onDown(p));
    this.input.on('pointermove', (p) => this.onMove(p));
    this.input.on('pointerup', () => { this.dragging = null; });
    this.input.on('wheel', (p, objs, dx, dy) => this.zoomBy(dy > 0 ? -1 : 1, p));
  }
  onKey(e) {
    if (ui.modalOpen()) return;
    const k = e.key;
    if (k === 'Tab') { e.preventDefault(); this.toggleManager(); }
    else if (TOOLS[k]) this.setTool(TOOLS[k]);
    else if (k === 'x' || k === 'X') this.setTool('delete');
    else if (k === 'q' || k === 'Q' || k === 'Escape') { this.setTool(null); ui.inspect(null); }
    else if (k === 'r' || k === 'R') this.rotate();
    else if (k === 'e' || k === 'E') this.gather();
    else if (k === 'F3') { e.preventDefault(); ui.toggleDebug(); }
    else if (k === '+' || k === '=') this.zoomBy(1);
    else if (k === '-') this.zoomBy(-1);
  }
  setTool(t) {
    this.tool = this.tool === t ? null : t;
    this.dragging = null;
    ui.setTool(this.tool, this.rot);
    this.refreshDirs();
  }
  rotate() {
    if (this.inspected && FACILITIES[this.inspected.type]?.rotatable && !this.tool) { this.world.rotateFacility(this.inspected); return; }
    this.rot = CW[this.rot]; ui.setTool(this.tool, this.rot);
  }
  toggleManager() {
    this.manager = !this.manager;
    const cam = this.cameras.main;
    if (this.manager) cam.stopFollow();
    else cam.startFollow(this.player.sprite, true, 1, 1, 0, 12);
    this.player.moving = false;
    ui.setMode(this.manager);
    this.refreshDirs();
  }
  zoomBy(d, p) {
    const ni = Phaser.Math.Clamp(this.zoomIdx + d, 0, ZOOMS.length - 1);
    if (ni === this.zoomIdx) return;
    const cam = this.cameras.main;
    const before = p ? cam.getWorldPoint(p.x, p.y) : null;
    this.zoomIdx = ni; cam.setZoom(ZOOMS[ni]);
    if (before && this.manager) { const after = cam.getWorldPoint(p.x, p.y); cam.scrollX += before.x - after.x; cam.scrollY += before.y - after.y; }
    ui.setZoom(ZOOMS[ni]);
  }
  tileAt(p) { const w = this.cameras.main.getWorldPoint(p.x, p.y); return [Math.floor(w.x / TILE), Math.floor(w.y / TILE), w.x, w.y]; }
  onDown(p) {
    const [tx, ty] = this.tileAt(p);
    if (p.middleButtonDown() || (p.rightButtonDown() && !this.tool)) { this.dragging = { pan: true, sx: p.x, sy: p.y, cx: this.cameras.main.scrollX, cy: this.cameras.main.scrollY }; return; }
    if (p.rightButtonDown() || this.tool === 'delete') { this.deleteAt(tx, ty); this.dragging = { del: true, tx, ty }; return; }
    if (!this.tool) { this.inspectAt(tx, ty); return; }
    if (this.tool === 'belt') {
      if (this.world.placeBelt(tx, ty, this.rot)) this.dragging = { belt: true, tx, ty };
      else ui.toast('여기에는 컨베이어를 놓을 수 없습니다.');
      return;
    }
    this.placeFacilityAt(tx, ty);
  }
  onMove(p) {
    this.pointerScreen.x = p.x; this.pointerScreen.y = p.y;
    const d = this.dragging; if (!d) return;
    if (d.pan) { const z = this.cameras.main.zoom; this.cameras.main.scrollX = d.cx - (p.x - d.sx) / z; this.cameras.main.scrollY = d.cy - (p.y - d.sy) / z; return; }
    if (!p.isDown) { this.dragging = null; return; }
    const [tx, ty] = this.tileAt(p);
    if (tx === d.tx && ty === d.ty) return;
    if (d.del) { this.deleteAt(tx, ty); d.tx = tx; d.ty = ty; return; }
    if (d.belt) {
      let guard = 0;
      while ((d.tx !== tx || d.ty !== ty) && guard++ < 64) {
        const nx = d.tx !== tx ? d.tx + Math.sign(tx - d.tx) : d.tx;
        const ny = d.tx !== tx ? d.ty : d.ty + Math.sign(ty - d.ty);
        const dir = dirBetween(d.tx, d.ty, nx, ny);
        this.world.placeBelt(d.tx, d.ty, dir);
        this.rot = dir;
        if (!this.world.placeBelt(nx, ny, dir)) { this.dragging = null; break; }
        d.tx = nx; d.ty = ny;
      }
      ui.setTool(this.tool, this.rot);
    }
  }
  placeFacilityAt(tx, ty) {
    const def = FACILITIES[this.tool];
    const [ox, oy] = this.facOrigin(tx, ty);
    const chk = this.world.canPlaceFacility(this.tool, ox, oy);
    if (!chk.ok) { ui.toast(chk.why); return; }
    for (let y = 0; y < def.footprint[1]; y++) for (let x = 0; x < def.footprint[0]; x++) {
      if (this.player.occupiesTile(ox + x, oy + y)) { ui.toast('길드마스터가 서 있는 자리입니다.'); return; }
    }
    const f = this.world.placeFacility(this.tool, ox, oy, this.rot, { item: this.lastSupplierItem || 'wood' });
    if (f && f.type === 'miner') ui.toast(`${def.name} 설치 — ${ITEMS[f.depositType].name} 채굴 (정적 이미지, 동작 애니메이션 미제작)`);
  }
  facOrigin(tx, ty) { const def = FACILITIES[this.tool]; return def.footprint[0] === 2 ? [tx, ty - 1] : [tx, ty]; }
  deleteAt(tx, ty) {
    const f = this.world.facAt(tx, ty);
    if (f) { if (this.inspected === f) ui.inspect(null); this.world.removeFacility(f); return; }
    this.world.removeBelt(tx, ty);
  }
  inspectAt(tx, ty) {
    const f = this.world.facAt(tx, ty);
    if (f) { this.inspected = f; ui.inspect({ fac: f }); return; }
    const b = this.world.beltAt(tx, ty);
    if (b) { this.inspected = null; ui.inspect({ belt: b }); return; }
    this.inspected = null; ui.inspect(null);
  }
  gather() {
    if (this.gatherCd > 0 || this.manager) return;
    const W = this.world, tx = Math.floor(this.player.x / TILE), ty = Math.floor((this.player.y - 2) / TILE);
    const [fx, fy] = VEC[{ S: 'S', N: 'N', E: 'E', W: 'W' }[this.player.facing]];
    for (const [x, y] of [[tx + fx, ty + fy], [tx, ty], [tx + 1, ty], [tx - 1, ty], [tx, ty + 1], [tx, ty - 1]]) {
      if (!W.inBounds(x, y)) continue;
      let got = null;
      if (W.tree[W.idx(x, y)]) got = 'wood';
      else { const d = W.depositVisible(x, y); if (d) got = d === 2 ? 'gold_ore' : 'iron_ore'; }
      if (got) { this.inv[got] = (this.inv[got] || 0) + 1; this.gatherCd = 0.4; ui.toast(`${ITEMS[got].name} +1`); ui.refreshInv(); return; }
    }
    ui.toast('주변에 채집할 대상이 없습니다. (나무 또는 발견한 광맥 옆에서 E)');
  }

  // ---------------- save ----------------
  save(manual = false) {
    const bytes = writeSave(this.kind, {
      world: this.world.serialize(),
      player: { x: Math.round(this.player.x * 10) / 10, y: Math.round(this.player.y * 10) / 10, facing: this.player.facing },
      appearance: this.player.appearance,
      adventurers: this.adventurers.map((a) => a.data),
      inv: this.inv, zoom: ZOOMS[this.zoomIdx],
    });
    if (manual) ui.toast(bytes ? `저장했습니다 (${(bytes / 1024).toFixed(1)} KB)` : '저장 실패 (브라우저 저장소를 사용할 수 없음)');
    this.lastSaveBytes = bytes;
    return bytes;
  }
  setItemSize(s) { this.settings.itemSize = s; saveSettings(this.settings); this.logi.setItemSize(s); }
  setDirsInDirect(v) { this.settings.dirsInDirect = v; saveSettings(this.settings); this.refreshDirs(); }

  // ---------------- loop ----------------
  update(time, delta) {
    const t0 = performance.now();
    const dt = Math.min(delta, 100) / 1000;
    // fixed-step logistics (decoupled from render rate)
    this.acc += Math.min(delta, 250) / 1000;
    let steps = 0; const s0 = performance.now();
    while (this.acc >= SIM_DT && steps < 8) { this.world.tick(SIM_DT); this.acc -= SIM_DT; steps++; }
    if (steps === 8) this.acc = 0;
    const sm = performance.now() - s0;
    this.simMs = this.simMs * 0.95 + sm * 0.05;
    this.gatherCd = Math.max(0, this.gatherCd - dt);

    const K = this.keys;
    let mx = (K.D.isDown || K.RIGHT.isDown ? 1 : 0) - (K.A.isDown || K.LEFT.isDown ? 1 : 0);
    let my = (K.S.isDown || K.DOWN.isDown ? 1 : 0) - (K.W.isDown || K.UP.isDown ? 1 : 0);
    if (ui.modalOpen()) { mx = 0; my = 0; }
    const cam = this.cameras.main;
    if (this.manager) {
      const sp = (K.SHIFT.isDown ? 1400 : 700) / cam.zoom * dt;
      cam.scrollX += mx * sp; cam.scrollY += my * sp;
      this.player.moving = false;
    } else {
      const p = this.player;
      p.moving = !!(mx || my);
      if (p.moving) {
        const len = Math.hypot(mx, my); const sp = PLAYER_SPEED * TILE * dt / len;
        if (mx && my) p.facing = Math.abs(mx) >= Math.abs(my) && (p.facing === 'E' || p.facing === 'W') ? p.facing : (my > 0 ? 'S' : 'N');
        else p.facing = mx > 0 ? 'E' : mx < 0 ? 'W' : my > 0 ? 'S' : 'N';
        p.move(this.world, mx * sp, my * sp);
        this.world.discoverAround(p.x / TILE, p.y / TILE);
      }
    }
    for (const c of this.adventurers) this.wander(c, dt);
    for (const c of this.benchChars) this.wander(c, dt);

    // render (culling by camera view)
    const v = cam.worldView;
    const view = { x0: Math.floor(v.x / TILE) - 1, y0: Math.floor(v.y / TILE) - 1, x1: Math.ceil((v.x + v.width) / TILE) + 1, y1: Math.ceil((v.y + v.height) / TILE) + 1 };
    this.view = view;
    this.logi.update(delta, view);
    const inView = (c) => c.x > v.x - 16 && c.x < v.right + 16 && c.y > v.y - 8 && c.y < v.bottom + 32;
    this.player.render(delta, true);
    let visChars = 1;
    for (const c of this.adventurers) { const iv = inView(c); visChars += iv; c.render(delta, iv); }
    for (const c of this.benchChars) { const iv = inView(c); visChars += iv; c.render(delta, iv); }
    this.visChars = visChars;
    this.updateGhost();

    // HUD / tooltip / autosave at low frequency
    this.hudTimer += delta;
    if (this.hudTimer > 120) { this.hudTimer = 0; this.updateHover(); ui.tick(this); }
    this.saveTimer += dt;
    if (this.saveTimer > AUTOSAVE_SEC) { this.saveTimer = 0; this.save(false); }
    this.frameMs = this.frameMs * 0.95 + (performance.now() - t0) * 0.05;
  }
  updateGhost() {
    const g = this.cursorGfx; g.clear();
    const p = this.input.activePointer;
    if (!this.tool || this.pointerScreen.x < 0) { this.ghost.setVisible(false); return; }
    const [tx, ty] = this.tileAt(p);
    if (this.tool === 'delete') {
      this.ghost.setVisible(false);
      g.lineStyle(1, 0xff5a5a, 1).strokeRect(tx * TILE + 0.5, ty * TILE + 0.5, TILE - 1, TILE - 1);
      return;
    }
    if (this.tool === 'belt') {
      const ex = this.world.beltAt(tx, ty);
      const shape = OPP[this.rot] + this.rot;
      this.ghost.setTexture('atlas', `belt_${shape}_0`).setPosition(tx * TILE, ty * TILE).setVisible(!ex);
      const ok = this.world.canPlaceBelt(tx, ty);
      this.ghost.setTint(ok ? 0xffffff : 0xff6060);
      g.lineStyle(1, ok ? 0xfff2a8 : 0xff5a5a, 1).strokeRect(tx * TILE + 0.5, ty * TILE + 0.5, TILE - 1, TILE - 1);
      return;
    }
    const def = FACILITIES[this.tool];
    const [ox, oy] = this.facOrigin(tx, ty);
    const fr = this.tool === 'supplier' ? `ph_supplier_${this.rot}` : def.artFrame;
    this.ghost.setTexture(def.placeholder ? 'ph' : 'atlas', fr).setPosition(ox * TILE, oy * TILE + def.footprint[1] * TILE - def.imageSize[1]).setVisible(true);
    const ok = this.world.canPlaceFacility(this.tool, ox, oy).ok;
    this.ghost.setTint(ok ? 0xffffff : 0xff6060);
    g.lineStyle(1, ok ? 0xfff2a8 : 0xff5a5a, 1).strokeRect(ox * TILE + 0.5, oy * TILE + 0.5, def.footprint[0] * TILE - 1, def.footprint[1] * TILE - 1);
  }
  updateHover() {
    const p = this.input.activePointer;
    if (this.pointerScreen.x < 0 || ui.modalOpen()) { ui.tooltip(null); return; }
    const [tx, ty, wx, wy] = this.tileAt(p);
    const it = this.logi.itemNear(wx, wy, 7);
    if (it) { ui.tooltip(ITEMS[it].name, p.x, p.y); return; }
    const f = this.world.facAt(tx, ty);
    if (f) { ui.tooltip(FACILITIES[f.type].name + (FACILITIES[f.type].placeholder ? ' (임시 표시)' : ''), p.x, p.y); return; }
    const d = this.world.depositVisible(tx, ty);
    if (d) { ui.tooltip(d === 2 ? '금 광맥 (임시 표시)' : '철 광맥 (임시 표시)', p.x, p.y); return; }
    ui.tooltip(null);
  }
  stats() {
    let texBytes = 0, texCount = 0;
    for (const [k, t] of Object.entries(this.textures.list)) {
      if (k.startsWith('__')) continue;
      texCount++; for (const src of t.source) texBytes += src.width * src.height * 4;
    }
    return {
      FPS: this.game.loop.actualFps.toFixed(0),
      'frame(ms)': this.frameMs.toFixed(2),
      'sim(ms/frame)': this.simMs.toFixed(3),
      belts: this.world.beltCount,
      items: this.world.countItems(),
      'items drawn': this.logi.itemUsed,
      'belt chunks': `${this.logi.visibleChunks}/${this.logi.chunks.size}`,
      facilities: this.world.facilities.size,
      characters: `${this.visChars}/${1 + this.adventurers.length + this.benchChars.length}`,
      'char textures': this.composer.cachedCount,
      textures: `${texCount} (~${(texBytes / 1048576).toFixed(2)} MB)`,
      zoom: this.cameras.main.zoom,
      'save(KB)': this.lastSaveBytes ? (this.lastSaveBytes / 1024).toFixed(1) : '-',
    };
  }
  cleanup() {
    for (const c of [...this.adventurers, ...this.benchChars]) c.destroy();
    this.player.destroy();
    window.__qf = null;
  }
}
