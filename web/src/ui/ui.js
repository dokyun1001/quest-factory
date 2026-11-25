// DOM user interface (crisp Korean text, updated at low frequency — never per frame).
import { ARROW } from '../core/dir.js';
import { FACILITIES } from '../data/facilities.js';
import { ITEMS, ITEM_IDS, ITEM_SIZES } from '../data/items.js';
import { BODY_TYPES, SKINS, HAIRS, HAIR_PALETTE_NAMES, OUTFITS, SHIRT_PALETTES, EYES, randomAppearance, defaultAppearance } from '../data/appearance.js';
import { CharComposer } from '../render/charComposer.js';
import { hasSave, loadSave } from '../core/save.js';
import artmeta from '../gen/artmeta.json';

const $ = (id) => document.getElementById(id);
const show = (el, v = true) => (typeof el === 'string' ? $(el) : el).classList.toggle('hidden', !v);
const TOOL_INFO = [
  ['belt', '컨베이어', '1'], ['miner', '수정 채굴기', '2'], ['smelter', '수정 제련기', '3'],
  ['supplier', '임시 공급기', '4'], ['storage', '임시 저장소', '5'], ['delete', '삭제', 'X'],
];

class UI {
  init(game) {
    this.game = game;
    this.scene = null;
    this.debugOn = false;
    $('bt-new').onclick = () => this.openCreator(defaultAppearance(), (a) => this.start('main', false, a));
    $('bt-continue').onclick = () => this.start('main', true);
    $('bt-test').onclick = () => this.start('test', hasSave('test'), loadSave('test')?.appearance || defaultAppearance());
    $('bt-credits').onclick = () => show('md-credits');
    $('cd-close').onclick = () => show('md-credits', false);
    $('bt-save').onclick = () => this.scene?.save(true);
    $('bt-settings').onclick = () => this.openSettings();
    $('st-close').onclick = () => show('md-settings', false);
    $('st-appearance').onclick = () => { show('md-settings', false); this.openCreator(this.scene.player.appearance, (a) => { this.scene.player.setAppearance(a); this.scene.save(false); }); };
    $('bt-menu').onclick = () => { this.scene?.save(false); this.toast('저장 후 메뉴로 돌아갑니다.'); this.exitGame(); };
    $('bt-roster').onclick = () => { this.refreshRoster(); show('md-roster'); };
    $('rs-close').onclick = () => show('md-roster', false);
    $('rs-recruit').onclick = () => this.scene?.recruit();
    document.querySelectorAll('[data-belts]').forEach((b) => (b.onclick = () => {
      const n = +b.dataset.belts; const s = this.scene; if (!s) return;
      if (n === 0) { const a = s.world.benchArea; s.world.clearArea(a.x0, a.y0, a.x1, a.y1); this.toast('벤치마크 영역을 비웠습니다.'); }
      else s.benchBelts(n);
    }));
    document.querySelectorAll('[data-chars]').forEach((b) => (b.onclick = () => this.scene?.benchCharacters(+b.dataset.chars)));
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.scene?.save(false); });
    window.addEventListener('beforeunload', () => this.scene?.save(false));
  }
  ready(bootScene) {
    this.boot = bootScene;
    this.composer = new CharComposer(bootScene);
    this.atlasImg = bootScene.textures.get('atlas').getSourceImage();
    this.atlas = bootScene.textures.get('atlas');
    document.querySelectorAll('canvas[data-icon]').forEach((c) => this.drawFrame(c, 'atlas', c.dataset.icon, 1));
    this.buildToolbar();
    this.showTitle();
  }
  drawFrame(canvas, tex, frame, scale = 1, dx = 0, dy = 0, clear = true) {
    const t = this.boot.textures.get(tex); const f = t.get(frame);
    if (clear) { canvas.width = f.cutWidth * scale; canvas.height = f.cutHeight * scale; }
    const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = false;
    if (clear) ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(t.getSourceImage(), f.cutX, f.cutY, f.cutWidth, f.cutHeight, dx, dy, f.cutWidth * scale, f.cutHeight * scale);
  }
  showTitle() {
    show('scr-loading', false); show('scr-title'); show('ingame', false);
    show('bt-continue', hasSave('main'));
  }
  start(kind, load, appearance) {
    show('md-creator', false); show('scr-title', false); show('ingame');
    this.game.scene.start('Game', { kind, load, appearance });
  }
  exitGame() {
    this.game.scene.stop('Game');
    this.scene = null;
    show('md-settings', false); show('md-roster', false); show('inspector', false); this.tooltip(null);
    this.showTitle();
  }
  enterGame(scene) {
    this.scene = scene;
    show('testpanel', scene.kind === 'test');
    show('bt-roster', scene.kind === 'main');
    this.setTool(null, scene.rot); this.setMode(false); this.inspect(null);
    if (this.debugOn) show('debug');
  }
  modalOpen() { return ['md-creator', 'md-settings', 'md-credits', 'md-roster'].some((id) => !$(id).classList.contains('hidden')); }

  // ---------------- character creator ----------------
  openCreator(initial, onOk) {
    this.cr = { ...initial };
    const btns = (host, entries, key, render) => {
      const el = $(host); el.innerHTML = '';
      for (const [val, label] of entries) {
        const b = document.createElement('button'); b.textContent = render ? '' : label; b.title = label;
        if (render) render(b, val);
        b.classList.toggle('on', String(this.cr[key]) === String(val));
        b.onclick = () => { this.cr[key] = typeof this.cr[key] === 'number' ? +val : val; this.openCreatorRefresh(); };
        el.appendChild(b);
      }
    };
    this.openCreatorRefresh = () => {
      btns('cr-body', Object.entries(BODY_TYPES).map(([k, v]) => [k, v.name]), 'bodyType');
      btns('cr-skin', Object.entries(SKINS), 'skinId');
      btns('cr-hair', Object.entries(HAIRS).map(([k, v]) => [k, v.name]), 'hairId');
      btns('cr-hairpal', Object.entries(HAIR_PALETTE_NAMES), 'hairPaletteId', (b, v) => {
        b.className = 'swatch'; b.style.background = artmeta.hair_palettes.presets[v].base; b.style.borderColor = artmeta.hair_palettes.presets[v].outline;
      });
      btns('cr-eyes', Object.entries(EYES), 'eyeShapeId');
      btns('cr-outfit', Object.entries(OUTFITS).map(([k, v]) => [k, v.name]), 'outfitId');
      btns('cr-outpal', Object.entries(SHIRT_PALETTES).map(([k, v]) => [k, v.name]), 'outfitPaletteId', (b, v) => {
        b.className = 'swatch'; b.style.background = SHIRT_PALETTES[v].colors[2]; b.style.borderColor = SHIRT_PALETTES[v].colors[0];
      });
      this.crCanvas = this.composer.composeCanvas(this.cr);
    };
    this.openCreatorRefresh();
    $('cr-random').onclick = () => { this.cr = randomAppearance(); this.openCreatorRefresh(); };
    $('cr-cancel').onclick = () => { show('md-creator', false); cancelAnimationFrame(this.crRaf); };
    $('cr-ok').onclick = () => { show('md-creator', false); cancelAnimationFrame(this.crRaf); onOk({ ...this.cr }); };
    show('md-creator');
    const pv = $('cr-preview'); const ctx = pv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    const loop = (t) => {
      ctx.clearRect(0, 0, pv.width, pv.height);
      const col = Math.floor(t / 150) % 4;
      for (let r = 0; r < 4; r++) {
        const x = 8 + r * 62, y = 24;
        ctx.drawImage(this.crCanvas, 64 + col * 16, r * 24, 16, 24, x, y, 48, 72);           // walk, 3x
        ctx.drawImage(this.crCanvas, col * 16, r * 24, 16, 24, x + 16, y + 92, 16, 24);      // idle, 1x (actual pixels)
      }
      ctx.fillStyle = '#f4ead6'; ctx.font = '11px sans-serif';
      ctx.fillText('걷기 (3배)', 8, 14); ctx.fillText('대기 (1배 원본 크기)', 8, 190);
      this.crRaf = requestAnimationFrame(loop);
    };
    cancelAnimationFrame(this.crRaf); this.crRaf = requestAnimationFrame(loop);
  }

  // ---------------- settings ----------------
  openSettings() {
    const s = this.scene; if (!s) return;
    const host = $('st-size'); host.innerHTML = '';
    for (const sz of ITEM_SIZES) {
      const b = document.createElement('button'); b.textContent = `${sz}px${sz === 10 ? ' (기본)' : ''}`;
      b.classList.toggle('on', s.settings.itemSize === sz);
      b.onclick = () => { s.setItemSize(sz); this.openSettings(); };
      host.appendChild(b);
    }
    $('st-dirs').checked = !!s.settings.dirsInDirect;
    $('st-dirs').onchange = (e) => s.setDirsInDirect(e.target.checked);
    const cmp = $('st-cmp'); cmp.innerHTML = '<div></div>' + ITEM_SIZES.map((z) => `<div style="text-align:center">${z}px</div>`).join('');
    for (const id of ITEM_IDS) {
      const l = document.createElement('div'); l.textContent = ITEMS[id].name; cmp.appendChild(l);
      for (const sz of ITEM_SIZES) {
        const c = document.createElement('canvas'); c.width = 64; c.height = 64; c.style.width = '64px';
        const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
        const bf = this.atlas.get('belt_WE_0'); const f = this.atlas.get(`item_${id}_${sz}`);
        ctx.drawImage(this.atlasImg, bf.cutX, bf.cutY, 16, 16, 0, 0, 64, 64);
        const o = (16 - sz) / 2 * 4;
        ctx.drawImage(this.atlasImg, f.cutX, f.cutY, sz, sz, o, o, sz * 4, sz * 4);
        if (sz === s.settings.itemSize) { c.style.outline = '2px solid #e9b75a'; }
        cmp.appendChild(c);
      }
    }
    show('md-settings');
  }

  // ---------------- HUD ----------------
  buildToolbar() {
    const bar = $('toolbar'); bar.innerHTML = '';
    this.toolBtns = {};
    for (const [id, name, key] of TOOL_INFO) {
      const b = document.createElement('button');
      const c = document.createElement('canvas'); c.width = 32; c.height = 32;
      const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
      const src = this.atlasImg;
      const draw = (frame, tex = 'atlas', sc = 2) => { const t = this.boot.textures.get(tex); const f = t.get(frame); const s = Math.min(sc, 32 / f.cutWidth, 32 / f.cutHeight); ctx.drawImage(t.getSourceImage(), f.cutX, f.cutY, f.cutWidth, f.cutHeight, (32 - f.cutWidth * s) / 2, (32 - f.cutHeight * s) / 2, f.cutWidth * s, f.cutHeight * s); };
      if (id === 'belt') draw('belt_WE_0');
      else if (id === 'miner') draw('fac_miner', 'atlas', 1);
      else if (id === 'smelter') draw('fac_smelter', 'atlas', 1);
      else if (id === 'supplier') draw('ph_supplier_E', 'ph');
      else if (id === 'storage') draw('ph_storage', 'ph');
      else { ctx.strokeStyle = '#ff7a6e'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(8, 8); ctx.lineTo(24, 24); ctx.moveTo(24, 8); ctx.lineTo(8, 24); ctx.stroke(); }
      void src;
      b.appendChild(c);
      const t = document.createElement('span'); t.textContent = name; b.appendChild(t);
      const k = document.createElement('span'); k.className = 'key'; k.textContent = `[${key}]`; b.appendChild(k);
      b.onclick = () => this.scene?.setTool(id);
      bar.appendChild(b); this.toolBtns[id] = b;
    }
  }
  setTool(tool, rot) {
    this.tool = tool; this.rot = rot;
    if (this.toolBtns) for (const [id, b] of Object.entries(this.toolBtns)) b.classList.toggle('on', id === tool);
    this.renderHud();
  }
  setMode(m) { this.manager = m; this.renderHud(); }
  setZoom() { this.renderHud(); }
  renderHud() {
    const s = this.scene; if (!s) return;
    const toolName = this.tool ? TOOL_INFO.find((t) => t[0] === this.tool)[1] : '없음';
    const rotTxt = this.tool === 'belt' || this.tool === 'supplier' ? ` · 방향 ${ARROW[this.rot]} (R)` : '';
    const inv = Object.entries(s.inv).filter(([, n]) => n > 0).map(([k, n]) => `${ITEMS[k].name} ${n}`).join(' · ');
    $('hud').innerHTML =
      `<b>${this.manager ? '관리자 시점' : '직접 조작'}</b> <span class="tag">${s.kind === 'test' ? '테스트 배치' : '단계 1 테스트'}</span><br>` +
      `도구: ${toolName}${rotTxt} · 확대 ${s.cameras.main.zoom}배<br>` +
      `<span style="font-size:12px;color:#c3b49a">${this.manager ? 'WASD/방향키·우클릭 드래그: 화면 이동 · 휠: 확대 · Tab: 직접 조작' : 'WASD: 이동 · E: 채집 · Tab: 관리자 시점 · 휠: 확대'}<br>` +
      `${this.tool ? (this.tool === 'delete' ? '클릭/드래그: 삭제 · Q: 도구 해제' : '좌클릭(드래그): 설치 · 우클릭: 삭제 · Q: 도구 해제') : '1~5: 건설 도구 · X: 삭제 · 클릭: 정보'}</span>` +
      `<div id="inv">${inv ? '소지품: ' + inv : ''}</div>`;
  }
  refreshInv() { this.renderHud(); }
  toast(msg) {
    const d = document.createElement('div'); d.textContent = msg; $('toast').appendChild(d);
    while ($('toast').children.length > 4) $('toast').firstChild.remove();
    setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 450); }, 2600);
  }
  tooltip(text, x, y) {
    const t = $('tooltip');
    if (!text) { t.classList.add('hidden'); return; }
    t.textContent = text; t.classList.remove('hidden');
    t.style.left = `${Math.min(x + 14, innerWidth - 160)}px`; t.style.top = `${y + 16}px`;
  }
  inspect(target) { this.inspTarget = target; show('inspector', !!target); if (!target && this.scene) this.scene.inspected = null; this.renderInspector(); }
  renderInspector() {
    const t = this.inspTarget; const el = $('inspector'); if (!t || !this.scene) return;
    if (t.belt) {
      const b = t.belt;
      if (!this.scene.world.beltAt(b.x, b.y)) { this.inspect(null); return; }
      el.innerHTML = `<h3>컨베이어 (${b.in}→${b.out})</h3>위치 ${b.x}, ${b.y}<br>운반 중: ${b.items.map((i) => ITEMS[i.t].name).join(', ') || '없음'}<br>` +
        `<span class="note">다음 칸: ${b.nextBelt ? '컨베이어' : b.nextFac ? FACILITIES[b.nextFac.type].name : '없음 (끝에서 대기)'}</span>`;
      return;
    }
    const f = t.fac; const def = FACILITIES[f.type];
    if (!this.scene.world.facilities.has(f.id)) { this.inspect(null); return; }
    let h = `<h3>${def.name}${def.placeholder ? '<span class="tag">임시</span>' : ''}</h3>`;
    if (def.artId) h += `<span class="note">아트 ${def.artId} (${def.artVersion}) · 설치 ${def.footprint.join('×')} 후보</span><br>`;
    if (f.type === 'miner') h += `채굴: ${ITEMS[f.depositType].name}<br>진행: ${Math.floor((f.timer / def.cycleSec) * 100)}% · 출력 대기 ${f.outBuf.length}/${def.outCap}<br>누적 생산 ${f.made}`;
    if (f.type === 'smelter') h += `입력 ${f.inBuf.length}/${def.inCap} (철광석만) · 출력 ${f.outBuf.length}/${def.outCap}<br>진행: ${Math.floor((f.timer / def.cycleSec) * 100)}% · 누적 ${f.made}`;
    if (f.type === 'supplier') h += `공급 품목: ${ITEMS[f.item].name} · 방향 ${ARROW[f.rot]}<br><div class="row"><button id="in-item">품목 변경</button><button id="in-rot">회전 (R)</button></div>`;
    if (f.type === 'storage') {
      const c = Object.entries(f.counts).map(([k, n]) => `${ITEMS[k].name} ${n}`).join('<br>') || '비어 있음';
      h += `상태: ${f.open ? '받는 중' : '닫힘 (막힘 시험)'}<br>${c}<div class="row"><button id="in-open">${f.open ? '닫기' : '열기'}</button></div>`;
    }
    h += `<div class="note">${def.ports.length ? '포트: 초록=출력, 파랑=입력 (관리자/건설 시 표시)' : ''}</div>`;
    if (el.dataset.sig !== h) {
      el.innerHTML = h; el.dataset.sig = h;
      const bi = $('in-item'); if (bi) bi.onclick = () => { f.item = ITEM_IDS[(ITEM_IDS.indexOf(f.item) + 1) % ITEM_IDS.length]; this.scene.lastSupplierItem = f.item; this.renderInspector(); };
      const br = $('in-rot'); if (br) br.onclick = () => { this.scene.world.rotateFacility(f); this.renderInspector(); };
      const bo = $('in-open'); if (bo) bo.onclick = () => { f.open = !f.open; this.scene.onFac(f, 'change'); this.renderInspector(); };
    }
  }
  refreshRoster() {
    const s = this.scene; if (!s) return;
    const el = $('rs-list'); el.innerHTML = s.adventurers.length ? '' : '<p class="note">아직 모험가가 없습니다.</p>';
    for (const a of s.adventurers) {
      const row = document.createElement('div'); row.className = 'row';
      const c = document.createElement('canvas'); c.width = 48; c.height = 72; c.style.background = '#4f7a3f'; c.style.borderRadius = '4px';
      const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.composer.composeCanvas(a.data.appearance), 0, 0, 16, 24, 0, 0, 48, 72);
      const ap = a.data.appearance;
      const info = document.createElement('div');
      info.innerHTML = `<b>${a.data.name}</b> · ${a.data.job}<br><span class="note">피부 ${ap.skinId} · ${HAIRS[ap.hairId].name} · ${HAIR_PALETTE_NAMES[ap.hairPaletteId]} · 셔츠 ${SHIRT_PALETTES[ap.outfitPaletteId].name}</span>`;
      row.appendChild(c); row.appendChild(info); el.appendChild(row);
    }
  }
  toggleDebug() { this.debugOn = !this.debugOn; show('debug', this.debugOn && !!this.scene); }
  tick(s) {
    if (this.inspTarget) this.renderInspector();
    if (this.lastInvSig !== JSON.stringify(s.inv)) { this.lastInvSig = JSON.stringify(s.inv); this.renderHud(); }
    if (!this.debugOn) return;
    const st = s.stats();
    $('debug').textContent = Object.entries(st).map(([k, v]) => `${k.padEnd(14)} ${v}`).join('\n');
  }
}
export const ui = new UI();
