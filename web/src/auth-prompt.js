// auth-prompt.js — progressive authentication prompt

import { getState } from './state.js';
import { api } from './api.js';
import { GROUP_LETTERS } from './data/teams.js';

const AUTH_PROMPT_THRESHOLD = 4; // completed groups before prompting

/**
 * Check if the auth prompt should be shown.
 * Call after every group pick change.
 */
export function checkAuthPrompt() {
  const { user, picks } = getState();
  if (user) return;
  if (sessionStorage.getItem('auth-prompt-dismissed')) return;

  const groupPicks = picks?.groupPicks ?? {};
  const completedGroups = GROUP_LETTERS.filter(
    g => (groupPicks[g]?.length ?? 0) >= 4
  ).length;
  if (completedGroups < AUTH_PROMPT_THRESHOLD) return;

  showAuthModal();
}

function showAuthModal() {
  // Don't stack multiple modals
  if (document.querySelector('.auth-prompt-modal')) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box auth-prompt-modal">
      <h3>💾 Save your picks</h3>
      <p>Sign in so you can:</p>
      <ul style="text-align:left;margin:0.5em auto;width:fit-content">
        <li>Save your picks</li>
        <li>Create or join leagues</li>
        <li>Give your bracket a clever name</li>
        <li>View your picks on any device</li>
      </ul>
      <p>Only your bracket's name is visible to other players.</p>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="auth-prompt-later">Later</button>
        <a class="btn btn-primary" href="${api.loginUrl}" style="text-decoration:none;text-align:center">
          <i class="fa-brands fa-microsoft"></i> Sign in with Microsoft
        </a>
        <a class="btn btn-secondary" href="${api.loginGoogleUrl}" style="text-decoration:none;text-align:center">
          <i class="fa-brands fa-google"></i> Sign in with Google
        </a>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('auth-prompt-later').addEventListener('click', () => {
    sessionStorage.setItem('auth-prompt-dismissed', 'true');
    overlay.remove();
  });

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      sessionStorage.setItem('auth-prompt-dismissed', 'true');
      overlay.remove();
    }
  });
}
