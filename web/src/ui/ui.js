// DOM UI for 007 (updated at low frequency, never per frame).
import { B, STAT_NAMES, ELEM_NAMES } from '../data/balance.js';
import { ITEMS } from '../data/items.js';
import { FACILITIES } from '../data/facilities.js';
import { RECIPES, recipesFor, recipeProducing } from '../data/recipes.js';
import { TECH } from '../data/tech.js';
import { MONSTERS } from '../data/monsters.js';
import { CODEX, CODEX_CATS, COMMAND_SKILLS, COMMANDS } from '../data/codex.js';
import { HAIRS, HAIR_PALETTE_NAMES, SHIRT_PALETTES, SKINS, randomAppearance, defaultAppearance } from '../data/appearance.js';
import { CharComposer } from '../render/charComposer.js';
import { iconCanvas } from '../render/ph007.js';
import { hasSave, loadSave, deleteSave, saveSettings } from '../core/save.js';
import { handRecipes, maxCraftable, craft } from '../sim/inventory.js';
import { questLabel, basePrice } from '../sim/game.js';
import { gradeName, aptCount, talentAvg, makePerson } from '../sim/people.js';
import { stateName } from '../scenes/GameScene.js';
import artmeta from '../gen/artmeta.js';
import { openLab } from './labs.js';

const $ = (id) => document.getElementById(id);
const show = (el, v = true) => (typeof el === 'string' ? $(el) : el).classList.toggle('hidden', !v);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const n0 = (v) => Math.round(v).toLocaleString('ko-KR');
const stars = (t) => `<span class="stars">${'★'.repeat(t)}</span><span class="muted">${'☆'.repeat(5 - t)}</span>`;
const nameOf = (id) => ITEMS[id]?.name || id;

