// pages/admin.js — Admin page for entering match results

import { api } from '../api.js';
import { GROUP_LETTERS } from '../data/teams.js';
import { BRACKET_STRUCTURE, MATCH_SCHEDULE } from '../data/bracket-structure.js';
import { escapeHtml } from '../utils.js';
import { renderGroupRanking } from '../components/group-ranking.js';

const MATCH_BY_ID = Object.fromEntries(BRACKET_STRUCTURE.map(m => [m.id, m]));

// Local admin state for group standings + 3rd-place advancing
let adminGroupPicks = {};
let adminThirdPlace = [];

export async function renderAdminPage(container) {
  container.innerHTML = `
    <div class="page active" id="page-admin">
      <div class="card">
        <div class="card-title">Admin: Enter Results</div>
        <div id="admin-content">Loading…</div>
      </div>
    </div>
  `;

  const contentEl = document.getElementById('admin-content');
  if (!contentEl) return;

  // Reset local state
  adminGroupPicks = {};
  adminThirdPlace = [];

  renderAdminForm(contentEl);
}

function renderAdminForm(container) {
  container.innerHTML = `
    <form id="admin-form">
      <div class="admin-section">
        <h3>Group Stage Results</h3>
        <p style="font-size: .85rem; color: var(--text-muted); margin-bottom: 1rem;">
          Click teams to rank 1st–4th in each group. Check "Advance?" for the 8
          third-place teams that advance to Round of 32.
        </p>
        <div class="groups-grid" id="admin-groups-grid"></div>
      </div>

      <div class="admin-section">
        <h3>Knockout Results</h3>
        <p style="font-size: .85rem; color: var(--text-muted); margin-bottom: 1rem;">
          Enter the winner for each knockout match.
        </p>
        ${renderKnockoutForm()}
      </div>

      <div class="admin-actions">
        <button type="submit" class="btn btn-primary">Save Results</button>
        <button type="button" class="btn btn-secondary" id="btn-recalc">Recalculate Scores</button>
        <button type="button" class="btn btn-danger" id="btn-lock-all">Force Lock All Picks</button>
        <div id="admin-status" style="margin-top: 1rem; font-size: .9rem;"></div>
      </div>
    </form>
  `;

  refreshAdminGroupGrid();

  document.getElementById('admin-form').addEventListener('submit', e => {
    e.preventDefault();
    submitResults();
  });

  document.getElementById('btn-recalc').addEventListener('click', () => {
    recalculateScores();
  });

  document.getElementById('btn-lock-all').addEventListener('click', () => {
    adminLockAll();
  });
}

function refreshAdminGroupGrid() {
  const grid = document.getElementById('admin-groups-grid');
  if (!grid) return;

  renderGroupRanking(grid, {
    groupPicks: adminGroupPicks,
    thirdPlaceAdvancing: adminThirdPlace,
    locked: false,
    onGroupPickChange: (newGroupPicks) => {
      adminGroupPicks = newGroupPicks;
      refreshAdminGroupGrid();
    },
    onThirdPlaceChange: (newThirdPlace) => {
      adminThirdPlace = newThirdPlace;
      refreshAdminGroupGrid();
    },
  });
}

function renderKnockoutForm() {
  const roundNames = {
    R32: 'Round of 32',
    R16: 'Round of 16',
    QF: 'Quarter-Finals',
    SF: 'Semi-Finals',
    TPM: '3rd-Place Match',
    F: 'Final',
  };

  const rounds = [
    { name: 'R32', matches: [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88] },
    { name: 'R16', matches: [89, 90, 91, 92, 93, 94, 95, 96] },
    { name: 'QF', matches: [97, 98, 99, 100] },
    { name: 'SF', matches: [101, 102] },
    { name: 'TPM', matches: [103] },
    { name: 'F', matches: [104] },
  ];

  let html = '';
  for (const round of rounds) {
    html += `
      <div class="admin-round-section">
        <h4>${roundNames[round.name]}</h4>
        <div class="admin-matches-grid">
    `;

    for (const matchId of round.matches) {
      const match = MATCH_BY_ID[matchId];
      const sched = MATCH_SCHEDULE[matchId];
      const dateStr = sched ? `${sched.date} · ${sched.city}` : '';

      html += `
        <div class="admin-match-card">
          <div class="admin-match-num">M${matchId}</div>
          ${dateStr ? `<div class="admin-match-date">${dateStr}</div>` : ''}
          <div class="admin-match-teams">
            <div>${escapeHtml(match.teamA)}</div>
            <div style="text-align: center; font-size: .85rem; color: var(--text-muted);">vs</div>
            <div>${escapeHtml(match.teamB)}</div>
          </div>
          <select name="match_${matchId}" required>
            <option value="">— Winner —</option>
            <option value="${match.teamA}">${escapeHtml(match.teamA)}</option>
            <option value="${match.teamB}">${escapeHtml(match.teamB)}</option>
          </select>
        </div>
      `;
    }

    html += '</div></div>';
  }

  return html;
}

