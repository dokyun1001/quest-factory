// Grid A* (8-dir, no corner cutting) with a per-tick search budget. Pure JS.
export class PathFinder {
  constructor(world) {
    this.w = world; const n = world.w * world.h;
    this.g = new Float32Array(n); this.f = new Float32Array(n); this.from = new Int32Array(n);
    this.stamp = new Uint32Array(n); this.closed = new Uint32Array(n); this.cur = 1;
    this.heap = new Int32Array(n); this.budget = 0; this.searches = 0; this.expanded = 0;
  }
  walkable(x, y) { return !this.w.solidAt(x, y); }
  // returns array of [x,y] tile centers or null; maxNodes bounds the cost of one search
  find(sx, sy, tx, ty, maxNodes = 6000) {
    const W = this.w; const w = W.w;
    sx |= 0; sy |= 0; tx |= 0; ty |= 0;
    if (!W.inBounds(tx, ty)) return null;
    if (!this.walkable(tx, ty)) { const alt = this.nearestWalkable(tx, ty); if (!alt) return null; [tx, ty] = alt; }
    if (sx === tx && sy === ty) return [[tx + 0.5, ty + 0.5]];
    this.searches++;
    const c = ++this.cur; const g = this.g, f = this.f, from = this.from, stamp = this.stamp, closed = this.closed, heap = this.heap;
    let hn = 0;
    const h = (x, y) => { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return dx + dy - 0.59 * Math.min(dx, dy); };
    const push = (i) => { let k = hn++; heap[k] = i; while (k > 0) { const p = (k - 1) >> 1; if (f[heap[p]] <= f[i]) break; heap[k] = heap[p]; heap[p] = i; k = p; } };
    const pop = () => { const top = heap[0]; const last = heap[--hn]; let k = 0; for (;;) { const l = 2 * k + 1; if (l >= hn) break; const r = l + 1; const m = r < hn && f[heap[r]] < f[heap[l]] ? r : l; if (f[heap[m]] >= f[last]) break; heap[k] = heap[m]; k = m; } heap[k] = last; return top; };
    const si = sy * w + sx, ti = ty * w + tx;
    stamp[si] = c; g[si] = 0; f[si] = h(sx, sy); from[si] = -1; push(si);
    let nodes = 0;
    while (hn) {
      const i = pop();
      if (closed[i] === c) continue;
      closed[i] = c;
      if (i === ti) break;
      if (++nodes > maxNodes) { this.expanded += nodes; return null; }
      const x = i % w, y = (i / w) | 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (!W.inBounds(nx, ny) || !this.walkable(nx, ny)) continue;
        if (dx && dy && (!this.walkable(x + dx, y) || !this.walkable(x, y + dy))) continue;
        const ni = ny * w + nx;
        if (closed[ni] === c) continue;
        const ng = g[i] + (dx && dy ? 1.414 : 1);
        if (stamp[ni] !== c || ng < g[ni]) { stamp[ni] = c; g[ni] = ng; f[ni] = ng + h(nx, ny); from[ni] = i; push(ni); }
      }
    }
    this.expanded += nodes;
    if (closed[ti] !== c) return null;
    const path = [];
    for (let i = ti; i !== -1 && i !== si; i = from[i]) path.push([(i % w) + 0.5, ((i / w) | 0) + 0.5]);
    path.reverse();
    return simplify(path);
  }
  nearestWalkable(x, y) {
    for (let r = 1; r < 6; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      if (this.w.inBounds(x + dx, y + dy) && this.walkable(x + dx, y + dy)) return [x + dx, y + dy];
    }
    return null;
  }
}
function simplify(p) { // drop collinear points
  if (p.length < 3) return p;
  const out = [p[0]];
  for (let i = 1; i < p.length - 1; i++) {
    const a = out[out.length - 1], b = p[i], c = p[i + 1];
    if ((b[0] - a[0]) * (c[1] - b[1]) !== (b[1] - a[1]) * (c[0] - b[0])) out.push(b);
  }
  out.push(p[p.length - 1]);
  return out;
}
