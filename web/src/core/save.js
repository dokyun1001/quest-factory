// New save system (006). Uses NEW keys only; legacy browser data is never read, migrated or deleted.
import { SAVE_KEYS, SAVE_VERSION } from './config.js';

const safe = (f, d) => { try { return f(); } catch { return d; } };
export function hasSave(kind) { return !!safe(() => localStorage.getItem(SAVE_KEYS[kind]), null); }
export function loadSave(kind) {
  const raw = safe(() => localStorage.getItem(SAVE_KEYS[kind]), null);
  if (!raw) return null;
  const s = safe(() => JSON.parse(raw), null);
  if (!s || s.v !== SAVE_VERSION || s.kind !== kind) return null;
  return s;
}
export function writeSave(kind, data) {
  const s = { v: SAVE_VERSION, kind, savedAt: new Date().toISOString(), ...data };
  const raw = JSON.stringify(s);
  const ok = safe(() => { localStorage.setItem(SAVE_KEYS[kind], raw); return true; }, false);
  return ok ? raw.length : 0;
}
export function deleteSave(kind) { safe(() => localStorage.removeItem(SAVE_KEYS[kind])); }
export function loadSettings() {
  const d = { itemSize: 10, dirsInDirect: false };
  const s = safe(() => JSON.parse(localStorage.getItem(SAVE_KEYS.settings) || 'null'), null);
  return { ...d, ...(s && typeof s === 'object' ? s : {}) };
}
export function saveSettings(s) { safe(() => localStorage.setItem(SAVE_KEYS.settings, JSON.stringify(s))); }
