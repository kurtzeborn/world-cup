// pages/leagues.js — Leagues page

import { getState } from '../state.js';
import { api } from '../api.js';
import { escapeHtml } from '../utils.js';

export async function renderLeaguesPage(container) {
  const { user } = getState();

  if (!user) {
    container.innerHTML = `
      <div class="page active" id="page-leagues">
        <div class="card">
          <p style="margin-bottom:1rem">Sign in to view or create leagues.</p>
          <div style="display:flex;gap:.75rem;flex-wrap:wrap">
            <a href="${api.loginUrl}" class="btn btn-primary" style="text-decoration:none">
              <i class="fa-brands fa-microsoft"></i> Sign in with Microsoft
            </a>
            <a href="${api.loginGoogleUrl}" class="btn btn-secondary" style="text-decoration:none">
              <i class="fa-brands fa-google"></i> Sign in with Google
            </a>
          </div>
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
    const { user } = getState();
    if (!leagues.length) {
      el.innerHTML = '<p style="color:var(--text-muted)">You are not in any leagues yet.</p>';
      return;
    }
    el.innerHTML = leagues.map(l => {
      const isCreator = user && l.createdBy === user.userId;
      return `
      <div class="card" style="display:flex;justify-content:space-between;align-items:center">
        <div>
          <strong class="league-name-text" data-league-id="${l.leagueId}">${escapeHtml(l.name)}</strong>${isCreator ? `<button class="btn-icon league-rename-btn" data-league-id="${l.leagueId}" data-league-name="${escapeHtml(l.name)}" title="Rename league"><i class="fa-solid fa-pen"></i></button>` : ''}
          <span style="font-size:.8rem;color:var(--text-muted);margin-left:.5rem">Code: <code>${l.joinCode}</code></span>
        </div>
        <button class="btn btn-secondary league-view-btn" data-league-id="${l.leagueId}">Leaderboard</button>
      </div>
    `;
    }).join('');

    // Attach click listeners for league leaderboards
    el.querySelectorAll('.league-view-btn').forEach(btn => {
      btn.addEventListener('click', () => viewLeague(btn.dataset.leagueId));
    });
    el.querySelectorAll('.league-rename-btn').forEach(btn => {
      btn.addEventListener('click', () => showRenameModal(btn.dataset.leagueId, btn.dataset.leagueName));
    });
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

async function viewLeague(leagueId) {
  // Open an inline leaderboard for the specific league
  const { user } = getState();
  const el = document.getElementById('leagues-list');
  if (!el) return;

  try {
    const data = await api.getLeagueLeaderboard(leagueId);
    const rows = data.leaderboard ?? data; // support new { createdBy, leaderboard } shape
    const createdBy = data.createdBy ?? null;
    const isCreator = user && createdBy === user.userId;

    const tableHtml = rows.length ? `
      <table class="leaderboard-table">
        <thead><tr><th>#</th><th>Player</th><th>Points</th><th>Max</th>${isCreator ? '<th></th>' : ''}</tr></thead>
        <tbody>${rows.map((r, i) => {
          const name = escapeHtml(r.displayName || r.userId);
          let kickCell = '';
          if (isCreator && r.userId !== user.userId) {
            kickCell = `<td><button class="btn-icon kick-btn" data-user-id="${r.userId}" data-name="${name}" title="Remove member"><i class="fa-solid fa-user-xmark"></i></button></td>`;
          } else if (isCreator) {
            kickCell = '<td></td>';
          }
          return `<tr><td>${i+1}</td><td>${name}</td><td class="points-total">${r.totalPoints}</td><td class="points-max">${r.maxPossiblePoints ?? '—'}</td>${kickCell}</tr>`;
        }).join('')}</tbody>
      </table>
    ` : '<p style="color:var(--text-muted)">No members yet.</p>';

    // Show in a modal
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box" style="max-width:500px">
        <h3>${escapeHtml(rows.length ? 'League Leaderboard' : 'League')}</h3>
        ${tableHtml}
        <div class="modal-actions"><button class="btn btn-secondary" id="btn-close-lb">Close</button></div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('btn-close-lb').addEventListener('click', () => overlay.remove());

    // Attach kick handlers
    if (isCreator) {
      overlay.querySelectorAll('.kick-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const memberId = btn.dataset.userId;
          const name = btn.dataset.name;
          if (!confirm(`Remove ${name} from this league?`)) return;
          try {
            await api.kickMember(leagueId, memberId);
            overlay.remove();
            viewLeague(leagueId); // refresh
          } catch (err) {
            alert(`Error: ${err.message}`);
          }
        });
      });
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

function showRenameModal(leagueId, currentName) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <h3>Rename League</h3>
      <div class="form-group">
        <label for="rename-league-name">League Name</label>
        <input type="text" id="rename-league-name" value="${escapeHtml(currentName)}" maxlength="60" />
      </div>
      <div class="error-msg" id="rename-error"></div>
      <div class="modal-actions">
        <button class="btn btn-secondary" id="btn-cancel-rename">Cancel</button>
        <button class="btn btn-primary" id="btn-confirm-rename">Rename</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('btn-cancel-rename').addEventListener('click', () => overlay.remove());
  document.getElementById('btn-confirm-rename').addEventListener('click', async () => {
    const name = document.getElementById('rename-league-name').value.trim();
    const errEl = document.getElementById('rename-error');
    if (!name) { errEl.textContent = 'League name is required.'; return; }
    try {
      await api.renameLeague(leagueId, { name });
      overlay.remove();
      await loadLeagues();
    } catch (err) {
      errEl.textContent = err.message;
    }
  });
}