async function submitResults() {
  const form = document.getElementById('admin-form');
  if (!form) return;

  const statusEl = document.getElementById('admin-status');
  statusEl.innerHTML = '<p style="color:var(--text-muted)">Saving…</p>';

  try {
    // Build group standings from local state (all 4 positions required)
    const groupStandings = {};
    for (const group of GROUP_LETTERS) {
      const selected = adminGroupPicks[group] ?? [];
      if (selected.length < 4) {
        throw new Error(`Group ${group} must have all 4 teams ranked (${selected.length} ranked)`);
      }
      groupStandings[group] = selected;
    }

    // Convert 3rd-place group letters → team IDs (position [2] in each group ranking)
    if (adminThirdPlace.length !== 8) {
      throw new Error(`Must select exactly 8 third-place advancing teams (${adminThirdPlace.length} selected)`);
    }
    const advancing3rdPlace = adminThirdPlace.map(letter => {
      const thirdTeamId = groupStandings[letter]?.[2];
      if (!thirdTeamId) throw new Error(`Group ${letter} has no 3rd-place team ranked`);
      return thirdTeamId;
    });

    // Extract match results
    const matchResults = {};
    for (const select of form.querySelectorAll('select[name^="match_"]')) {
      const matchId = select.name.replace('match_', '');
      const winner = select.value;
      if (!winner) {
        throw new Error(`Match ${matchId} has no winner`);
      }
      const match = MATCH_BY_ID[matchId];
      const loser = match.teamA === winner ? match.teamB : match.teamA;
      matchResults[`M${matchId}`] = { winner, loser };
    }

    // Submit to API
    await api.submitAdminResults({
      groupStandings,
      advancing3rdPlace,
      matchResults,
    });

    statusEl.innerHTML = '<p style="color:#4caf50">✓ Results saved successfully!</p>';
  } catch (err) {
    statusEl.innerHTML = `<p style="color:#f44336">Error: ${err.message}</p>`;
  }
}

async function recalculateScores() {
  const statusEl = document.getElementById('admin-status');
  statusEl.innerHTML = '<p style="color:var(--text-muted)">Recalculating scores…</p>';

  try {
    const result = await api.recalculateScores();
    statusEl.innerHTML = `<p style="color:#4caf50">✓ Recalculated ${result.recalculated} scores</p>`;
  } catch (err) {
    statusEl.innerHTML = `<p style="color:#f44336">Error: ${err.message}</p>`;
  }
}

async function adminLockAll() {
  if (!confirm('Lock ALL users\u2019 picks now? This cannot be undone.')) return;

  const statusEl = document.getElementById('admin-status');
  const lockButton = document.getElementById('btn-lock-all');
  statusEl.innerHTML = '<p style="color:var(--text-muted)">Locking all picks…</p>';
  lockButton.disabled = true;

  try {
    const result = await api.adminLockAllPicks();
    statusEl.innerHTML = `<p style="color:#4caf50">✓ Locked ${result.locked} picks (${result.skipped} already locked)</p>`;
  } catch (err) {
    statusEl.innerHTML = `<p style="color:#f44336">Error: ${err.message}</p>`;
  } finally {
    lockButton.disabled = false;
  }
}
