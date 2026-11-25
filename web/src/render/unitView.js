// Adventurers (shared Franuka-based compositor), monsters (placeholder), HP bars, telegraphs, FX.
// Only on-screen entities get sprites updated; simulation itself never depends on what is visible.
import { Character } from './characters.js';
import { MONSTERS } from '../data/monsters.js';

const T = 16;
const JOB_COL = { swordsman: 0xd9534f, mage: 0x5b8def, archer: 0x5cb85c, cleric: 0xf5f0d0 };
const ELEM_COL = { fire: 0xff8933, water: 0x4f8fd0, wind: 0x9be3b0, earth: 0xb08850, thunder: 0xf0e050, ice: 0xbfe8ff };

export class UnitView {
  constructor(scene, game, composer) {
    this.scene = scene; this.game = game; this.composer = composer;
    this.chars = new Map(); this.mons = new Map();
    this.g = scene.add.graphics().setDepth(4000);       // bars, rings
    this.tg = scene.add.graphics().setDepth(2.8);       // telegraphs on the ground
    this.fxg = scene.add.graphics().setDepth(4500);
    this.fx = []; this.selected = null;
    this.monT = 0;
    game.events.on('unit', (u, what) => { if (what === 'remove') { const c = this.chars.get(u.id); if (c) { c.destroy(); this.chars.delete(u.id); } if (this.selected === u) this.selected = null; } });
    game.events.on('monster', (m, what) => { if (what === 'remove') { const s = this.mons.get(m.id); if (s) { s.destroy(); this.mons.delete(m.id); } } });
    this.visibleUnits = 0;
  }
  charFor(u) {
    let c = this.chars.get(u.id);
    if (!c) { c = new Character(this.scene, this.composer, u.p.appearance, u.x * T, u.y * T); this.chars.set(u.id, c); }
    return c;
  }
  update(dtMs, cam) {
    const v = cam.worldView; const g = this.g; g.clear(); this.tg.clear();
    const inV = (x, y, m = 2) => x * T > v.x - m * T && x * T < v.right + m * T && y * T > v.y - m * T && y * T < v.bottom + m * T * 2;
    let vis = 0;
    for (const u of this.game.units.values()) {
      const on = inV(u.x, u.y);
      let c = this.chars.get(u.id);
      if (!on) { if (c) c.sprite.visible = false; continue; }
      vis++;
      c = this.charFor(u);
      c.x = u.x * T; c.y = u.y * T + 4; c.facing = u.facing; c.moving = u.moving || u.state === 'fight' && u.cd > 0.6;
      c.render(dtMs, true);
      c.sprite.setAlpha(u.state === 'downed' ? 0.45 : 1).setAngle(u.state === 'downed' ? 90 : 0);
      const bx = u.x * T - 6, by = u.y * T + 5;
      g.fillStyle(0x000000, 0.6).fillRect(bx, by, 12, 2);
      g.fillStyle(u.hp / u.maxHp > 0.35 ? 0x6fd06a : 0xe05050, 1).fillRect(bx, by, 12 * Math.max(0, u.hp / u.maxHp), 1);
      if (u.maxMp > 0) g.fillStyle(0x4f8fd0, 1).fillRect(bx, by + 1, 12 * Math.max(0, u.mp / u.maxMp), 1);
      g.fillStyle(JOB_COL[u.p.job] || 0xffffff, 1).fillRect(u.x * T - 1, u.y * T - 22, 3, 3);
      if (u.p.interest) g.lineStyle(1, 0xffd34d, 1).strokeRect(u.x * T - 2.5, u.y * T - 23.5, 6, 6);
      if (this.selected === u) g.lineStyle(1, 0xfff2a8, 1).strokeEllipse(u.x * T, u.y * T + 3, 14, 6);
    }
    this.visibleUnits = vis;
    this.monT += dtMs; const f = Math.floor(this.monT / 300) % 2;
    for (const m of this.game.monsters) {
      const d = MONSTERS[m.type];
      if (m.tele) {   // telegraph: area fills up as the windup progresses
        const r = m.tele.r * T, k = Math.min(1, m.tele.t / m.tele.windup);
        this.tg.fillStyle(0xff3030, 0.15).fillCircle(m.tele.x * T, m.tele.y * T, r);
        this.tg.fillStyle(0xff3030, 0.35).fillCircle(m.tele.x * T, m.tele.y * T, r * k);
        this.tg.lineStyle(1, 0xff5050, 1).strokeCircle(m.tele.x * T, m.tele.y * T, r);
      }
      const on = inV(m.x, m.y, 3); let s = this.mons.get(m.id);
      if (!on) { if (s) s.visible = false; continue; }
      if (!s) { s = this.scene.add.image(0, 0, 'ph7', `mon_${m.type}_0`).setOrigin(0.5, d.boss ? 0.9 : 0.85); this.mons.set(m.id, s); }
      s.visible = true; s.setFrame(`mon_${m.type}_${m.moving || d.boss ? f : 0}`).setFlipX(m.facing === 'W');
      s.x = Math.round(m.x * T); s.y = Math.round(m.y * T); s.setDepth(1000 + m.y * T);
      if (m.hp < m.maxHp) {
        const w = d.boss ? 30 : 12, bx = m.x * T - w / 2, by = m.y * T - (d.boss ? 30 : 13);
        g.fillStyle(0x000000, 0.6).fillRect(bx, by, w, 2); g.fillStyle(0xe0a040, 1).fillRect(bx, by, w * Math.max(0, m.hp / m.maxHp), 2);
      }
      if (m.tele) { g.fillStyle(0xffffff, 1); }
    }
    // fx
    for (const e of this.game.fx) this.fx.push({ ...e, t: 0 });
    this.game.fx.length = 0;
    const fg = this.fxg; fg.clear();
    this.fx = this.fx.filter((e) => (e.t += dtMs) < (e.type === 'quake' ? 400 : 250));
    for (const e of this.fx) {
      if (!inV(e.x, e.y, 4)) continue;
      const a = 1 - e.t / 300, X = e.x * T, Y = e.y * T - 6;
      switch (e.type) {
        case 'arrow': fg.lineStyle(1, 0xf3e7b3, a).lineBetween(e.fx * T, e.fy * T - 8, X, Y); break;
        case 'bolt': fg.lineStyle(1, 0x9ec8ff, a).lineBetween(e.fx * T, e.fy * T - 10, X, Y); break;
        case 'aoe': fg.fillStyle(ELEM_COL[e.extra] || 0xb0a0ff, 0.35 * a).fillCircle(X, Y + 6, 1.3 * T); break;
        case 'slash': fg.lineStyle(1, 0xffffff, a).lineBetween(X - 4, Y - 3, X + 4, Y + 3); break;
        case 'hit': fg.fillStyle(0xff6060, a).fillCircle(X, Y, 2); break;
        case 'heal': fg.fillStyle(0x80ff90, a).fillRect(X - 1, Y - 6 - e.t / 40, 2, 2); break;
        case 'quake': fg.lineStyle(2, 0xffa060, a).strokeCircle(X, Y + 6, (e.extra || 2) * T * (0.6 + e.t / 1000)); break;
        case 'down': fg.lineStyle(1, 0xff4040, a).strokeCircle(X, Y + 6, 6); break;
        case 'lvl': case 'skill': case 'rescue': fg.fillStyle(0xffe070, a).fillRect(X - 3, Y - 14 - e.t / 30, 6, 1); break;
        default: break;
      }
    }
  }
  pick(wx, wy) {
    let best = null, bd = 0.8 * 0.8;
    for (const u of this.game.units.values()) { const d = (u.x - wx) ** 2 + (u.y - 0.6 - wy) ** 2; if (d < bd) { bd = d; best = u; } }
    return best;
  }
  pickMonster(wx, wy) {
    let best = null, bd = 1.2 * 1.2;
    for (const m of this.game.monsters) { const d = (m.x - wx) ** 2 + (m.y - 0.4 - wy) ** 2; if (d < bd) { bd = d; best = m; } }
    return best;
  }
  destroy() { for (const c of this.chars.values()) c.destroy(); for (const s of this.mons.values()) s.destroy(); }
}
