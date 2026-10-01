import { store } from '../lib/storage.js';
import { STORAGE_KEYS, DEFAULT_PREFS } from '../lib/constants.js';

const listeners = new Set();
let state = {
  user: null,
  theme: store.get(STORAGE_KEYS.theme) || DEFAULT_PREFS.theme,
  songs: [],
  selectedSongs: [],
  currentSongId: null,
  currentPart: null,
  announcements: [],
  prefs: { ...DEFAULT_PREFS, ...(store.get(STORAGE_KEYS.preferences) || {}) }
};

export function getState() { return state; }

export function setState(patch) {
  state = { ...state, ...patch };
  notify();
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function notify() {
  for (const fn of listeners) fn(state);
}

export function persistAppState() {
  store.set(STORAGE_KEYS.appState, {
    selectedSongIds: state.selectedSongs.map((s) => s.id),
    currentSongId: state.currentSongId,
    currentPart: state.currentPart,
    timestamp: new Date().toISOString()
  });
}

export function restoreAppState() {
  const saved = store.get(STORAGE_KEYS.appState);
  if (!saved || !saved.selectedSongIds) return;
  const byId = new Map(state.songs.map((s) => [s.id, s]));
  const restored = saved.selectedSongIds.map((id) => byId.get(id)).filter(Boolean);
  state = {
    ...state,
    selectedSongs: restored,
    currentSongId: saved.currentSongId ?? null,
    currentPart: saved.currentPart ?? null
  };
  notify();
}

export function savePrefs(patch) {
  state = { ...state, prefs: { ...state.prefs, ...patch } };
  store.set(STORAGE_KEYS.preferences, state.prefs);
  notify();
}

export function setTheme(theme) {
  state = { ...state, theme };
  store.set(STORAGE_KEYS.theme, theme);
  document.documentElement.setAttribute('data-theme', theme);
  notify();
}