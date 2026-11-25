// TEST C (life) and TEST D (economy) lab screens — DOM only, no Phaser world needed.
import { B, STAT_NAMES, ELEM_NAMES } from '../data/balance.js';
import { mulberry32 } from '../sim/world.js';
import { makePerson, rollTalent, inheritTalentWeights, inheritTalent, rollElements, aptCount, talentAvg, gradeName } from '../sim/people.js';
import { Life } from '../sim/life.js';

const $ = (id) => document.getElementById(id);
const pct = (x) => `${(x * 100).toFixed(1)}%`;

export function openLab(kind, ui) {
  $('scr-lab').classList.remove('hidden');
  if (kind === 'life') lifeLab(ui); else econLab(ui);
}
function closeLab(ui) { clearInterval(window.__labTimer); window.__labStop = true; $('scr-lab').classList.add('hidden'); ui.showTitle(); }

function chart(canvas, series, opt = {}) {
  const c = canvas, ctx = c.getContext('2d'); const W = c.width = c.clientWidth * devicePixelRatio, H = c.height = c.clientHeight * devicePixelRatio;
  ctx.clearRect(0, 0, W, H); ctx.font = `${11 * devicePixelRatio}px sans-serif`;
  const all = series.flatMap((s) => s.data); if (!all.length) return;
  const max = opt.max ?? Math.max(...all, 1), min = opt.min ?? Math.min(0, ...all);
  const n = Math.max(...series.map((s) => s.data.length));
  ctx.strokeStyle = '#3e3430'; ctx.beginPath(); ctx.moveTo(30 * devicePixelRatio, H - 16 * devicePixelRatio); ctx.lineTo(W, H - 16 * devicePixelRatio); ctx.stroke();
  ctx.fillStyle = '#c3b49a'; ctx.fillText(String(Math.round(max)), 2, 12 * devicePixelRatio); ctx.fillText(String(Math.round(min)), 2, H - 18 * devicePixelRatio);
  series.forEach((s, k) => {
    ctx.strokeStyle = s.color; ctx.lineWidth = 2 * devicePixelRatio; ctx.beginPath();
    s.data.forEach((v, i) => { const x = 30 * devicePixelRatio + (W - 34 * devicePixelRatio) * (n > 1 ? i / (n - 1) : 0); const y = (H - 18 * devicePixelRatio) - (H - 30 * devicePixelRatio) * ((v - min) / (max - min || 1)); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke(); ctx.fillStyle = s.color; ctx.fillText(s.name, 40 * devicePixelRatio + k * 120 * devicePixelRatio, 12 * devicePixelRatio);
  });
}

// ---------------- TEST C ----------------
function lifeLab(ui) {
  window.__labStop = false;
  const st = { rnd: mulberry32(Date.now() % 100000), pop: [], life: null, hist: [], housing: 300, school: 40, speed: 0, acc: 0, sel: null };
  const reset = (n) => {
    st.life = new Life(st.rnd); st.pop = []; st.pop.byId = new Map(); st.hist = [];
    for (let i = 0; i < n; i++) { const p = makePerson(st.rnd, { age: 16 + Math.floor(st.rnd() * 25) }); st.pop.push(p); st.pop.byId.set(p.id, p); }
    snap();
  };
  const snap = () => {
    const alive = st.pop.filter((p) => p.alive);
    const r = (race) => alive.filter((p) => p.race === race).length;
    st.hist.push({ y: st.life.year, alive: alive.length, active: alive.filter((p) => p.stage === 'adult').length, talent: alive.reduce((s, p) => s + talentAvg(p), 0) / Math.max(1, alive.length), human: r('human'), dwarf: r('dwarf'), elf: r('elf'),
      lv: alive.filter((p) => p.stage === 'adult').reduce((s, p) => s + p.level, 0) / Math.max(1, alive.filter((p) => p.stage === 'adult').length) });
  };
  const year = (k = 1) => { for (let i = 0; i < k; i++) { st.life.year1(st.pop, { housingCap: st.housing, schoolCap: st.school, abstractActivity: true }); snap(); } render(); };
  const render = () => {
    const alive = st.pop.filter((p) => p.alive); const L = st.life;
    const by = (f) => alive.filter(f).length; const last = st.hist[st.hist.length - 1];
    $('lab-body').innerHTML = `<div class="row"><h2 style="margin:0">TEST C — 모험가 인생 실험실</h2><button id="lb-back" style="margin-left:auto">메뉴로</button></div>` +
      `<div class="note">현실 10분 = 게임 1년 (배속 1배 기준). 모험가 활동은 추상 계산(연 4~8회 의뢰)으로, 실제 게임에서는 실제 전투·의뢰로 성장합니다. 수치는 모두 시험값.</div>` +
      `<div class="row">초기 인원 <input id="lb-n" type="number" value="120" min="10" max="3000"> 숙소 <input id="lb-h" type="number" value="${st.housing}"> 학교 <input id="lb-s" type="number" value="${st.school}"><button id="lb-reset">새로 생성</button>` +
      ` | 진행 <button id="lb-1">+1년</button><button id="lb-10">+10년</button><button id="lb-50">+50년</button> 자동 ${[0, 1, 10, 100].map((x) => `<button data-sp="${x}" class="${st.speed === x ? 'on' : ''}">${x ? `x${x}` : '정지'}</button>`).join('')}</div>` +
      `<div class="kv"><div>연도 <b>${L.year}</b></div><div>생존 ${alive.length}</div><div>성인 활동 ${by((p) => p.stage === 'adult')}</div><div>학생 ${by((p) => p.stage === 'student')} · 어린이 ${by((p) => p.stage === 'child')}</div><div>은퇴 ${by((p) => p.stage === 'retired')}</div><div>최대 세대 ${Math.max(0, ...alive.map((p) => p.gen))}</div>` +
      `<div>출생 ${L.stats.births} · 사망 ${L.stats.deaths}</div><div>결혼 ${L.stats.marriages}</div><div>희귀 인재 ${L.stats.rare}</div><div>재능 평균 ${last.talent.toFixed(2)}</div><div>인간/드워프/엘프 ${last.human}/${last.dwarf}/${last.elf}</div><div>활동 평균 Lv ${last.lv.toFixed(1)}</div></div>` +
      `<div class="row" style="align-items:stretch"><div style="flex:1;min-width:280px"><h3>인구</h3><canvas id="ch-pop" class="chart"></canvas></div><div style="flex:1;min-width:280px"><h3>종족별 인원</h3><canvas id="ch-race" class="chart"></canvas></div><div style="flex:1;min-width:280px"><h3>재능 평균 (세대 누적)</h3><canvas id="ch-tal" class="chart"></canvas></div></div>` +
      `<div class="row" style="align-items:flex-start"><div style="flex:1.2;min-width:320px"><h3>재능 상위 인물 (클릭: 상세·가족)</h3><table><tr><th>이름</th><th>종족</th><th>나이</th><th>단계</th><th>직업</th><th>Lv</th><th>재능</th><th>원소</th><th>세대</th></tr>${[...alive].sort((a, b) => talentAvg(b) - talentAvg(a)).slice(0, 25).map((p) => `<tr class="click" data-id="${p.id}"><td>${p.interest ? '★' : ''}${p.name}</td><td>${B.races[p.race].name}</td><td>${p.age}</td><td>${{ child: '어린이', student: '학생', adult: '활동', retired: '은퇴' }[p.stage]}</td><td>${p.job ? B.jobs[p.job].name : '-'}</td><td>${p.level}</td><td>${talentAvg(p).toFixed(2)}</td><td>${aptCount(p)}</td><td>${p.gen}</td></tr>`).join('')}</table></div>` +
      `<div style="flex:1;min-width:280px"><h3>상세</h3><div id="lb-sel" class="note">인물을 선택하세요.</div><h3>역사 기록</h3><div style="max-height:260px;overflow:auto" class="note">${L.history.slice(-80).reverse().map((e) => `<div class="${e.kind === 'rare' ? 'good' : ''}">${e.year}년 — ${e.text}</div>`).join('')}</div></div></div>` +
      `<h3>대량 통계 테스트 (시간 가속 없이 수만 명 출생 계산)</h3><div class="row"><button id="lb-stats">실행</button><span class="note">창시자 재능 10만, 원소 5만, 유전 세대 이동(무작위/동류/상위 교배 20세대)</span></div><div id="lb-out"></div>`;
    chart($('ch-pop'), [{ name: '생존', color: '#e9b75a', data: st.hist.map((h) => h.alive) }, { name: '활동', color: '#7be08a', data: st.hist.map((h) => h.active) }]);
    chart($('ch-race'), [{ name: '인간', color: '#e9b75a', data: st.hist.map((h) => h.human) }, { name: '드워프', color: '#d0763f', data: st.hist.map((h) => h.dwarf) }, { name: '엘프', color: '#7be08a', data: st.hist.map((h) => h.elf) }]);
    chart($('ch-tal'), [{ name: '재능 평균', color: '#76b7ff', data: st.hist.map((h) => h.talent) }], { min: 1, max: 5 });
    $('lb-back').onclick = () => closeLab(ui);
    $('lb-reset').onclick = () => { st.housing = +$('lb-h').value; st.school = +$('lb-s').value; reset(+$('lb-n').value); render(); };
    $('lb-1').onclick = () => year(1); $('lb-10').onclick = () => year(10); $('lb-50').onclick = () => year(50);
    document.querySelectorAll('#lab-body [data-sp]').forEach((b) => (b.onclick = () => { st.speed = +b.dataset.sp; render(); }));
    document.querySelectorAll('#lab-body [data-id]').forEach((tr) => (tr.onclick = () => { st.sel = st.pop.byId.get(+tr.dataset.id); showSel(); }));
    $('lb-stats').onclick = () => { $('lb-out').innerHTML = '계산 중…'; setTimeout(() => { $('lb-out').innerHTML = statsTables(); }, 20); };
    showSel();
  };
  const showSel = () => {
    const p = st.sel; if (!p || !$('lb-sel')) return;
    const nm = (id) => st.pop.byId.get(id)?.name || '?';
    $('lb-sel').innerHTML = `<b>${p.name}</b> (${B.races[p.race].name}, ${p.sex === 'M' ? '남' : '여'}, ${p.age}세/수명 ${p.lifespan}) ${p.alive ? '' : '— 사망'}<br>` +
      `${p.job ? B.jobs[p.job].name : '-'} Lv.${p.level} ${gradeName(p.grade)} · 의뢰 ${p.quests}<br>` +
      `재능 ${B.people.stats.map((k) => `${STAT_NAMES[k]}${'★'.repeat(p.talent[k])}`).join(' ')}<br>` +
      `교육 ${B.people.stats.map((k) => `${STAT_NAMES[k]} ${p.edu[k].toFixed(1)}`).join(', ')}<br>` +
      `원소 ${B.people.elements.map((e) => `${ELEM_NAMES[e]} ${p.aff[e]}`).join(', ')}<br>` +
      `부모 ${p.parents.map(nm).join(', ') || '-'} · 배우자 ${p.spouse ? nm(p.spouse) : '-'} · 자녀 ${p.children.map(nm).join(', ') || '-'}<br>${p.history.slice(-6).join('<br>')}`;
  };
  reset(120); render();
  clearInterval(window.__labTimer);
  let last = performance.now();
  window.__labTimer = setInterval(() => {
    const now = performance.now(); const dt = (now - last) / 1000; last = now;
    if (!st.speed || window.__labStop) return;
    st.acc += dt * st.speed / B.time.realSecondsPerYear;
    if (st.acc >= 1) { const k = Math.min(20, Math.floor(st.acc)); st.acc -= k; year(k); }
  }, 250);
}
export function statsTables() {
  const rnd = mulberry32(7007); const P = B.people;
  const N = 100000, c = [0, 0, 0, 0, 0]; for (let i = 0; i < N; i++) c[rollTalent(rnd) - 1]++;
  let h = `<h3>창시자 재능 분포 (N=${N.toLocaleString()})</h3><table><tr><th></th>${[1, 2, 3, 4, 5].map((s) => `<th>${s}성</th>`).join('')}</tr><tr><td>측정</td>${c.map((x) => `<td>${pct(x / N)}</td>`).join('')}</tr><tr><td>목표</td>${P.talent.probs.map((x) => `<td>${pct(x)}</td>`).join('')}</tr></table>`;
  h += `<h3>부모 평균 재능별 자녀 분포 (공식 정규화)</h3><table><tr><th>부모 평균 a</th>${[1, 2, 3, 4, 5].map((s) => `<th>${s}성</th>`).join('')}<th>자녀 평균</th></tr>${[1, 2, 2.56, 3, 4, 5].map((a) => { const w = inheritTalentWeights(a); return `<tr><td>${a}</td>${w.map((x) => `<td>${pct(x)}</td>`).join('')}<td>${w.reduce((s, x, i) => s + x * (i + 1), 0).toFixed(2)}</td></tr>`; }).join('')}</table>`;
  const gens = (mode) => { const size = 2000; let pop = Array.from({ length: size }, () => rollTalent(rnd)); const out = []; for (let g = 0; g <= 20; g++) { out.push(pop.reduce((a, b) => a + b, 0) / size); let par = pop; if (mode === 'top') par = [...pop].sort((a, b) => b - a).slice(0, size / 2); if (mode === 'sorted') par = [...pop].sort((a, b) => b - a); const nx = []; for (let i = 0; i < size; i++) { let A, Bv; if (mode === 'sorted') { const k = Math.floor(rnd() * (size / 2)) * 2; A = par[k]; Bv = par[k + 1]; } else { A = par[Math.floor(rnd() * par.length)]; Bv = par[Math.floor(rnd() * par.length)]; } nx.push(inheritTalent(A, Bv, rnd)); } pop = nx; } return out; };
  h += `<h3>세대별 재능 평균 (2,000명, 20세대)</h3><table><tr><th>교배 방식</th><th>0세대</th><th>5</th><th>10</th><th>20</th></tr>${[['random', '무작위'], ['sorted', '동류 교배(전원)'], ['top', '상위 50%만 출산']].map(([m, n]) => { const g = gens(m); return `<tr><td>${n}</td><td>${g[0].toFixed(2)}</td><td>${g[5].toFixed(2)}</td><td>${g[10].toFixed(2)}</td><td>${g[20].toFixed(2)}</td></tr>`; }).join('')}</table>`;
  const M = 50000; const ac = [0, 0, 0, 0, 0, 0, 0]; let bad = 0;
  for (let i = 0; i < M; i++) { const pa = { aff: rollElements(rnd) }, pb = { aff: rollElements(rnd) }; const ch = { aff: rollElements(rnd, [pa, pb]) }; ac[aptCount(ch)]++; for (const e of P.elements) if ((ch.aff[e] >= 60) !== (ch.aff[e] >= P.aptitudeThreshold)) bad++; }
  h += `<h3>원소 적성 수 (자녀 ${M.toLocaleString()}명)</h3><table><tr><th></th>${[0, 1, 2, 3, 4, 5, 6].map((x) => `<th>${x}</th>`).join('')}</tr><tr><td>측정</td>${ac.map((x) => `<td>${pct(x / M)}</td>`).join('')}</tr><tr><td>목표</td>${P.aptCountProbs.map((x) => `<td>${pct(x)}</td>`).join('')}</tr></table><div class="note">적성/친화력 모순 ${bad}건</div>`;
  return h;
}

// ---------------- TEST D ----------------
function econLab(ui) {
  window.__labStop = false;
  const p = { advs: 10, supply: 3, minutes: 30, faucet: false, recruitPaid: false };
  const render = (res) => {
    $('lab-body').innerHTML = `<div class="row"><h2 style="margin:0">TEST D — 경제 실험실</h2><button id="eb-back" style="margin-left:auto">메뉴로</button></div>` +
      `<div class="note">실제 모험가 AI·시장가·장부 규칙으로 계산합니다. 공장은 "완제품 공급 속도"로 추상화했습니다. 시장가 공식은 시험 공식이며 정식 경제 규칙이 아닙니다.</div>` +
      `<div class="row">모험가 <input id="eb-a" type="number" value="${p.advs}" min="1" max="200"> 상점 공급/분 <input id="eb-s" type="number" value="${p.supply}" step="0.5"> 시간(분) <input id="eb-m" type="number" value="${p.minutes}" min="5" max="240">` +
      `<label><input type="checkbox" id="eb-f" ${p.faucet ? 'checked' : ''}> 시험용 처치 보상금(외부 유입)</label><label><input type="checkbox" id="eb-r" ${p.recruitPaid ? 'checked' : ''}> 모집비 지불</label><button id="eb-run" class="on">실행</button></div><div id="eb-prog" class="note"></div>` +
      (res ? resultHtml(res) : '');
    $('eb-back').onclick = () => closeLab(ui);
    $('eb-run').onclick = () => { p.advs = +$('eb-a').value; p.supply = +$('eb-s').value; p.minutes = +$('eb-m').value; p.faucet = $('eb-f').checked; p.recruitPaid = $('eb-r').checked; run(); };
    if (res) {
      chart($('ec-money'), [{ name: '길드', color: '#e9b75a', data: res.trace.map((t) => t.guild) }, { name: '모험가 합계', color: '#7be08a', data: res.trace.map((t) => t.advGold) }, { name: '전체 화폐량', color: '#76b7ff', data: res.trace.map((t) => t.supply) }]);
      chart($('ec-price'), [{ name: '목검', color: '#e9b75a', data: res.trace.map((t) => t.price.sword_wood) }, { name: '슬라임 점액', color: '#7be08a', data: res.trace.map((t) => t.price.slime) }, { name: '늑대 가죽', color: '#d0763f', data: res.trace.map((t) => t.price.wolf_pelt) }, { name: '철검', color: '#76b7ff', data: res.trace.map((t) => t.price.sword_iron) }]);
    }
  };
  const resultHtml = (r) => `<div class="kv"><div>화폐량 ${r.m0} → <b>${r.m1}</b></div><div>외부 유입(시험) ${r.faucet}</div><div>길드 ${r.guild} · 모험가 ${r.adv}</div><div>의뢰 게시 ${r.posted} · 완료 ${r.done} · 실패 ${r.failed}</div><div>자금 부족 정지 ${r.stalls}회</div><div>구매 ${r.bought} · 전리품 매입 ${r.sold}</div><div>무기 보유 ${Math.round(r.geared * 100)}%</div><div>첫 무기까지 평균 ${r.firstGear ?? '-'}초</div></div>` +
    `<div class="row" style="align-items:stretch"><div style="flex:1;min-width:300px"><h3>자금 추이 (분)</h3><canvas id="ec-money" class="chart"></canvas></div><div style="flex:1;min-width:300px"><h3>시장가 추이</h3><canvas id="ec-price" class="chart"></canvas></div></div>`;
  const run = async () => {
    const [{ createMainWorld }, { Game }] = await Promise.all([import('../sim/maps.js'), import('../sim/game.js')]);
    B.economy.testFaucet.enabled = p.faucet;
    const w = createMainWorld(); w.reveal(40, 40, 120); const g = new Game(w, { seed: 5 });
    for (const t of ['iron_arms', 'alchemy']) g.guild.tech.add(t);
    const board = w.placeFacility('quest_board', 20, 42), shop = w.placeFacility('shop', 24, 42, 'E'), ct = w.placeFacility('counter', 12, 42, 'S');
    for (let i = 0; i < p.advs; i++) g.recruit({}, !p.recruitPaid);
    const m0 = g.moneySupply();
    g.addTemplate({ type: 'hunt', target: 'slime', count: 5, party: 2, concurrent: Math.max(1, Math.ceil(p.advs / 4)) });
    g.addTemplate({ type: 'hunt', target: 'wolf', count: 5, party: 3, concurrent: Math.max(1, Math.ceil(p.advs / 8)) });
    const GOODS = ['sword_wood', 'staff_wood', 'bow_wood', 'mace_wood', 'armor_leather', 'sword_iron', 'mace_iron', 'staff_gel', 'bow_fang', 'armor_iron', 'potion_hp'];
    const dt = 1 / B.time.simHz; let acc = 0, k = 0, t = 0; const trace = []; const first = new Map(); let nextMin = 0;
    const total = p.minutes * 60;
    while (t < total && !window.__labStop) {
      const end = Math.min(total, t + 20);
      for (; t < end; t += dt) {
        g.tick(dt); board.stock.quest = 30;
        acc += p.supply * dt / 60; while (acc >= 1) { acc--; const id = GOODS[k++ % GOODS.length]; shop.stock[id] = (shop.stock[id] || 0) + 1; }
        for (const u of g.units.values()) if (u.p.equip.weapon && !first.has(u.id)) first.set(u.id, t);
        if (t >= nextMin) { nextMin += 60; for (const kk of Object.keys(ct.stock)) delete ct.stock[kk];
          trace.push({ guild: Math.round(g.ledger.guild), advGold: Math.round(g.people.reduce((s, x) => s + x.gold, 0)), supply: g.moneySupply(), price: { sword_wood: g.market.price('sword_wood'), sword_iron: g.market.price('sword_iron'), slime: g.market.price('slime'), wolf_pelt: g.market.price('wolf_pelt') } }); }
      }
      $('eb-prog').textContent = `계산 중… ${Math.round(t / 60)} / ${p.minutes}분`;
      await new Promise((r) => setTimeout(r, 0));
    }
    B.economy.testFaucet.enabled = false;
    const fg = [...first.values()];
    render({ m0, m1: g.moneySupply(), faucet: g.ledger.faucet, guild: Math.round(g.ledger.guild), adv: Math.round(g.people.reduce((s, x) => s + x.gold, 0)), posted: g.guild.posted, done: g.guild.completed, failed: g.guild.failed, stalls: g.guild.stalls, bought: g.stats.bought, sold: g.stats.sold, geared: fg.length / g.units.size, firstGear: fg.length ? Math.round(fg.reduce((a, b) => a + b, 0) / fg.length) : null, trace });
  };
  render(null);
}
