// Terraria-style personal inventory: N slots (first 10 = hotbar), stacks.
import { B } from '../data/balance.js';
import { ITEMS } from '../data/items.js';
import { RECIPES } from '../data/recipes.js';

export class Inventory {
  constructor(n = B.player.invSlots) { this.slots = Array.from({ length: n }, () => null); this.sel = 0; }
  count(id) { let n = 0; for (const s of this.slots) if (s && s.id === id) n += s.n; return n; }
  totals() { const t = {}; for (const s of this.slots) if (s) t[s.id] = (t[s.id] || 0) + s.n; return t; }
  // returns how many could NOT be added
  add(id, n = 1) {
    if (!ITEMS[id] || n <= 0) return n;
    const max = B.player.stack;
    for (const s of this.slots) if (s && s.id === id && s.n < max) { const k = Math.min(n, max - s.n); s.n += k; n -= k; if (!n) return 0; }
    for (let i = 0; i < this.slots.length && n; i++) if (!this.slots[i]) { const k = Math.min(n, max); this.slots[i] = { id, n: k }; n -= k; }
    return n;
  }
  addAll(map) { let lost = 0; for (const [k, n] of Object.entries(map || {})) lost += this.add(k, n); return lost; }
  remove(id, n = 1) {
    if (this.count(id) < n) return false;
    for (let i = this.slots.length - 1; i >= 0 && n; i--) { const s = this.slots[i]; if (s && s.id === id) { const k = Math.min(n, s.n); s.n -= k; n -= k; if (!s.n) this.slots[i] = null; } }
    return true;
  }
  has(map, mult = 1) { return Object.entries(map).every(([k, n]) => this.count(k) >= n * mult); }
  selected() { return this.slots[this.sel]; }
  swap(a, b) { [this.slots[a], this.slots[b]] = [this.slots[b], this.slots[a]]; }
  serialize() { return { slots: this.slots, sel: this.sel }; }
  restore(s) { if (!s) return; this.slots = (s.slots || []).map((x) => (x && ITEMS[x.id] ? { id: x.id, n: x.n } : null)); while (this.slots.length < B.player.invSlots) this.slots.push(null); this.sel = s.sel || 0; }
}
// hand crafting list (Terraria style): every hand recipe whose tech is unlocked
export function handRecipes(game) { return RECIPES.filter((r) => r.stations.includes('hand') && (game.dev?.allRecipes || game.techUnlocked(r.tech))); }
export function maxCraftable(inv, r) { let m = Infinity; for (const [k, n] of Object.entries(r.in)) m = Math.min(m, Math.floor(inv.count(k) / n)); return m === Infinity ? 0 : m; }
export function craft(inv, r, times = 1) {
  times = Math.min(times, maxCraftable(inv, r)); if (times <= 0) return 0;
  for (const [k, n] of Object.entries(r.in)) inv.remove(k, n * times);
  for (const [k, n] of Object.entries(r.out)) inv.add(k, n * times);
  return times;
}
