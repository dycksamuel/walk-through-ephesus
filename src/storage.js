// Saves progress on this device only. If the browser blocks storage (private mode,
// strict settings), everything still works; it just won't be remembered.
const KEY = 'walk-through-ephesus:v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) { return {}; }
}

export function writeSave(data) {
  try { window.localStorage.setItem(KEY, JSON.stringify(data)); return true; }
  catch (e) { return false; }
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch (e) { /* nothing to clear */ }
}
