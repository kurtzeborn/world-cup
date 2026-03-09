// utils.js — shared utility functions

const FIFA_RANKINGS_URL = 'https://inside.fifa.com/fifa-world-ranking/men';
const KICKOFF = '2026-06-11T19:00:00Z';

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

export function isLocked() {
  return new Date() >= new Date(KICKOFF);
}

