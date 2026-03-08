// utils.js — shared utility functions

import { getState } from './state.js';
import { api } from './api.js';

const FIFA_RANKINGS_URL = 'https://inside.fifa.com/fifa-world-ranking/men';

export { FIFA_RANKINGS_URL };

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

export function getFlag(flagCode) {
  if (!flagCode || flagCode === 'xx') return '<span class="flag flag-tbd">?</span>';
  return `<img class="flag" src="https://flagcdn.com/w40/${flagCode}.png" srcset="https://flagcdn.com/w80/${flagCode}.png 2x" alt="" width="20" height="15" loading="lazy">`;
}

/** Shared save-picks helper used by both groups.js and bracket.js */
export async function savePicksToServer(statusEl) {
  const { picks } = getState();
  try {
    if (statusEl) statusEl.textContent = 'Saving\u2026';
    await api.savePicks({
      groupPicks: picks?.groupPicks ?? {},
      thirdPlaceAdvancing: picks?.thirdPlaceAdvancing ?? [],
      bracketPicks: picks?.bracketPicks ?? {},
    });
    if (statusEl) statusEl.textContent = '\u2713 Saved';
    setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
  } catch (err) {
    if (statusEl) statusEl.textContent = `Error: ${err.message}`;
  }
}