class UI {
  init(game) {
    this.pgame = game; this.scene = null; this.debugOn = false; this.paused = false;
    $('bt-new').onclick = () => this.openCreator(defaultAppearance(), (a) => this.start('main', false, a));
    $('bt-continue').onclick = () => this.start('main', true);
    document.querySelectorAll('[data-mode]').forEach((b) => (b.onclick = () => this.start(b.dataset.mode, hasSave(b.dataset.mode), loadSave(b.dataset.mode)?.appearance || randomAppearance())));
    document.querySelectorAll('[data-lab]').forEach((b) => (b.onclick = () => { show('scr-title', false); openLab(b.dataset.lab, this); }));
    $('bt-credits').onclick = () => show('md-credits');
    document.querySelectorAll('[data-close]').forEach((b) => (b.onclick = () => b.closest('.modal').classList.add('hidden')));
    $('bt-inv').onclick = () => this.openInventory(); $('bt-craft').onclick = () => this.openCraft(); $('bt-guild').onclick = () => this.openGuild();
    $('bt-dev').onclick = () => this.openDev(); $('bt-settings').onclick = () => this.openSettings();
    $('bt-save').onclick = () => this.scene?.save(true);
    $('bt-menu').onclick = () => { this.scene?.save(false); this.exitGame(); };
    $('md-panel').addEventListener('mousedown', (e) => { if (e.target.id === 'md-panel') this.closeTop(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.scene?.save(false); });
    window.addEventListener('beforeunload', () => this.scene?.save(false));
  }
  ready(boot) { this.boot = boot; this.composer = new CharComposer(boot); this.showTitle(); }
  ic(id, size = 16, scale = 2) { return iconCanvas(this.boot, id, size, scale); }
  showTitle() { show('scr-loading', false); show('scr-lab', false); show('scr-title'); show('ingame', false); show('bt-continue', hasSave('main')); }
  start(mode, load, appearance) { show('md-creator', false); show('scr-title', false); show('ingame'); this.pgame.scene.start('Game', { mode, load, appearance }); }
  exitGame() { this.pgame.scene.stop('Game'); this.scene = null; this.closeTop(); show('inspector', false); this.inspTarget = null; this.tooltip(null); this.showTitle(); }
  enterGame(scene) {
    this.scene = scene; this.inspTarget = null; this.cmdPlacing = null; this.focusPick = false; this.pick = -1; this.paused = false;
    show('bt-dev', scene.modeDef.dev); show('objectives', scene.mode === 'main'); show('debug', this.debugOn);
    show('inspector', false); $('cmdbar').dataset.sig = ''; this.renderHotbar(); this.refreshHud(); this.renderCmdbar();
  }
  modalOpen() { return !$('md-panel').classList.contains('hidden') || !$('md-creator').classList.contains('hidden') || !$('md-credits').classList.contains('hidden'); }
  typing() { const a = document.activeElement; return !!a && (a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.tagName === 'TEXTAREA'); }
  closeTop() {
    if (!$('md-panel').classList.contains('hidden')) { show('md-panel', false); this.panel = null; document.activeElement?.blur?.(); return true; }
    if (this.inspTarget) { this.inspect(null); return true; }
    return false;
  }
  openPanel(kind, render) { this.panel = { kind, render }; show('md-panel'); render($('md-panel-body')); }
  rerender() { if (this.panel) this.panel.render($('md-panel-body')); }
  refresh() { this.rerender(); this.renderCmdbar(); }

  // ---------------- creator ----------------
  openCreator(initial, onOk) {
    this.cr = { ...initial };
    const btns = (host, entries, key, render) => {
      const el = $(host); el.innerHTML = '';
      for (const [val, label] of entries) {
        const b = document.createElement('button'); b.textContent = render ? '' : label; b.title = label;
        if (render) render(b, val);
        b.classList.toggle('on', String(this.cr[key]) === String(val));
        b.onclick = () => { this.cr[key] = typeof this.cr[key] === 'number' ? +val : val; refresh(); };
        el.appendChild(b);
      }
    };
    const refresh = () => {
      btns('cr-skin', Object.entries(SKINS), 'skinId');
      btns('cr-hair', Object.entries(HAIRS).map(([k, v]) => [k, v.name]), 'hairId');
      btns('cr-hairpal', Object.entries(HAIR_PALETTE_NAMES), 'hairPaletteId', (b, v) => { b.className = 'swatch'; b.style.background = artmeta.hair_palettes.presets[v].base; });
      btns('cr-outpal', Object.entries(SHIRT_PALETTES).map(([k, v]) => [k, v.name]), 'outfitPaletteId', (b, v) => { b.className = 'swatch'; b.style.background = SHIRT_PALETTES[v].colors[2]; });
      this.crCanvas = this.composer.composeCanvas(this.cr);
    };
    refresh();
    $('cr-random').onclick = () => { this.cr = randomAppearance(); refresh(); };
    $('cr-cancel').onclick = () => { show('md-creator', false); cancelAnimationFrame(this.crRaf); };
    $('cr-ok').onclick = () => { show('md-creator', false); cancelAnimationFrame(this.crRaf); onOk({ ...this.cr }); };
    show('md-creator');
    const pv = $('cr-preview'); const ctx = pv.getContext('2d'); ctx.imageSmoothingEnabled = false;
    const loop = (t) => { ctx.clearRect(0, 0, 256, 200); const col = Math.floor(t / 150) % 4; for (let r = 0; r < 4; r++) ctx.drawImage(this.crCanvas, 64 + col * 16, r * 24, 16, 24, 8 + r * 62, 30, 48, 72); this.crRaf = requestAnimationFrame(loop); };
    cancelAnimationFrame(this.crRaf); this.crRaf = requestAnimationFrame(loop);
  }

  // ---------------- HUD ----------------
  refreshHud() {
    const s = this.scene; if (!s) return;
    const g = s.game; const tool = s.tool(); const sel = s.inv.selected();
    const toolTxt = tool ? `${nameOf(tool.item)} · 방향 ${{ N: '↑', E: '→', S: '↓', W: '←' }[s.rot]} (R)` : sel ? nameOf(sel.id) : '없음';
    const frac = g.yearT / B.time.realSecondsPerYear;
    const html = `<b>${esc(s.modeDef.name)}</b>${s.manager ? ' <span class="tag">관리자 시점</span>' : ''}<br>` +
      `${g.life.year + 1}년차 ${Math.floor(frac * 12) + 1}월 · 배속 x${g.timeScale}${this.paused ? ' (일시정지)' : ''} · 길드 자금 <b>${n0(g.ledger.guild)}G</b><br>` +
      `선택: ${esc(toolTxt)} · 확대 ${s.cameras.main.zoom}배<br>` +
      `<span class="muted" style="font-size:11px">WASD 이동 · E 채집/상호작용 · 1~0 단축바 · 좌클릭 설치(드래그) · 우클릭 철거 · Tab 관리자 · C 제작 · G 길드 · I 인벤토리</span>`;
    if ($('hud').dataset.sig !== html) { $('hud').dataset.sig = html; $('hud').innerHTML = html; }
  }
  renderHotbar() {
    const s = this.scene; if (!s) return; const hb = $('hotbar'); hb.innerHTML = '';
    for (let i = 0; i < B.player.hotbar; i++) {
      const sl = s.inv.slots[i]; const d = document.createElement('div'); d.className = 'slot' + (s.inv.sel === i ? ' sel' : '');
      d.innerHTML = `<span class="k">${(i + 1) % 10}</span>`;
      if (sl) { d.appendChild(this.ic(sl.id, 16, 2)); d.insertAdjacentHTML('beforeend', `<span class="n">${sl.n}</span>`); d.title = nameOf(sl.id); }
      d.onclick = () => { s.inv.sel = s.inv.sel === i ? -1 : i; s.refreshTool(); };
      hb.appendChild(d);
    }
  }
  renderObjectives(s) {
    const g = s.game, W = g.world, inv = s.inv;
    const has = (k) => inv.count(k) > 0;
    const made = (k) => (W.made[`${k}_made`] || 0) + (W.made[`${k}_crafted`] || 0);
    const facs = (k) => g.facsOf(k).length > 0;
    const list = [
      ['나무·돌 채집 (E) 후 제작 (C)', (W.made.belt_1_crafted || 0) > 0 || (W.made.fac_small_miner_crafted || 0) > 0],
      ['소형 채굴기 설치 (광맥 위, 방향 R)', [...W.facilities.values()].some((f) => f.type === 'small_miner')],
      ['용광로로 철괴 생산 (광석 + 연료)', (W.made.iron_ingot_made || 0) > 0],
      ['컨베이어로 채굴기 → 용광로 자동화', [...W.facilities.values()].some((f) => f.type === 'furnace' && f.made > 0) && W.beltCount > 0],
      ['종이 (목재+물 → 펄프 → 종이)', made('paper') > 0 || has('paper')],
      ['잉크 (석탄/목탄 → 안료 + 물)', made('ink') > 0 || has('ink')],
      ['빈 의뢰서 (종이 + 잉크)', made('quest') > 0 || has('quest')],
      ['의뢰 게시판 설치 + 의뢰서 공급', facs('board') && (g.facsOf('board').some((f) => f.stock.quest > 0) || g.guild.posted > 0)],
      ['모험가 모집 (G → 개요)', g.units.size > 0],
      ['의뢰 등록 (G → 의뢰)', g.guild.templates.length > 0],
      ['의뢰 완료 (실제 토벌·귀환)', g.guild.completed > 0],
      ['전리품 매입소 → 전리품 매입', facs('counter') && g.stats.sold > 0],
      ['상점 → 모험가 장비 구매', facs('shop') && g.stats.bought > 0],
      ['연구소 → 기술 해금', facs('lab') && g.guild.tech.size > 0],
    ];
    const done = list.filter((x) => x[1]).length;
    const html = `<b>TEST A 순환 체크 (${done}/${list.length})</b><br>` + list.map(([t, d]) => `<div class="${d ? 'done' : 'todo'}">${d ? '✔' : '○'} ${t}</div>`).join('');
    if ($('objectives').dataset.sig !== html) { $('objectives').dataset.sig = html; $('objectives').innerHTML = html; }
  }
  toast(msg, kind = '') {
    const d = document.createElement('div'); d.textContent = msg; if (kind) d.className = kind; $('toast').appendChild(d);
    while ($('toast').children.length > 5) $('toast').firstChild.remove();
    setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 450); }, kind === 'rare' || kind === 'boss' ? 4500 : 2600);
  }
  tooltip(text, x, y) { const t = $('tooltip'); if (!text) { t.classList.add('hidden'); return; } t.textContent = text; t.classList.remove('hidden'); t.style.left = `${Math.min(x + 14, innerWidth - 220)}px`; t.style.top = `${y + 16}px`; }
  toggleDebug() { this.debugOn = !this.debugOn; show('debug', this.debugOn && !!this.scene); }
  tick(s) {
    this.refreshHud();
    if (s.mode === 'main') this.renderObjectives(s);
    if (this.inspTarget) this.renderInspector();
    if (this.panel && ['guild', 'inv'].includes(this.panel.kind) && !this.typing()) { this.panelT = (this.panelT || 0) + 1; if (this.panelT % 10 === 0) this.rerender(); }
    if (this.debugOn) $('debug').textContent = Object.entries(s.stats()).map(([k, v]) => `${k.padEnd(16)} ${v}`).join('\n');
    this.cmdT = (this.cmdT || 0) + 1; if (this.cmdT % 5 === 0) this.renderCmdbar();
  }

  // ---------------- inspector ----------------
  inspect(t) { this.inspTarget = t; show('inspector', !!t); if (!t && this.scene) this.scene.uv.selected = null; $('inspector').dataset.sig = ''; this.renderInspector(); }
  near(f) { const s = this.scene; const d = FACILITIES[f.type]; const cx = f.x + d.footprint[0] / 2, cy = f.y + d.footprint[1] / 2; return Math.hypot(cx - s.player.x / 16, cy - s.player.y / 16) < 8 || s.free(); }
  renderInspector() {
    const t = this.inspTarget, s = this.scene; if (!t || !s) return; const el = $('inspector'); const g = s.game;
    let h = ''; const acts = [];
    if (t.belt) {
      const b = t.belt; if (!s.world.beltAt(b.x, b.y)) { this.inspect(null); return; }
      h = `<h3>컨베이어 ${['I', 'II', 'III', 'IV', 'V'][b.tier]} (${b.in}→${b.out})</h3>속도 ${B.logistics.beltSpeed[b.tier]}타일/초 · 간격 ${B.logistics.itemGap}<br>운반 중: ${b.items.map((i) => nameOf(i.t)).join(', ') || '없음'}<br><span class="note">다음: ${b.nextBelt ? '컨베이어' : b.nextFac ? FACILITIES[b.nextFac.type].name : '없음 (끝에서 대기)'}</span>`;
    } else if (t.unit) {
      const u = t.unit; if (!g.units.has(u.id)) { this.inspect(null); return; }
      h = this.personCard(u.p, u);
      acts.push(['추적 (카메라)', () => s.followUnit(u)], [u.p.interest ? '관심 해제' : '관심 등록 ★', () => { u.p.interest = !u.p.interest; }]);
    } else if (t.person) {
      h = this.personCard(t.person, null);
    } else if (t.monster) {
      const m = t.monster; const d = MONSTERS[m.type];
      if (m.dead) { this.inspect(null); return; }
      h = `<h3>${d.name} <span class="tag">임시 그래픽</span></h3>체력 ${Math.ceil(m.hp)}/${m.maxHp} · 공격 ${d.atk} · 방어 ${d.def}<br>원소 ${ELEM_NAMES[d.elem]} · 약점 ${Object.keys(d.weak || {}).map((e) => ELEM_NAMES[e]).join(', ') || '-'} · 저항 ${Object.keys(d.resist || {}).map((e) => ELEM_NAMES[e]).join(', ') || '-'}${m.tele ? `<br><b class="bad">⚠ ${m.tele.name} ${(m.tele.windup - m.tele.t).toFixed(1)}초</b>` : ''}`;
      acts.push(['집중 공격 지정', () => { g.command('focus', { target: m }); this.toast(`집중 공격: ${d.name}`); }]);
    } else if (t.fac) {
      const f = t.fac; const d = FACILITIES[f.type];
      if (!s.world.facilities.has(f.id)) { this.inspect(null); return; }
      h = `<h3>${d.name}${d.placeholder ? '<span class="tag">임시 그래픽</span>' : ''}</h3>`;
      if (d.artId) h += `<span class="note">아트 ${esc(d.artId)} · 설치 ${d.footprint.join('×')}</span><br>`;
      const buf = (m) => Object.entries(m).filter(([, n]) => n).map(([k, n]) => `${nameOf(k)} ${n}`).join(', ') || '없음';
      const list = (a) => { const m = {}; for (const x of a) m[x] = (m[x] || 0) + 1; return buf(m); };
      const tierName = B.industry.tiers[f.tier || 0].name; const sp = s.world.mult(f);
      switch (d.kind) {
        case 'miner': h += `채굴: <b>${nameOf(f.mineType)}</b> · 출력 방향 ${f.rot}<br>진행 ${Math.floor(f.timer / B.industry.minerSec * 100)}% (${(B.industry.minerSec / sp).toFixed(1)}초/개) · ${f.state === 'blocked' ? '<span class="bad">출력 막힘 (정지)</span>' : '작동'}<br>누적 ${f.made}`; break;
        case 'furnace': h += `상태 <b>${{ active: '작동', ember: '잔불', off: '정지' }[f.state] || f.state}</b> · 출력 ${f.rot}<br>광석 ${list(f.ore)} / ${B.industry.furnaceOreBuf}<br>연료 ${list(f.fuel)} (남은 연소 ${f.charge})<br>${f.smelting ? `제련 중: ${nameOf(f.smelting)} ${Math.floor(f.timer / B.industry.furnaceSec * 100)}%<br>` : ''}출력 ${list(f.outBuf)}<br><span class="note">파랑=광석 입구, 주황=연료 입구, 초록=출구. 광석이 없거나 출구가 막히면 연료를 쓰지 않습니다.</span>`;
          acts.push(['넣기 (광석·연료)', () => this.depositTo(f)], ['꺼내기', () => this.takeFrom(f)]); break;
        case 'machine': {
          const opts = d.station === 'crusher' ? '' : recipesFor(d.station).map((r) => { const ok = g.techUnlocked(r.tech) || g.dev.allRecipes; return `<option value="${r.id}" ${r.id === f.recipe ? 'selected' : ''} ${ok ? '' : 'disabled'}>${Object.keys(r.out).map(nameOf).join(',')} ← ${Object.entries(r.in).map(([k, n]) => `${nameOf(k)}${n}`).join('+')}${ok ? '' : ' (연구 필요)'}</option>`; }).join('');
          h += d.station === 'crusher' ? `장비 → 재료 ${B.economy.crusherReturn * 100}% 회수 (소수점 누적, 증식 불가)<br>` : `제작법 <select id="in-recipe">${opts}</select><br>`;
          h += `상태 ${{ active: '작동', waiting: '재료 대기', blocked: '<span class="bad">출력 막힘 (정지)</span>', idle: '대기' }[f.state] || f.state} · ${tierName} (x${sp.toFixed(1)})<br>입력 ${buf(f.inBuf)}<br>출력 ${list(f.outBuf)} · 누적 ${f.made}`;
          acts.push(['넣기', () => this.depositTo(f)], ['꺼내기', () => this.takeFrom(f)]);
          if (f.tier < 4 && (g.techUnlocked(['natural_power', 'steam', 'arcane', 'ancient'][f.tier]) || g.dev.allRecipes)) acts.push([`${B.industry.tiers[f.tier + 1].name}로 개량 (동력 필요)`, () => { f.tier++; }]);
          break;
        }
        case 'storage': {
          h += `${Object.values(f.stock).reduce((a, b) => a + b, 0)} / ${s.world.storageCap(f)} (단계 ${f.level})<br>${buf(f.stock)}<br>출력: ${f.outputOn ? `켜짐 (${f.rot}${f.filter ? ', ' + nameOf(f.filter) + '만' : ''})` : '꺼짐'}`;
          acts.push(['넣기 (선택 칸)', () => this.depositTo(f, true)], ['전부 꺼내기', () => this.takeFrom(f)], [f.outputOn ? '출력 끄기' : '출력 켜기', () => { f.outputOn = !f.outputOn; }]);
          acts.push(['출력 필터: 선택 칸 아이템', () => { const sl = s.inv.selected(); f.filter = sl ? sl.id : null; }]);
          if (f.level < B.logistics.storageMaxLevel) acts.push(['용량 업그레이드 (목재 10, 철괴 2)', () => { if (s.free() || (s.inv.has({ wood: 10, iron_ingot: 2 }) && s.inv.remove('wood', 10) && s.inv.remove('iron_ingot', 2))) f.level++; else this.toast('재료가 부족합니다.'); }]);
          break;
        }
        case 'sorter': h += `필터: <b>${f.filter ? nameOf(f.filter) : '없음 (모두 옆으로)'}</b><br>일치 → 정면, 나머지 → 좌우 번갈아`; acts.push(['필터: 선택 칸 아이템', () => { const sl = s.inv.selected(); f.filter = sl ? sl.id : null; }]); break;
        case 'splitter': h += '입력 1 → 정면/좌/우 번갈아 분배'; break;
        case 'merger': h += '뒤/좌/우 입력 → 정면 1개로 합류'; break;
        case 'pump': h += `물 생산 ${B.industry.pumpSec}초/개 · 출력 ${f.rot}`; break;
        case 'board': h += `빈 의뢰서 ${f.stock.quest || 0} / ${B.quests.maxBoard}<br>의뢰 템플릿 ${g.guild.templates.length}개 · 모집 중 ${g.guild.quests.filter((q) => q.state === 'open').length}`; acts.push(['의뢰서 넣기', () => this.depositTo(f)], ['의뢰 관리', () => this.openGuild('quests')]); break;
        case 'shop': h += `판매 재고: ${Object.entries(f.stock).map(([k, n]) => `${nameOf(k)} ${n} (${g.market.price(k)}G)`).join(', ') || '없음'}<br><span class="note">모험가가 개인 자금으로 시장가에 구매합니다.</span>`; acts.push(['장비·물약 넣기', () => this.depositTo(f)], ['꺼내기', () => this.takeFrom(f)]); break;
        case 'counter': h += `매입한 전리품: ${buf(f.stock)}<br>출력 ${f.rot} → 컨베이어로 공장에 공급`; acts.push(['꺼내기', () => this.takeFrom(f)]); break;
        case 'lab': h += '몬스터 표본(영구)과 생산 실적으로 기술을 해금합니다.'; acts.push(['연구 열기', () => this.openGuild('research')]); break;
        case 'school': h += `학생 수용 ${B.housing.schoolCap}명 (종합 모험가 학교)<br>교사(은퇴 모험가) ${g.people.filter((p) => p.alive && p.stage === 'retired').length}명`; break;
        case 'dorm': h += `숙소 수용 +${B.housing.dormCap} (전체 ${g.housingCap()}명)`; break;
        case 'generator': h += `동력 공급 ${B.industry.powerPerWheel} · 전체 공급 ${g.world.power.supply} / 수요 ${g.world.power.demand} (충족 ${Math.round(g.world.power.sat * 100)}%)`; break;
        default: break;
      }
      if (d.rotatable) acts.push(['회전 (R)', () => s.world.rotateFacility(f)]);
    }
    const sig = h + acts.map((a) => a[0]).join('|');
    if (el.dataset.sig === sig) return;
    el.dataset.sig = sig; el.innerHTML = h + '<div class="row" id="in-acts"></div>';
    for (const [label, fn] of acts) { const b = document.createElement('button'); b.textContent = label; b.onclick = () => { fn(); el.dataset.sig = ''; this.renderInspector(); this.renderHotbar(); }; $('in-acts').appendChild(b); }
    const sel = $('in-recipe'); if (sel) sel.onchange = () => { t.fac.recipe = sel.value; el.dataset.sig = ''; sel.blur(); };
  }
  personCard(p, u) {
    const st = u ? u.st : null; const g = this.scene?.game;
    const spouse = p.spouse && g ? g.people.byId.get(p.spouse) : null;
    const stats = B.people.stats.map((k) => `${STAT_NAMES[k]} ${st ? st[k].toFixed(0) : p.init[k]} ${stars(p.talent[k])}`).join('<br>');
    const el = B.people.elements.map((e) => `<span class="${p.aff[e] >= 60 ? 'good' : 'muted'}">${ELEM_NAMES[e]} ${p.aff[e]}</span>`).join(' ');
    return `<h3>${esc(p.name)} ${p.interest ? '★' : ''} <span class="tag">${B.races[p.race].name}</span></h3>` +
      `${p.sex === 'M' ? '남' : '여'} · ${p.age}세 (수명 ~${p.lifespan}) · ${p.job ? B.jobs[p.job].name : '학생'} Lv.${p.level} · <b>${gradeName(p.grade)}</b>등급<br>` +
      (u ? `체력 ${Math.ceil(u.hp)}/${u.maxHp} · 마나 ${Math.ceil(u.mp)}/${u.maxMp} · 피로 ${Math.round(p.fatigue)}<br>상태 <b>${stateName(u.state)}</b>${u.quest ? ` · ${esc(questLabel(u.quest))} (${Math.floor(u.quest.progress)}/${u.quest.count})` : ''}${u.injuredT > 0 ? ' <span class="bad">부상</span>' : ''}<br>` : '') +
      `자금 ${n0(p.gold)}G · 의뢰 ${p.quests} · 처치 ${p.kills}<br>장비: ${p.equip.weapon ? nameOf(p.equip.weapon) : '맨손'}, ${p.equip.armor ? nameOf(p.equip.armor) : '갑옷 없음'}<br>` +
      `<div style="margin-top:4px">${stats}</div><div style="margin-top:4px">원소 ${el}</div>` +
      `${p.traits.length ? `특성: ${p.traits.join(', ')}<br>` : ''}${spouse ? `배우자 ${esc(spouse.name)} · ` : ''}자녀 ${p.children.length} · ${p.gen}세대<br>` +
      `<span class="note">${p.history.slice(-4).map(esc).join('<br>')}</span>`;
  }
  depositTo(f, selectedOnly = false) {
    const s = this.scene; if (!this.near(f)) { this.toast('시설 가까이(8칸 이내)에서만 넣을 수 있습니다.'); return; }
    const W = s.world; let moved = 0;
    const ports = W.portsOf(f).filter((p) => p.kind === 'in');
    const ids = selectedOnly ? [s.inv.selected()?.id].filter(Boolean) : Object.keys(s.inv.totals());
    for (const id of ids) for (let guard = 0; guard < 200 && s.inv.count(id) > 0; guard++) {
      const p = ports.find((q) => W.facAccepts(f, id, q)); if (!p) break;
      W.facReceive(f, id, p); s.inv.remove(id, 1); moved++;
    }
    this.toast(moved ? `${moved}개 넣었습니다.` : '넣을 수 있는 아이템이 없습니다.');
  }
  takeFrom(f) {
    const s = this.scene; if (!this.near(f)) { this.toast('시설 가까이(8칸 이내)에서만 꺼낼 수 있습니다.'); return; }
    const got = {};
    for (const t of f.outBuf.splice(0)) got[t] = (got[t] || 0) + 1;
    for (const [k, n] of Object.entries(f.stock)) { got[k] = (got[k] || 0) + n; delete f.stock[k]; }
    s.giveAll(got); this.toast(`${Object.values(got).reduce((a, b) => a + b, 0)}개 꺼냈습니다.`);
  }

  // ---------------- inventory ----------------
  openInventory() {
    const s = this.scene; if (!s) return;
    this.openPanel('inv', (el) => {
      const box = s.game.guild.overflow || {};
      el.innerHTML = '<h2>인벤토리</h2><div class="note">칸을 클릭해 집고, 다른 칸을 클릭해 옮기거나 바꿉니다. 첫 줄(1~0)이 단축바입니다.</div><div class="grid" id="inv-grid"></div>' +
        (Object.keys(box).length ? `<h3>길드 보관함</h3><div>${Object.entries(box).map(([k, n]) => `${nameOf(k)} ${n}`).join(', ')}</div><div class="row"><button id="inv-box">보관함에서 가져오기</button></div>` : '') +
        '<div class="row" style="justify-content:flex-end"><button id="inv-close" class="on">닫기 (Esc)</button></div>';
      const grid = $('inv-grid');
      s.inv.slots.forEach((sl, i) => {
        const d = document.createElement('div'); d.className = 'slot' + (i === this.pick ? ' pick' : '') + (i === s.inv.sel ? ' sel' : '');
        if (sl) { d.appendChild(this.ic(sl.id, 16, 2)); d.insertAdjacentHTML('beforeend', `<span class="n">${sl.n}</span>`); d.title = nameOf(sl.id); }
        d.onclick = () => { if (this.pick < 0) { if (sl) this.pick = i; } else { s.inv.swap(this.pick, i); this.pick = -1; this.renderHotbar(); } this.rerender(); };
        grid.appendChild(d);
      });
      $('inv-close').onclick = () => this.closeTop();
      const bb = $('inv-box'); if (bb) bb.onclick = () => { const b = s.game.guild.overflow; s.game.guild.overflow = {}; s.giveAll(b); this.renderHotbar(); this.rerender(); };
    });
  }

  // ---------------- crafting (Terraria-style list) ----------------
  openCraft(focusId) {
    const s = this.scene; if (!s) return;
    this.craftSel = focusId || this.craftSel || null; this.craftFilter = this.craftFilter || 'can'; this.craftQty = this.craftQty || 1;
    this.openPanel('craft', (el) => {
      const all = handRecipes(s.game);
      const cat = (r) => { const o = Object.keys(r.out)[0]; const c = ITEMS[o]?.cat; return c === 'build' ? 'build' : c === 'equip' || c === 'consum' ? 'equip' : 'inter'; };
      const list = all.filter((r) => this.craftFilter === 'all' || (this.craftFilter === 'can' ? maxCraftable(s.inv, r) > 0 : cat(r) === this.craftFilter));
      list.sort((a, b) => (maxCraftable(s.inv, b) > 0) - (maxCraftable(s.inv, a) > 0));
      const r = RECIPES.find((x) => x.id === this.craftSel) || list[0];
      el.innerHTML = `<h2>제작</h2><div class="tabs">${[['can', '제작 가능'], ['all', '전체'], ['build', '건설'], ['inter', '가공'], ['equip', '장비·소모품']].map(([k, n]) => `<button data-f="${k}" class="${this.craftFilter === k ? 'on' : ''}">${n}</button>`).join('')}<button id="cr-close" style="margin-left:auto">닫기 (Esc)</button></div>` +
        '<div class="craft"><div class="rlist panel" id="cr-list" style="padding:4px"></div><div id="cr-detail"></div></div>' +
        '<div class="note">공장 기계로도 같은 제작법을 자동 생산할 수 있습니다 (기계 클릭 → 제작법 선택). 잠긴 제작법은 연구로 해금됩니다.</div>';
      el.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { this.craftFilter = b.dataset.f; this.rerender(); }));
      $('cr-close').onclick = () => this.closeTop();
      const lst = $('cr-list');
      if (!list.length) lst.innerHTML = '<div class="note" style="padding:6px">제작 가능한 것이 없습니다. "전체" 탭에서 필요한 재료를 확인하세요.</div>';
      for (const x of list) {
        const m = maxCraftable(s.inv, x); const o = Object.keys(x.out)[0];
        const d = document.createElement('div'); d.className = 'rrow' + (r && x.id === r.id ? ' sel' : '') + (m ? '' : ' no');
        d.appendChild(this.ic(o, 16, 1.5)); d.insertAdjacentHTML('beforeend', `<span>${nameOf(o)}${x.out[o] > 1 ? ` ×${x.out[o]}` : ''}</span><span class="muted" style="margin-left:auto">${m ? `최대 ${m}` : ''}</span>`);
        d.onclick = () => { this.craftSel = x.id; this.rerender(); };
        lst.appendChild(d);
      }
      if (!r) return;
      const det = $('cr-detail'); const m = maxCraftable(s.inv, r); const o = Object.keys(r.out)[0];
      const locked = !(s.game.dev.allRecipes || s.game.techUnlocked(r.tech)) || !r.stations.includes('hand');
      const stName = (st) => (st === 'hand' ? '수작업' : Object.values(FACILITIES).find((f) => f.station === st)?.name || st);
      det.innerHTML = `<h3>${nameOf(o)} ×${r.out[o]}</h3><div class="note">기준가 ${basePrice(o)}G · 제작처: ${r.stations.map(stName).join(', ')}${locked && r.tech ? ` · <span class="bad">연구 필요: ${TECH[r.tech].name}</span>` : ''}</div><h3>재료</h3><div id="cr-ing"></div>` +
        `<div class="row">수량 ${[1, 5, 10].map((q) => `<button data-q="${q}" class="${this.craftQty === q ? 'on' : ''}">${q}</button>`).join('')}<button data-q="max" class="${this.craftQty === 'max' ? 'on' : ''}">최대 (${m})</button></div>` +
        `<div class="row"><button id="cr-go" class="on" ${m && !locked ? '' : 'disabled'}>제작</button></div><div id="cr-sub"></div>`;
      const ing = $('cr-ing');
      for (const [k, n] of Object.entries(r.in)) {
        const have = s.inv.count(k); const q = this.craftQty === 'max' ? Math.max(1, m) : this.craftQty;
        const d = document.createElement('div'); d.className = 'ing'; d.appendChild(this.ic(k, 16, 1.5));
        d.insertAdjacentHTML('beforeend', `<span class="${have >= n * q ? 'good' : 'bad'}">${nameOf(k)} ${have}/${n * q}</span><span class="muted">→ 얻는 방법</span>`);
        d.onclick = () => {
          const sub = recipeProducing(k).filter((x) => !x.id.startsWith('fac_'));
          $('cr-sub').innerHTML = sub.length ? `<h3>${nameOf(k)} 만드는 법</h3>` + sub.map((x) => `<div class="rrow" data-r="${x.id}">${Object.entries(x.in).map(([a, b]) => `${nameOf(a)}×${b}`).join(' + ')} <span class="muted">(${x.stations.map(stName).join('/')})</span></div>`).join('')
            : `<div class="note">${nameOf(k)}: ${k.endsWith('_ingot') || k === 'charcoal' ? '용광로에서 제련' : ITEMS[k]?.cat === 'loot' ? '모험가의 몬스터 토벌 전리품 (전리품 매입소)' : k === 'water' ? '물가에서 E 또는 양수기' : '채집(E) 또는 채굴기'}</div>`;
          $('cr-sub').querySelectorAll('[data-r]').forEach((e) => (e.onclick = () => { this.craftSel = e.dataset.r; this.rerender(); }));
        };
        ing.appendChild(d);
      }
      det.querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => { this.craftQty = b.dataset.q === 'max' ? 'max' : +b.dataset.q; this.rerender(); }));
      $('cr-go').onclick = () => {
        const q = this.craftQty === 'max' ? m : this.craftQty; const done = craft(s.inv, r, q);
        if (done) { for (const [k, n] of Object.entries(r.out)) { s.world.made[`${k}_crafted`] = (s.world.made[`${k}_crafted`] || 0) + n * done; if (CODEX[k]) s.game.codexAdd(k); } this.toast(`${nameOf(o)} ×${r.out[o] * done} 제작`); }
        else this.toast('재료가 부족합니다.');
        this.renderHotbar(); this.rerender();
      };
    });
  }

  // ---------------- guild panel ----------------
  openGuild(tab) {
    const s = this.scene; if (!s) return; this.gtab = tab || this.gtab || 'over';
    this.openPanel('guild', (el) => {
      const g = s.game;
      const tabs = [['over', '개요'], ['adv', '모험가'], ['quests', '의뢰'], ['research', '연구'], ['codex', '도감'], ['econ', '경제'], ['history', '기록']];
      el.innerHTML = `<h2>길드 관리</h2><div class="tabs">${tabs.map(([k, n]) => `<button data-t="${k}" class="${this.gtab === k ? 'on' : ''}">${n}</button>`).join('')}<button id="g-close" style="margin-left:auto">닫기 (Esc)</button></div><div id="g-body"></div>`;
      el.querySelectorAll('[data-t]').forEach((b) => (b.onclick = () => { this.gtab = b.dataset.t; this.rerender(); }));
      $('g-close').onclick = () => this.closeTop();
      const body = $('g-body'); const T = this.gtab;
      if (T === 'over') {
        const alive = g.people.filter((p) => p.alive);
        body.innerHTML = `<div class="kv"><div>연도 <b>${g.life.year + 1}년차</b></div><div>길드 자금 <b>${n0(g.ledger.guild)}G</b></div><div>보상 예치 ${n0(g.guild.escrow)}G</div><div>모험가 ${g.units.size}명</div>` +
          `<div>전체 주민 ${alive.length} / 숙소 ${g.housingCap()}</div><div>학생 ${alive.filter((p) => p.stage === 'student').length} / 학교 ${g.schoolCap()}</div><div>은퇴(교사 후보) ${alive.filter((p) => p.stage === 'retired').length}</div><div>어린이 ${alive.filter((p) => p.stage === 'child').length}</div>` +
          `<div>의뢰 게시 ${g.guild.posted} · 완료 ${g.guild.completed} · 실패 ${g.guild.failed}</div><div>처치 ${g.stats.kills} · 전투 불능 ${g.stats.downs} · 구조 ${g.stats.rescues}</div></div>` +
          `<h3>모험가 모집</h3><div class="row"><button id="g-recruit">외부 성인 모집 (${B.economy.recruitCost}G)</button><span class="note">종족·직업·재능·원소·외형은 무작위 생성 후 저장됩니다.</span></div>` +
          '<div class="note">일반 의뢰는 플레이어가 만든 의뢰서로만 게시됩니다. 모험가는 게시판 → 상점 → 이동 → 전투 → 귀환 → 판매 → 휴식을 스스로 반복합니다. 관심 있는 모험가만 ★로 표시해 따라가 보세요.</div>';
        $('g-recruit').onclick = () => { const p = g.recruit(); if (p) this.toast(`${p.name} (${B.races[p.race].name} ${B.jobs[p.job].name}) 합류 — 재능 평균 ${talentAvg(p).toFixed(1)}, 원소 적성 ${aptCount(p)}`); this.rerender(); };
      }
      if (T === 'adv') {
        const rows = g.people.filter((p) => p.alive).sort((a, b) => (b.interest - a.interest) || (b.level - a.level));
        body.innerHTML = `<table><tr><th></th><th>이름</th><th>종족</th><th>나이</th><th>직업</th><th>Lv</th><th>등급</th><th>재능 평균</th><th>원소</th><th>자금</th><th>상태</th></tr>${rows.slice(0, 200).map((p) => { const u = g.units.get(p.id); return `<tr class="click" data-id="${p.id}"><td>${p.interest ? '★' : ''}</td><td>${esc(p.name)}</td><td>${B.races[p.race].name}</td><td>${p.age}</td><td>${p.job ? B.jobs[p.job].name : '-'}</td><td>${p.level}</td><td>${gradeName(p.grade)}</td><td>${talentAvg(p).toFixed(1)}</td><td>${aptCount(p)}</td><td>${n0(p.gold)}</td><td>${u ? stateName(u.state) : { child: '어린이', student: '학생', retired: '은퇴' }[p.stage] || p.stage}</td></tr>`; }).join('')}</table>${rows.length > 200 ? `<div class="note">외 ${rows.length - 200}명</div>` : ''}`;
        body.querySelectorAll('[data-id]').forEach((tr) => (tr.onclick = () => { const p = g.people.byId.get(+tr.dataset.id); const u = g.units.get(p.id); this.closeTop(); if (u) { s.uv.selected = u; this.inspect({ unit: u }); } else this.inspect({ person: p }); }));
      }
      if (T === 'quests') this.renderQuests(body, g);
      if (T === 'research') {
        const lab = g.facsOf('lab').length;
        body.innerHTML = `${lab ? '' : '<div class="bad">연구소를 건설해야 연구할 수 있습니다.</div>'}<div class="note">표본: ${Object.entries(g.guild.samples).map(([k, n]) => `${MONSTERS[k]?.name || k} ${n}`).join(', ') || '없음'} (영구 누적, 전리품 소비와 무관)</div>` +
          `<table><tr><th>기술</th><th>내용</th><th>조건</th><th></th></tr>${Object.entries(TECH).map(([id, t]) => { const c = g.canResearch(id); const done = g.guild.tech.has(id); return `<tr><td><b>${t.name}</b></td><td>${t.desc}</td><td class="note">${done ? '<span class="good">완료</span>' : (c.miss || [c.why]).filter(Boolean).join('<br>') || '<span class="good">충족</span>'}</td><td>${done ? '' : `<button data-r="${id}" ${c.ok ? '' : 'disabled'}>해금</button>`}</td></tr>`; }).join('')}</table>`;
        body.querySelectorAll('[data-r]').forEach((b) => (b.onclick = () => { g.research(b.dataset.r); this.rerender(); }));
      }
      if (T === 'codex') {
        const cats = Object.entries(CODEX_CATS).map(([c, name]) => { const all = Object.entries(CODEX).filter(([, v]) => v[0] === c); const got = all.filter(([k]) => g.guild.codex.has(k)); return `<h3>${name} ${got.length}/${all.length}</h3><div>${all.map(([k, v]) => (g.guild.codex.has(k) ? `<span class="tag" style="background:#2f4a3a;color:#cfe">${v[1]}</span>` : '<span class="tag">???</span>')).join(' ')}</div>`; }).join('');
        body.innerHTML = cats + `<h3>도감 보상 — 길드마스터 지휘 스킬</h3>${Object.entries(COMMAND_SKILLS).map(([k, sk]) => `<div>${g.skillUnlocked(k) ? '✔' : '○'} <b>${sk.name}</b> — 필요: ${Object.entries(sk.need).map(([c, n]) => `${CODEX_CATS[c]} ${g.codexCount(c)}/${n}`).join(', ')}</div>`).join('')}<div class="note">연구소는 산업, 도감은 길드마스터의 지휘 능력을 발전시킵니다.</div>`;
      }
      if (T === 'econ') {
        const ids = ['slime', 'wolf_pelt', 'wolf_fang', 'herb', 'iron_ingot', 'sword_wood', 'staff_wood', 'bow_wood', 'mace_wood', 'armor_leather', 'sword_iron', 'armor_iron', 'potion_hp'];
        const advGold = g.people.reduce((a, p) => a + (p.alive ? p.gold : 0), 0);
        body.innerHTML = `<div class="kv"><div>전체 화폐량 <b>${n0(g.moneySupply())}G</b></div><div>길드 ${n0(g.ledger.guild)}G (+예치 ${n0(g.guild.escrow)})</div><div>모험가 합계 ${n0(advGold)}G</div><div>외부 유입 누계 ${n0(g.ledger.injected)}G</div></div>` +
          `<div class="note">흐름: ${Object.entries(g.ledger.flows).map(([k, v]) => `${{ quest: '의뢰 보상', loot: '전리품 매입', sales: '상품 판매', recruit: '모집비', used: '중고 매입' }[k] || k} ${n0(v)}G`).join(' · ')}</div>` +
          `<table><tr><th>품목</th><th>기준가</th><th>시장가</th><th>수요/분</th><th>공급/분</th><th>중고가</th></tr>${ids.map((id) => { const e = g.market.entry(id); return `<tr><td>${nameOf(id)}</td><td>${basePrice(id)}</td><td><b>${g.market.price(id)}</b></td><td>${e.emaBuy.toFixed(1)}</td><td>${e.emaSell.toFixed(1)}</td><td>${ITEMS[id].cat === 'equip' ? g.market.usedPrice(id) : '-'}</td></tr>`; }).join('')}</table>` +
          `<div class="note">시장가 = 기준가 × 계수(0.5~2.0). 계수는 수요/공급/재고에 따라 분당 최대 ${B.economy.market.maxStepPerMin * 100}%만 움직입니다 (시험 공식). 수동 가격 설정 없음.</div>`;
      }
      if (T === 'history') {
        body.innerHTML = '<div class="note">출생·성인·결혼·은퇴·사망·희귀 인재 기록 (최근 200)</div>' + (g.life.history.slice(-200).reverse().map((e) => `<div class="${e.kind === 'rare' ? 'good' : e.kind === 'death' ? 'muted' : ''}">${e.year + 1}년 — ${esc(e.text)}</div>`).join('') || '<div class="note">아직 기록이 없습니다. (현실 10분 = 게임 1년)</div>');
      }
    });
  }
  renderQuests(body, g) {
    const f = this.qf || (this.qf = { type: 'hunt', target: 'slime', count: 5, party: 2, minGrade: 0, bonus: 0, concurrent: 1 });
    const habitats = [...new Set(g.world.habitats.filter((h) => h.found).map((h) => h.type))];
    const targets = f.type === 'hunt' || f.type === 'survey' ? habitats.map((m) => [m, MONSTERS[m].name]) : f.type === 'gather' ? [['herb', '약초'], ['fiber', '식물성 섬유'], ['berry', '열매']] : [['', '가장 가까운 미탐험 지역']];
    if (!targets.find((t) => t[0] === f.target)) f.target = targets[0]?.[0] ?? '';
    const cost = g.questCost(f), reward = g.questReward(f);
    body.innerHTML = '<h3>새 의뢰 (게시판에 자동 반복 게시)</h3>' +
      `<div class="row">유형 <select id="q-type">${[['hunt', '토벌'], ['survey', '조사'], ['gather', '채집'], ['explore', '탐험']].map(([k, n]) => `<option value="${k}" ${f.type === k ? 'selected' : ''}>${n}</option>`).join('')}</select>` +
      `대상 <select id="q-target">${targets.map(([k, n]) => `<option value="${k}" ${f.target === k ? 'selected' : ''}>${n}</option>`).join('') || '<option>발견한 서식지 없음 (탐험 필요)</option>'}</select>` +
      `${f.type === 'hunt' || f.type === 'gather' ? `수량 <input id="q-count" type="number" min="1" max="50" value="${f.count}">` : ''}` +
      `파티 <input id="q-party" type="number" min="1" max="6" value="${f.party}"> 최소 등급 <select id="q-grade">${B.people.grades.map((x, i) => `<option value="${i}" ${f.minGrade === i ? 'selected' : ''}>${x}</option>`).join('')}</select>` +
      `추가 보상 <input id="q-bonus" type="number" min="0" value="${f.bonus}"> 동시 게시 <input id="q-conc" type="number" min="1" max="10" value="${f.concurrent}"></div>` +
      `<div class="note">비용: 빈 의뢰서 ${cost}장 (토벌 ${B.quests.paperPerKills}마리당 1장 = 종이 1 + 잉크 1) · 보상 ${reward}G는 게시할 때 길드 자금에서 예치됩니다.</div>` +
      `<div class="row"><button id="q-add" class="on" ${targets.length ? '' : 'disabled'}>의뢰 등록</button></div>` +
      `<h3>등록된 의뢰</h3><table><tr><th>의뢰</th><th>파티</th><th>보상</th><th>게시 중</th><th>상태</th><th></th></tr>${g.guild.templates.map((t) => `<tr><td>${esc(questLabel(t))}</td><td>${t.party}</td><td>${g.questReward(t)}G</td><td>${t.active}/${t.concurrent}</td><td class="note">${esc(t.status || '-')}</td><td><button data-tog="${t.id}">${t.enabled ? '중지' : '재개'}</button><button data-del="${t.id}">삭제</button></td></tr>`).join('')}</table>` +
      `<h3>진행 중</h3>${g.guild.quests.map((q) => `<div>${esc(questLabel(q))} — ${q.state === 'open' ? '모집 중' : '수행 중'} · ${q.party.map((id) => esc(g.people.byId.get(id)?.name || '?')).join(', ') || '-'} · ${Math.floor(q.progress)}/${q.count}</div>`).join('') || '<div class="note">없음</div>'}`;
    const upd = () => { f.type = $('q-type').value; f.target = $('q-target').value; f.count = +($('q-count')?.value || 1); f.party = +$('q-party').value; f.minGrade = +$('q-grade').value; f.bonus = +$('q-bonus').value; f.concurrent = +$('q-conc').value; };
    ['q-type', 'q-target', 'q-count', 'q-party', 'q-grade', 'q-bonus', 'q-conc'].forEach((id) => { const e = $(id); if (e) e.onchange = () => { upd(); this.rerender(); }; });
    $('q-add').onclick = () => { upd(); g.addTemplate({ ...f, count: f.type === 'hunt' || f.type === 'gather' ? f.count : 1 }); this.toast('의뢰를 등록했습니다. 게시판에 빈 의뢰서가 있으면 자동 게시됩니다.'); this.rerender(); };
    body.querySelectorAll('[data-tog]').forEach((b) => (b.onclick = () => { const t = g.guild.templates.find((x) => x.id === +b.dataset.tog); t.enabled = !t.enabled; this.rerender(); }));
    body.querySelectorAll('[data-del]').forEach((b) => (b.onclick = () => { g.guild.templates = g.guild.templates.filter((x) => x.id !== +b.dataset.del); this.rerender(); }));
  }

  // ---------------- commands ----------------
  renderCmdbar() {
    const s = this.scene; if (!s) return; const g = s.game; const c = g.guild.cmd;
    const fighting = [...g.units.values()].filter((u) => u.state === 'fight').length;
    const sk = Object.entries(COMMAND_SKILLS).filter(([k]) => g.skillUnlocked(k) || g.dev.allSkills);
    const nearFight = fighting && [...g.units.values()].some((u) => u.state === 'fight' && ((u.x - g.gm.x) ** 2 + (u.y - g.gm.y) ** 2 < 196 || c.scope === 'all'));
    const open = this.cmdOpen || nearFight || s.mode === 'combat' || c.mode !== 'auto';
    if (!open) {
      const h0 = `<button id="cmd-open">지휘 ▲</button> <span class="muted">${fighting ? `전투 중 ${fighting}명` : ''}</span>`;
      if ($('cmdbar').dataset.sig !== h0) { $('cmdbar').dataset.sig = h0; $('cmdbar').innerHTML = h0; $('cmd-open').onclick = () => { this.cmdOpen = true; this.renderCmdbar(); }; }
      return;
    }
    const html = `<button id="cmd-close" style="float:right;padding:0 6px">▼</button>` + `<div class="row" style="margin:0 0 4px"><b>지휘</b> <span class="muted">${c.scope === 'all' ? '전체' : '길드마스터 14칸 이내'} · 전투 중 ${fighting}명 · 현재 <b>${COMMANDS[c.mode]}</b></span></div>` +
      `<div class="row" style="margin:0">${Object.entries(COMMANDS).map(([k, n]) => `<button data-c="${k}" class="${c.mode === k ? 'on' : ''}">${n}</button>`).join('')}</div>` +
      (sk.length ? `<div class="row" style="margin:4px 0 0">${sk.map(([k, v]) => { const cd = Math.max(0, (g.guild.skillCd[k] || 0) - g.time); return `<button data-s="${k}" ${cd > 0 ? 'disabled' : ''}>${v.name}${cd > 0 ? ` ${cd.toFixed(0)}s` : ''}</button>`; }).join('')}</div>` : '');
    if ($('cmdbar').dataset.sig === html) return; $('cmdbar').dataset.sig = html; $('cmdbar').innerHTML = html;
    $('cmd-close').onclick = () => { this.cmdOpen = false; g.command('auto'); this.renderCmdbar(); };
    $('cmdbar').querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => {
      const m = b.dataset.c;
      if (m === 'rally') { g.command('rally', { x: g.gm.x, y: g.gm.y }); this.toast('집결: 길드마스터 위치'); }
      else if (m === 'move') { this.cmdPlacing = 'move'; this.toast('지도를 클릭해 이동 위치를 지정하세요.'); }
      else if (m === 'focus') { const boss = g.monsters.find((x) => MONSTERS[x.type].boss); if (boss) { g.command('focus', { target: boss }); this.toast('집중 공격: 보스'); } else { this.focusPick = true; this.toast('몬스터를 클릭해 집중 대상을 지정하세요.'); } }
      else { g.command(m); this.toast(`명령: ${COMMANDS[m]}`); }
      $('cmdbar').dataset.sig = ''; this.renderCmdbar();
    }));
    $('cmdbar').querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => { if (g.useSkill(b.dataset.s)) this.toast(`지휘 스킬: ${COMMAND_SKILLS[b.dataset.s].name}`); $('cmdbar').dataset.sig = ''; this.renderCmdbar(); }));
  }

  // ---------------- settings ----------------
  openSettings() {
    const s = this.scene; if (!s) return;
    this.openPanel('settings', (el) => {
      el.innerHTML = `<h2>설정</h2><div class="row"><span class="lbl">운송 아이템 크기</span>${[8, 10, 12].map((z) => `<button data-z="${z}" class="${(s.settings.itemSize || 10) === z ? 'on' : ''}">${z}px${z === 10 ? ' (기본)' : ''}</button>`).join('')}</div>` +
        `<div class="row"><span class="lbl">방향 표시</span><label><input type="checkbox" id="st-dirs" ${s.settings.dirsInDirect ? 'checked' : ''}> 직접 조작 중에도 표시</label></div>` +
        '<div class="row"><button id="st-app">길드마스터 외형 변경</button><button id="st-close" class="on">닫기</button></div>';
      el.querySelectorAll('[data-z]').forEach((b) => (b.onclick = () => { s.settings.itemSize = +b.dataset.z; saveSettings(s.settings); s.logi.setItemSize(+b.dataset.z); this.rerender(); }));
      $('st-dirs').onchange = (e) => { s.settings.dirsInDirect = e.target.checked; saveSettings(s.settings); s.refreshDirs(); };
      $('st-close').onclick = () => this.closeTop();
      $('st-app').onclick = () => { this.closeTop(); this.openCreator(s.player.appearance, (a) => s.player.setAppearance(a)); };
    });
  }

  // ---------------- developer menu (labs / sandbox only; separate saves) ----------------
  openDev() {
    const s = this.scene; if (!s || !s.modeDef.dev) return; const g = s.game;
    this.dv = this.dv || { race: '', job: '', talent: 0, allElem: false, level: 1, count: 5, mon: 'slime', monN: 5 };
    const dv = this.dv;
    this.openPanel('dev', (el) => {
      el.innerHTML = `<h2>개발자 테스트 메뉴 <span class="tag">${esc(s.modeDef.name)} — 일반 저장과 분리</span></h2>` +
        `<h3>해금 · 자원</h3><div class="row"><button id="d-unlock">모든 제작법·기술 해금</button><button id="d-res">자원·건설물 +99</button><button id="d-gold">길드 골드 +1000</button><label><input type="checkbox" id="d-free" ${g.dev.freeBuild ? 'checked' : ''}> 무료 건설</label><label><input type="checkbox" id="d-death" ${g.dev.deathOnDown ? 'checked' : ''}> 구조 실패 시 사망</label></div>` +
        `<h3>시간 · 속도</h3><div class="row">배속 ${[1, 10, 100].map((x) => `<button data-ts="${x}" class="${g.timeScale === x ? 'on' : ''}">x${x}</button>`).join('')}<button id="d-pause">${this.paused ? '재개' : '일시정지'}</button><button id="d-year">1년 진행</button> 생산 속도 ${[1, 5, 20].map((x) => `<button data-sp="${x}" class="${g.world.speedMult === x ? 'on' : ''}">x${x}</button>`).join('')}</div>` +
        `<h3>모험가 생성</h3><div class="row">종족 <select id="d-race"><option value="">무작위</option>${Object.entries(B.races).map(([k, r]) => `<option value="${k}" ${dv.race === k ? 'selected' : ''}>${r.name}</option>`).join('')}</select>` +
        `직업 <select id="d-job"><option value="">자동</option>${Object.entries(B.jobs).map(([k, j]) => `<option value="${k}" ${dv.job === k ? 'selected' : ''}>${j.name}</option>`).join('')}</select>` +
        `재능 <select id="d-tal"><option value="0">무작위</option>${[1, 2, 3, 4, 5].map((x) => `<option value="${x}" ${dv.talent === x ? 'selected' : ''}>전 능력 ${x}성</option>`).join('')}</select>` +
        `<label><input type="checkbox" id="d-elem" ${dv.allElem ? 'checked' : ''}> 전 원소 친화</label> 레벨 <input id="d-lv" type="number" min="1" max="100" value="${dv.level}"> 수 <input id="d-n" type="number" min="1" max="500" value="${dv.count}"> <button id="d-spawn" class="on">생성</button></div>` +
        '<div class="row"><button id="d-family">시험 가족 생성 (부부 + 자녀)</button><button id="d-age">선택 인물 +10세</button><button id="d-retire">선택 인물 즉시 은퇴</button><button id="d-res1000">주민 1,000명 (추상)</button></div>' +
        `<h3>몬스터</h3><div class="row"><select id="d-mon">${Object.entries(MONSTERS).map(([k, m]) => `<option value="${k}" ${dv.mon === k ? 'selected' : ''}>${m.name}</option>`).join('')}</select> 수 <input id="d-mn" type="number" min="1" max="300" value="${dv.monN}"><button id="d-monb">근처에 생성</button>${s.mode === 'combat' ? '<button id="d-party">시험 파티 4명 (Lv10, 기본 장비)</button><button id="d-boss">투기장에 보스 생성</button><button id="d-trial">자동 비교 실행 (명령 유/무 ×10)</button>' : ''}</div>` +
        `<h3>대량 생성 · 측정 (TEST E)</h3><div class="row">컨베이어 ${[1000, 5000, 10000].map((n) => `<button data-belts="${n}">${n.toLocaleString()}</button>`).join('')} 모험가 총원 ${[10, 50, 100, 200, 500].map((n) => `<button data-advs="${n}">${n}</button>`).join('')}<button id="d-saveload">저장·불러오기 시간 측정</button></div>` +
        '<div class="row"><button id="d-fps">FPS·처리 시간 표시 (F3)</button><button id="d-reset" style="border-color:#a33">이 모드의 테스트 기록 초기화</button><button id="d-close" class="on" style="margin-left:auto">닫기</button></div><div id="d-out" class="note"></div>';
      const read = () => { dv.race = $('d-race').value; dv.job = $('d-job').value; dv.talent = +$('d-tal').value; dv.allElem = $('d-elem').checked; dv.level = +$('d-lv').value; dv.count = +$('d-n').value; dv.mon = $('d-mon').value; dv.monN = +$('d-mn').value; };
      const out = (t) => { $('d-out').innerHTML = t; };
      $('d-close').onclick = () => this.closeTop();
      $('d-unlock').onclick = () => { g.dev.allRecipes = true; for (const k of Object.keys(TECH)) g.guild.tech.add(k); this.toast('모든 제작법·기술 해금'); };
      $('d-res').onclick = () => { for (const k of ['wood', 'stone', 'coal', 'iron_ore', 'iron_ingot', 'water', 'paper', 'ink', 'quest', 'belt_1', 'fac_small_miner', 'fac_furnace', 'fac_chest', 'fac_quest_board', 'fac_shop', 'fac_counter', 'fac_lab', 'fac_forge', 'fac_pump']) s.giveAll({ [k]: 99 }); this.renderHotbar(); this.toast('자원·건설물 +99'); };
      $('d-gold').onclick = () => { g.ledger.inject(1000, 'dev'); this.toast('길드 골드 +1000 (개발자 유입으로 기록)'); };
      $('d-free').onchange = (e) => { g.dev.freeBuild = e.target.checked; };
      $('d-death').onchange = (e) => { g.dev.deathOnDown = e.target.checked; };
      el.querySelectorAll('[data-ts]').forEach((b) => (b.onclick = () => { g.timeScale = +b.dataset.ts; this.rerender(); }));
      el.querySelectorAll('[data-sp]').forEach((b) => (b.onclick = () => { g.world.speedMult = +b.dataset.sp; this.rerender(); }));
      $('d-pause').onclick = () => { this.paused = !this.paused; this.rerender(); };
      $('d-year').onclick = () => { g.tickYear(); this.toast(`${g.life.year + 1}년차로 진행`); };
      $('d-spawn').onclick = () => {
        read(); let n = 0;
        for (let i = 0; i < dv.count; i++) {
          const opt = { gold: 30 }; if (dv.race) opt.race = dv.race; if (dv.job) opt.job = dv.job;
          if (dv.talent) opt.talent = Object.fromEntries(B.people.stats.map((k) => [k, dv.talent]));
          if (dv.allElem) opt.aff = Object.fromEntries(B.people.elements.map((e) => [e, 80 + Math.floor(Math.random() * 20)]));
          const p = g.recruit(opt, true); if (!p) continue; n++;
          if (dv.level > 1) { p.level = dv.level; p.grade = B.people.gradeByLevel.filter((l) => dv.level >= l).length - 1; g.refreshUnit(g.units.get(p.id), true); }
        }
        this.toast(`모험가 ${n}명 생성`);
      };
      $('d-family').onclick = () => {
        const a = g.recruit({ sex: 'F' }, true), b = g.recruit({ sex: 'M', race: a.race }, true);
        a.spouse = b.id; b.spouse = a.id; const c = makePerson(g.rnd, { parents: [a, b], race: a.race, age: 0, born: g.life.year }); c.stage = 'child'; c.job = null;
        a.children.push(c.id); b.children.push(c.id); g.addPerson(c);
        this.toast(`가족 생성: ${a.name}·${b.name} → ${c.name} (재능 평균 ${talentAvg(c).toFixed(1)}, 원소 ${aptCount(c)})`);
      };
      const selP = () => this.inspTarget?.unit?.p || this.inspTarget?.person;
      $('d-age').onclick = () => { const p = selP(); if (!p) return this.toast('먼저 인물을 선택하세요.'); p.age += 10; this.toast(`${p.name} ${p.age}세`); };
      $('d-retire').onclick = () => { const p = selP(); if (!p) return this.toast('먼저 인물을 선택하세요.'); p.stage = 'retired'; const u = g.units.get(p.id); if (u) g.removeUnit(u); p.history.push(`${g.life.year}년 은퇴 (개발자)`); this.inspect(null); this.toast(`${p.name} 은퇴`); };
      $('d-res1000').onclick = () => { const t0 = performance.now(); for (let i = 0; i < 1000; i++) { const p = makePerson(g.rnd, { age: Math.floor(Math.random() * 60) }); if (p.stage === 'adult') p.stage = 'retired'; g.addPerson(p); } const t1 = performance.now(); g.tickYear(); out(`주민 1,000명 추가 (${(t1 - t0).toFixed(0)} ms), 1년 인생 계산 ${(performance.now() - t1).toFixed(0)} ms.`); };
      $('d-monb').onclick = () => { read(); for (let i = 0; i < dv.monN; i++) g.spawnMonster(dv.mon, g.gm.x + (Math.random() - 0.5) * 8 + 4, g.gm.y + (Math.random() - 0.5) * 6); this.toast(`${MONSTERS[dv.mon].name} ${dv.monN}마리`); };
      const pb = $('d-party'); if (pb) pb.onclick = () => {
        const team = [];
        for (const job of ['swordsman', 'mage', 'archer', 'cleric']) {
          const p = g.recruit({ job, gold: 50 }, true); p.level = 10; p.equip.weapon = { swordsman: 'sword_wood', mage: 'staff_wood', archer: 'bow_wood', cleric: 'mace_wood' }[job]; p.equip.armor = 'armor_leather'; p.inv.potion_hp = 2;
          const u = g.units.get(p.id); g.refreshUnit(u, true); u.x = 34 + Math.random() * 2; u.y = 19 + Math.random() * 2; team.push(u);
        }
        const q = { id: g.guild.nextQuestId++, type: 'hunt', target: 'golem', count: 1, progress: 0, state: 'taken', party: team.map((u) => u.id), startedAt: g.time, goal: { x: 46, y: 20 }, reward: 0, size: 4 };
        for (const u of team) { u.quest = q; u.state = 'travel'; g.goTo(u, 44 + Math.random(), 20 + Math.random()); }
        this.toast('시험 파티 4명이 투기장으로 이동합니다. 보스를 생성해 관찰하세요.');
      };
      const bb = $('d-boss'); if (bb) bb.onclick = () => { g.spawnMonster('golem', g.world.arena.x, g.world.arena.y); g.gm.x = 40; this.toast('시험 보스 생성 — 붉은 원은 공격 예고 범위입니다.', 'boss'); };
      const tb = $('d-trial'); if (tb) tb.onclick = () => { out('실행 중… (화면이 잠시 멈출 수 있습니다)'); setTimeout(async () => { const { bossTrials } = await import('../sim/trials.js'); out(bossTrials(10)); }, 30); };
      el.querySelectorAll('[data-belts]').forEach((b) => (b.onclick = async () => {
        if (!g.world.benchArea) return this.toast('TEST E 성능 실험실에서 사용하세요.');
        const { buildBeltBench } = await import('../sim/maps.js'); const t0 = performance.now(); const n = buildBeltBench(g.world, +b.dataset.belts); out(`컨베이어 ${n.toLocaleString()}개 배치 (${(performance.now() - t0).toFixed(0)} ms). 관리자 시점(Tab)으로 오른쪽 영역을 확인하세요.`);
      }));
      el.querySelectorAll('[data-advs]').forEach((b) => (b.onclick = () => {
        const t0 = performance.now(); const target = +b.dataset.advs; const n = Math.max(0, target - g.units.size);
        for (let i = 0; i < n; i++) g.recruit({ gold: 40 }, true);
        if (!g.guild.templates.length) { g.addTemplate({ type: 'hunt', target: 'slime', count: 5, party: 3, concurrent: 999 }); g.addTemplate({ type: 'hunt', target: 'wolf', count: 5, party: 3, concurrent: 999 }); }
        let board = g.facsOf('board')[0]; if (!board) board = g.world.placeFacility('quest_board', Math.floor(g.gm.x) + 2, Math.floor(g.gm.y) + 2);
        if (board) board.stock.quest = 30; g.ledger.inject(5000, 'dev'); g.devBoardRefill = true;
        out(`모험가 ${n}명 추가 (${(performance.now() - t0).toFixed(0)} ms). 총 ${g.units.size}명. 의뢰판·보상 자금이 자동 준비되었습니다.`);
      }));
      $('d-saveload').onclick = async () => {
        const t0 = performance.now(); const raw = JSON.stringify(g.serialize()); const t1 = performance.now();
        const { Game } = await import('../sim/game.js'); const maps = await import('../sim/maps.js');
        const w2 = s.mode === 'perf' ? maps.createPerfLab() : s.mode === 'combat' ? maps.createCombatLab() : maps.createMainWorld();
        const g2 = new Game(w2, { seed: 1 }); const t2 = performance.now(); g2.restore(JSON.parse(raw)); const t3 = performance.now();
        out(`직렬화 ${(t1 - t0).toFixed(0)} ms · 크기 ${(raw.length / 1024).toFixed(0)} KB · 복원 ${(t3 - t2).toFixed(0)} ms · 복원 후 컨베이어 ${w2.beltCount}/${g.world.beltCount}, 모험가 ${g2.units.size}/${g.units.size}, 시설 ${w2.facilities.size}/${g.world.facilities.size}`);
      };
      $('d-fps').onclick = () => this.toggleDebug();
      $('d-reset').onclick = () => { if (!confirm('이 모드의 저장을 지우고 처음부터 시작할까요? (TEST A 일반 저장은 영향 없음)')) return; deleteSave(s.mode); const m = s.mode; this.closeTop(); this.exitGame(); this.start(m, false, randomAppearance()); };
    });
  }
}
export const ui = new UI();
