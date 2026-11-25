// Economy (TEST formulas — not final rules).
// - Raw base prices come from data (items.js).
// - Crafted base prices are derived ONCE from recipes using BASE prices (never live market prices).
// - Market price = base * factor; factor drifts toward a demand/supply/stock target with a capped step.
// - All guild <-> adventurer trades move existing gold; total money changes only through explicit sources
//   (initial funds, TEST faucet) which are tracked separately.
import { B } from '../data/balance.js';
import { ITEMS } from '../data/items.js';
import { RECIPES, FURNACE } from '../data/recipes.js';

const E = B.economy;
const cache = {};
export function basePrice(id, depth = 0) {
  if (cache[id] !== undefined) return cache[id];
  const it = ITEMS[id];
  if (!it) return 0;
  if (it.price !== undefined) return (cache[id] = it.price);
  if (depth > 8) return 1;
  let best = Infinity;
  for (const r of RECIPES) {
    if (!r.out[id] || r.id.startsWith('fac_')) continue;
    let c = 0; for (const [k, n] of Object.entries(r.in)) c += basePrice(k, depth + 1) * n;
    const v = (c / r.out[id]) * (1 + E.craftedMarkup) + r.time * E.laborPerSec;
    best = Math.min(best, v);
  }
  for (const [ore, f] of Object.entries(FURNACE)) {
    if (f.out !== id) continue;
    const v = (basePrice(ore, depth + 1) + basePrice('coal') / 3) * (1 + E.craftedMarkup) + f.time * E.laborPerSec;
    best = Math.min(best, v);
  }
  return (cache[id] = best === Infinity ? 1 : Math.round(best * 10) / 10);
}

export class Market {
  constructor() { this.m = {}; this.t = 0; this.history = []; }
  entry(id) { return (this.m[id] ||= { f: 1, buy: 0, sell: 0, emaBuy: 0, emaSell: 0 }); }
  price(id) { return Math.max(1, Math.round(basePrice(id) * this.entry(id).f)); }
  usedPrice(id) { return Math.max(1, Math.round(this.price(id) * E.usedFactor)); }
  // guild sells to adventurers -> demand ; adventurers sell to guild -> supply
  noteSale(id, n = 1) { this.entry(id).buy += n; }
  noteBuyback(id, n = 1) { this.entry(id).sell += n; }
  // stockOf(id): units currently available to adventurers (shop) or held by the guild
  tick(dt, stockOf) {
    this.t += dt;
    if (this.t < 5) return;
    const step = this.t; this.t = 0;
    const M = E.market;
    const a = Math.min(1, step / M.emaSec);
    for (const [id, e] of Object.entries(this.m)) {
      e.emaBuy += (e.buy / step * 60 - e.emaBuy) * a;     // per-minute rates
      e.emaSell += (e.sell / step * 60 - e.emaSell) * a;
      e.buy = 0; e.sell = 0;
      const flow = (e.emaBuy - e.emaSell) / (e.emaBuy + e.emaSell + 0.5);       // -1..1
      const stock = stockOf ? stockOf(id) : M.targetStock;
      const st = Math.max(-1, Math.min(1, (M.targetStock - stock) / M.targetStock));
      const target = Math.max(M.min, Math.min(M.max, 1 + M.demandWeight * flow + M.stockWeight * st));
      const maxStep = M.maxStepPerMin * step / 60;                              // prevents sudden swings
      e.f += Math.max(-maxStep, Math.min(maxStep, target - e.f));
    }
  }
  snapshot(ids) { return Object.fromEntries(ids.map((id) => [id, this.price(id)])); }
  serialize() { return this.m; }
  restore(s) { this.m = s || {}; }
}

export class Ledger {
  constructor(start) { this.guild = start; this.injected = start; this.faucet = 0; this.flows = { quest: 0, loot: 0, sales: 0, recruit: 0, used: 0 }; }
  pay(from, to, n, kind) {            // from/to: 'guild' or a person
    n = Math.max(0, Math.round(n));
    if (from === 'guild') { if (this.guild < n) return false; this.guild -= n; } else { if (from.gold < n) return false; from.gold -= n; }
    if (to === 'guild') this.guild += n; else if (to) to.gold += n;
    if (kind) this.flows[kind] = (this.flows[kind] || 0) + n;
    return true;
  }
  inject(n, kind = 'faucet') { this.guild += n; this.injected += n; if (kind === 'faucet') this.faucet += n; }
  moneySupply(people) { return this.guild + people.reduce((s, p) => s + (p.alive ? p.gold : 0), 0); }
}
