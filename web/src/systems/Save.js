// Browser save: localStorage survives page reloads (per browser, per site).
const KEY = 'questfactory.save.v1';

export function write(data) {
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch { return false; }
}

export function load() {
  try {
    const s = localStorage.getItem(KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}

export function clear() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function savedAt() {
  return load()?.at ?? null;
}
