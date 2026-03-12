// picks-status.js — sticky bar showing display name + pick completeness

import { getState, setState, subscribe } from './state.js';
import { escapeHtml } from './utils.js';
import { GROUP_LETTERS } from './data/teams.js';

const TOTAL_GROUP_RANKS = 48;   // 12 groups × 4 positions
const TOTAL_THIRD_PLACE = 8;    // 8 of 12 groups advance a 3rd-place team
const TOTAL_BRACKET = 32;       // 16 R32 + 8 R16 + 4 QF + 2 SF + 1 TPM + 1 F
const TOTAL_PICKS = TOTAL_GROUP_RANKS + TOTAL_THIRD_PLACE + TOTAL_BRACKET; // 88

let unsubStatus = null;

/**
 * Initialize the picks status bar. Call after ensureSlidePanel has rendered.
 * Subscribes to state changes to keep name + completeness up to date.
 */
export function initPicksStatus() {
  updatePicksStatus();
  if (unsubStatus) unsubStatus();
  unsubStatus = subscribe(() => updatePicksStatus());
}

/**
 * Compute how many picks have been made vs total possible.
 */
export function computeCompleteness(picks) {
  if (!picks) return { done: 0, total: TOTAL_PICKS };

  const groupPicks = picks.groupPicks ?? {};
  const thirdPlace = picks.thirdPlaceAdvancing ?? [];
  const bracket = picks.bracketPicks ?? {};

  const groupsDone = GROUP_LETTERS.reduce(
    (sum, g) => sum + (groupPicks[g]?.length ?? 0), 0
  );
  const thirdDone = thirdPlace.length;
  const bracketDone = Object.keys(bracket).filter(k => bracket[k]).length;

  return { done: groupsDone + thirdDone + bracketDone, total: TOTAL_PICKS };
}

function updatePicksStatus() {
  const nameEl = document.getElementById('picks-status-name');
  const compEl = document.getElementById('picks-status-completeness');
  if (!nameEl || !compEl) return;

  const { picks, displayName, locked, score } = getState();

  // Show/hide lock icon
  const lockIcon = document.getElementById('picks-lock-icon');
  if (lockIcon) lockIcon.style.display = locked ? '' : 'none';

  // Name section (with pencil edit icon)
  if (displayName) {
    nameEl.innerHTML = `
      <span class="picks-name-text">${escapeHtml(displayName)}</span>
      <button class="edit-name-btn" id="edit-name-btn" title="Change display name">
        <i class="fa-solid fa-pencil"></i>
      </button>
    `;
    // Wire up edit handler (lazy-load modal)
    document.getElementById('edit-name-btn')?.addEventListener('click', handleEditName);
  } else {
    nameEl.innerHTML = '';
  }

  // When locked, show score; otherwise show completeness
  if (locked && score) {
    compEl.textContent = `Score: ${score.totalPoints}pts (${score.maxPossiblePoints} possible)`;
    compEl.title = `${score.totalPoints} points earned, ${score.maxPossiblePoints} max possible`;
    compEl.classList.remove('complete');
  } else {
    const { done, total } = computeCompleteness(picks);
    const isComplete = done === total;
    compEl.textContent = `${done}/${total}`;
    compEl.title = `${done} of ${total} picks made`;
    compEl.classList.toggle('complete', isComplete);
  }
}

async function handleEditName() {
  const { showDisplayNameModal } = await import('./display-name-modal.js');
  const { displayName } = getState();
  const newName = await showDisplayNameModal(displayName || '');
  if (newName) {
    setState({ displayName: newName });
  }
}
