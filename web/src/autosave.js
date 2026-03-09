// autosave.js — debounced auto-save with localStorage fallback

import { getState, subscribe } from './state.js';
import { api } from './api.js';

const DEBOUNCE_MS = 2000;
const STORAGE_KEY = 'wc-draft-picks';

let saveTimer = null;
let lastSerialized = '';

/** Start listening for state changes and auto-saving. */
export function initAutoSave() {
  // Snapshot current state so we don't immediately re-save what was just loaded
  const { picks } = getState();
  lastSerialized = serializePicks(picks);
  subscribe(onStateChange);
}

function serializePicks(picks) {
  if (!picks) return '';
  return JSON.stringify({
    groupPicks: picks.groupPicks ?? {},
    thirdPlaceAdvancing: picks.thirdPlaceAdvancing ?? [],
    bracketPicks: picks.bracketPicks ?? {},
  });
}

function onStateChange(state) {
  if (!state.picks) return;
  const serialized = serializePicks(state.picks);
  if (serialized === lastSerialized) return;
  lastSerialized = serialized;

  // Always save to localStorage (works even when not logged in)
  localStorage.setItem(STORAGE_KEY, serialized);

  // Debounce server save if logged in and not locked
  if (state.user && !state.locked) {
    clearTimeout(saveTimer);
    showSaveStatus('saving');
    saveTimer = setTimeout(() => saveToServer(state.picks), DEBOUNCE_MS);
  }
}

async function saveToServer(picks) {
  try {
    await api.savePicks({
      groupPicks: picks.groupPicks ?? {},
      thirdPlaceAdvancing: picks.thirdPlaceAdvancing ?? [],
      bracketPicks: picks.bracketPicks ?? {},
    });
    showSaveStatus('saved');
  } catch {
    showSaveStatus('error');
  }
}

/** Load draft picks from localStorage. */
export function loadLocalPicks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Clear draft picks from localStorage (after server sync). */
export function clearLocalPicks() {
  localStorage.removeItem(STORAGE_KEY);
}

/** Force immediate server save (used after login to sync local → server). */
export async function syncToServer() {
  const { picks, user } = getState();
  if (!user || !picks) return;
  clearTimeout(saveTimer);
  showSaveStatus('saving');
  await saveToServer(picks);
}

function showSaveStatus(status) {
  const el = document.getElementById('save-indicator');
  if (!el) return;
  switch (status) {
    case 'saving':
      el.textContent = 'Saving…';
      el.className = 'save-indicator saving';
      break;
    case 'saved':
      el.textContent = '✓ Saved';
      el.className = 'save-indicator saved';
      setTimeout(() => {
        if (el.classList.contains('saved')) {
          el.textContent = '';
          el.className = 'save-indicator';
        }
      }, 3000);
      break;
    case 'error':
      el.textContent = '⚠ Save failed';
      el.className = 'save-indicator error';
      break;
  }
}
