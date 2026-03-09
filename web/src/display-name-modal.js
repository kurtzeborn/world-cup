// display-name-modal.js — blocking modal for display name entry/edit

import { api } from './api.js';
import { escapeHtml } from './utils.js';

/**
 * Show a blocking modal that asks the user to set or change their display name.
 * Returns a Promise that resolves with the chosen name, or null if cancelled (edit mode only).
 * @param {string} currentName  Pre-fill value (empty = first-time, non-empty = edit mode)
 */
export function showDisplayNameModal(currentName = '') {
  return new Promise((resolve) => {
    // Don't stack modals
    if (document.querySelector('.display-name-modal')) return;

    const isEdit = !!currentName;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box display-name-modal">
        <h3>${isEdit ? '✏️ Change Display Name' : '👋 Choose a Display Name'}</h3>
        <p>${isEdit
          ? 'Update your name shown on the leaderboard.'
          : 'Pick a name to show on the leaderboard. This is required to continue.'}</p>
        <div class="form-group">
          <label for="display-name-input">Display Name</label>
          <input type="text" id="display-name-input"
            value="${escapeHtml(currentName)}"
            placeholder="2–30 characters"
            maxlength="30"
            autocomplete="off">
          <div id="display-name-error" class="error-msg" style="display:none"></div>
        </div>
        <div class="modal-actions">
          ${isEdit ? '<button class="btn btn-secondary" id="display-name-cancel">Cancel</button>' : ''}
          <button class="btn btn-primary" id="display-name-submit">
            ${isEdit ? 'Update' : 'Continue'}
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = document.getElementById('display-name-input');
    const error = document.getElementById('display-name-error');
    const submit = document.getElementById('display-name-submit');
    const cancel = document.getElementById('display-name-cancel');

    input.focus();
    input.select();

    function showError(msg) {
      error.textContent = msg;
      error.style.display = '';
    }

    async function handleSubmit() {
      const name = input.value.trim();
      if (name.length < 2 || name.length > 30) {
        showError('Must be 2–30 characters');
        return;
      }

      submit.disabled = true;
      submit.textContent = 'Saving…';
      error.style.display = 'none';

      try {
        await api.updateMe({ displayName: name });
        overlay.remove();
        resolve(name);
      } catch (err) {
        submit.disabled = false;
        submit.textContent = isEdit ? 'Update' : 'Continue';
        if (err.status === 409) {
          showError('This name is already taken — try another');
        } else {
          showError('Something went wrong — try again');
        }
      }
    }

    submit.addEventListener('click', handleSubmit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleSubmit();
    });

    if (cancel) {
      cancel.addEventListener('click', () => {
        overlay.remove();
        resolve(null);
      });
    }

    // Only allow click-outside dismiss in edit mode (first-time is required)
    if (isEdit) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
          overlay.remove();
          resolve(null);
        }
      });
    }
  });
}
