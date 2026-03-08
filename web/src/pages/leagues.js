// pages/leagues.js — Leagues page

import { getState, setState } from '../state.js';
import { api } from '../api.js';

export async function renderLeaguesPage(container) {
  const { user } = getState();

  if (!user) {
    container.innerHTML = `
      <div class="page active" id="page-leagues">
        <div class="card">
          <p>Please <a href="${api.loginUrl}">sign in</a> to view or create leagues.</p>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="page active" id="page-leagues">
      <div class="leagues-actions">
        <button class="btn btn-primary" id="btn-create-league">Create League</button>
        <button class="btn btn-secondary" id="btn-join-league">Join League</button>
      </div>
      <div id="leagues-list"><p style="color:var(--text-muted)">Loading…</p></div>
    </div>
  `;

  document.getElementById('btn-create-league').addEventListener('click', showCreateModal);
  document.getElementById('btn-join-league').addEventListener('click', showJoinModal);

  await loadLeagues();
}

async function loadLeagues() {
  const el = document.getElementById('leagues-list');
  if (!el) return;
  try {
    const leagues = await api.getLeagues();
    setState({ leagues });
    if (!leagues.length) {
      el.innerHTML = '<p style="color:var(--text-muted)">You are not in any leagues yet.</p>';
      return;
    }
    el.innerHTML = leagues.map(l => `
      <div class="card" style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <strong>${escapeHtml(l.name)}</strong>
          <span style="font-size:.8rem;color:var(--text-muted);margin-left:.5rem">Code: <code>${l.joinCode}</code></span>
        </div>
        <button class="btn btn-secondary" onclick="viewLeague('${l.leagueId}')">Leaderboard</button>
      </div>
    `).join('');
  } catch (err) {
    el.innerHTML = `<p style="color:#f44336">Error: ${err.message}</p>`;
  }
}

function showCreateModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <h3>Create a League</h3>
      <div class="form-group">
        <label for="league-name">League Name</label>
        <input type="text" id="league-name" placeholder="My Picks League" maxlength="60" />
      </div>
      <div class="error-msg" id="create-error"></div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="btn-cancel-create">Cancel</button>
        <button class="btn btn-primary" id="btn-confirm-create">Create</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('btn-cancel-create').addEventListener('click', () => overlay.remove());
  document.getElementById('btn-confirm-create').addEventListener('click', async () => {
    const name = document.getElementById('league-name').value.trim();
    const errEl = document.getElementById('create-error');
    if (!name) { errEl.textContent = 'League name is required.'; return; }
    try {
      const result = await api.createLeague({ name });
      overlay.remove();
      alert(`League created! Share this join code: ${result.joinCode}`);
      await loadLeagues();
    } catch (err) {
      errEl.textContent = err.message;
    }
  });
}

function showJoinModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <h3>Join a League</h3>
      <div class="form-group">
        <label for="join-code">Join Code</label>
        <input type="text" id="join-code" placeholder="ABC123" maxlength="6" style="text-transform:uppercase" />
      </div>
      <div class="error-msg" id="join-error"></div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="btn-cancel-join">Cancel</button>
        <button class="btn btn-primary" id="btn-confirm-join">Join</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('btn-cancel-join').addEventListener('click', () => overlay.remove());
  document.getElementById('btn-confirm-join').addEventListener('click', async () => {
    const code = document.getElementById('join-code').value.trim().toUpperCase();
    const errEl = document.getElementById('join-error');
    if (!code) { errEl.textContent = 'Join code is required.'; return; }
    try {
      const result = await api.joinLeague({ joinCode: code });
      overlay.remove();
      alert(`Joined "${result.name}"!`);
      await loadLeagues();
    } catch (err) {
      errEl.textContent = err.message;
    }
  });
}

window.viewLeague = async function(leagueId) {
  // Open an inline leaderboard for the specific league
  const { leagues } = getState();
  const league = leagues.find(l => l.leagueId === leagueId);
  const el = document.getElementById('leagues-list');
  if (!el) return;

  try {
    const rows = await api.getLeagueLeaderboard(leagueId);
    const tableHtml = rows.length ? `
      <table class="leaderboard-table">
        <thead><tr><th>#</th><th>Player</th><th>Points</th></tr></thead>
        <tbody>${rows.map((r, i) => `<tr><td>${i+1}</td><td>${escapeHtml(r.displayName || r.userId)}</td><td class="points-total">${r.totalPoints}</td></tr>`).join('')}</tbody>
      </table>
    ` : '<p style="color:var(--text-muted)">No scores yet.</p>';

    // Show in a modal
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box" style="max-width:500px">
        <h3>${escapeHtml(league?.name ?? 'League')}</h3>
        ${tableHtml}
        <div class="modal-actions"><button class="btn btn-secondary" id="btn-close-lb">Close</button></div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('btn-close-lb').addEventListener('click', () => overlay.remove());
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
};

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
