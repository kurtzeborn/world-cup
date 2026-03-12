// pages/admin.js — Admin page for entering match results

import { api } from '../api.js';
import { TEAMS_BY_ID, GROUP_LETTERS } from '../data/teams.js';
import { BRACKET_STRUCTURE, MATCH_SCHEDULE, THIRD_PLACE_SLOTS } from '../data/bracket-structure.js';
import { getThirdPlacePlacements } from '../data/third-place-table.js';
import { getFlag } from '../utils.js';
import { renderGroupRanking } from '../components/group-ranking.js';

// Local admin state
let adminGroupPicks = {};
let adminThirdPlace = [];
let adminMatchResults = {};  // { matchId: winnerId }
let adminMatchScores = {};   // { matchId: scoreString }

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
  adminMatchResults = {};
  adminMatchScores = {};

  // Load existing results from backend
  try {
    const existing = await api.getResults();
    if (existing) {
      if (existing.groupStandings) adminGroupPicks = existing.groupStandings;
      if (existing.advancing3rdPlace) {
        // Convert team IDs back to group letters for the checkbox UI
        adminThirdPlace = existing.advancing3rdPlace.map(teamId => {
          for (const [group, teams] of Object.entries(adminGroupPicks)) {
            if (teams[2] === teamId) return group;
          }
          return null;
        }).filter(Boolean);
      }
      if (existing.matchResults) {
        for (const [key, val] of Object.entries(existing.matchResults)) {
          const matchId = parseInt(key.replace('M', ''));
          adminMatchResults[matchId] = val.winner;
          if (val.score) adminMatchScores[matchId] = val.score;
        }
      }
    }
  } catch (_) {
    // No existing results yet — start blank
  }

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
          Click the winning team for each knockout match. Teams are resolved from
          group standings above.
        </p>
        <div id="admin-knockout-grid"></div>
      </div>

      <div class="admin-actions">
        <button type="submit" class="btn btn-primary">Save Results</button>
        <button type="button" class="btn btn-secondary" id="btn-recalc">Recalculate Scores</button>
        <button type="button" class="btn btn-danger" id="btn-lock-all">Force Lock All Picks</button>
        <button type="button" class="btn btn-secondary" id="btn-unlock-all">Unlock All Picks</button>
        <button type="button" class="btn btn-danger" id="btn-clear-results">Clear All Results</button>
        <a href="#manage-users" class="btn btn-secondary">Manage Users</a>
        <div id="admin-status" style="margin-top: 1rem; font-size: .9rem;"></div>
      </div>
    </form>
  `;

  refreshAdminGroupGrid();
  refreshAdminKnockoutGrid();

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

  document.getElementById('btn-unlock-all').addEventListener('click', () => {
    adminUnlockAll();
  });

  document.getElementById('btn-clear-results').addEventListener('click', () => {
    clearAllResults();
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
      refreshAdminKnockoutGrid();
    },
    onThirdPlaceChange: (newThirdPlace) => {
      adminThirdPlace = newThirdPlace;
      refreshAdminGroupGrid();
      refreshAdminKnockoutGrid();
    },
  });
}

const KNOCKOUT_ROUNDS = [
  { name: 'R32', label: 'Round of 32', matches: [73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88] },
  { name: 'R16', label: 'Round of 16', matches: [89, 90, 91, 92, 93, 94, 95, 96] },
  { name: 'QF',  label: 'Quarter-Finals', matches: [97, 98, 99, 100] },
  { name: 'SF',  label: 'Semi-Finals', matches: [101, 102] },
  { name: 'TPM', label: '3rd-Place Match', matches: [103] },
  { name: 'F',   label: 'Final', matches: [104] },
];

function refreshAdminKnockoutGrid() {
  const container = document.getElementById('admin-knockout-grid');
  if (!container) return;

  const mt = resolveAdminMatchTeams();

  let html = '';
  for (const round of KNOCKOUT_ROUNDS) {
    html += `<div class="admin-round-section">
      <h4>${round.label}</h4>
      <div class="admin-matches-grid">`;

    for (const matchId of round.matches) {
      const [teamA, teamB] = mt[matchId] || [null, null];
      const winner = adminMatchResults[matchId] ?? null;
      const sched = MATCH_SCHEDULE[matchId];
      const infoStr = sched ? `M${matchId} · ${sched.date} · ${sched.city}` : `M${matchId}`;

      const scoreVal = adminMatchScores[matchId] ?? '';
      html += `<div class="admin-match-card">
        ${adminTeamRow(teamA, winner, matchId, infoStr, true)}
        <div class="bk-match-info">${infoStr}</div>
        ${adminTeamRow(teamB, winner, matchId, null, false)}
        <div class="admin-score-row">
          <input type="text" class="admin-score-input" data-match-id="${matchId}"
            placeholder="e.g. 2-1" value="${scoreVal}" />
        </div>
      </div>`;
    }

    html += '</div></div>';
  }

  container.innerHTML = html;

  // Attach click handlers
  container.querySelectorAll('.bk-team.pickable').forEach(el => {
    el.addEventListener('click', () => {
      const matchId = parseInt(el.dataset.matchId);
      const teamId = el.dataset.teamId;
      adminMatchResults[matchId] = teamId;
      refreshAdminKnockoutGrid();
    });
  });

  // Attach score input handlers
  container.querySelectorAll('.admin-score-input').forEach(el => {
    el.addEventListener('input', () => {
      const matchId = parseInt(el.dataset.matchId);
      adminMatchScores[matchId] = el.value;
    });
  });
}

function adminTeamRow(teamId, winner, matchId) {
  const cls = ['bk-team'];
  if (teamId && winner === teamId) cls.push('picked');
  if (teamId) cls.push('pickable');

  if (teamId) {
    const t = TEAMS_BY_ID[teamId];
    const name = t ? `${getFlag(t.flagCode)} ${t.name}` : teamId;
    return `<div class="${cls.join(' ')}" data-match-id="${matchId}" data-team-id="${teamId}">${name}</div>`;
  }
  return `<div class="${cls.join(' ')}"><span class="bk-tbd">TBD</span></div>`;
}

/** Resolve knockout match teams from admin group standings + match results. */
function resolveAdminMatchTeams() {
  const result = {};

  // Build 3rd-place slot mapping
  let thirdPlaceBySlot = {};
  if (adminThirdPlace.length === 8) {
    const placements = getThirdPlacePlacements(adminThirdPlace);
    if (placements) {
      THIRD_PLACE_SLOTS.forEach((matchId, i) => {
        const groupLetter = placements[i];
        const groupTeams = adminGroupPicks[groupLetter] ?? [];
        thirdPlaceBySlot[matchId] = groupTeams[2] ?? null;
      });
    }
  }

  // Resolve R32 from group standings
  for (const match of BRACKET_STRUCTURE) {
    if (match.round !== 'R32') continue;
    result[match.id] = [
      resolveGroupSlot(match.teamA, thirdPlaceBySlot),
      resolveGroupSlot(match.teamB, thirdPlaceBySlot),
    ];
  }

  // Resolve later rounds from admin match results
  for (const round of ['R16', 'QF', 'SF', 'TPM', 'F']) {
    for (const match of BRACKET_STRUCTURE.filter(m => m.round === round)) {
      result[match.id] = [
        resolveKnockoutSlot(match.teamA, result),
        resolveKnockoutSlot(match.teamB, result),
      ];
    }
  }

  return result;
}

function resolveGroupSlot(slot, thirdPlaceBySlot) {
  if (!slot) return null;
  if (slot.startsWith('3P_')) {
    const matchId = parseInt(slot.replace('3P_', ''));
    return thirdPlaceBySlot[matchId] ?? null;
  }
  const rank = parseInt(slot[0]);
  const group = slot.slice(1);
  if (rank === 1 || rank === 2) return (adminGroupPicks[group] ?? [])[rank - 1] ?? null;
  return null;
}

function resolveKnockoutSlot(slot, resolvedMatches) {
  if (!slot) return null;
  if (slot.startsWith('W')) {
    const matchId = parseInt(slot.slice(1));
    return adminMatchResults[matchId] ?? null;
  }
  if (slot.startsWith('L')) {
    const matchId = parseInt(slot.slice(1));
    const winner = adminMatchResults[matchId];
    const [teamA, teamB] = resolvedMatches[matchId] ?? [];
    if (!winner || (!teamA && !teamB)) return null;
    return winner === teamA ? teamB : teamA;
  }
  return null;
}

async function submitResults() {
  const form = document.getElementById('admin-form');
  if (!form) return;

  const statusEl = document.getElementById('admin-status');
  statusEl.innerHTML = '<p style="color:var(--text-muted)">Saving…</p>';

  try {
    const payload = {};

    // Build group standings — include only fully ranked groups (all 4 teams)
    const groupStandings = {};
    for (const group of GROUP_LETTERS) {
      const selected = adminGroupPicks[group] ?? [];
      if (selected.length === 4) groupStandings[group] = selected;
    }
    if (Object.keys(groupStandings).length > 0) payload.groupStandings = groupStandings;

    // Convert 3rd-place group letters → team IDs (only if 8 are selected)
    if (adminThirdPlace.length === 8) {
      const advancing3rdPlace = [];
      let valid = true;
      for (const letter of adminThirdPlace) {
        const thirdTeamId = groupStandings[letter]?.[2];
        if (!thirdTeamId) { valid = false; break; }
        advancing3rdPlace.push(thirdTeamId);
      }
      if (valid) payload.advancing3rdPlace = advancing3rdPlace;
    }

    // Build match results — include only matches with a winner selected
    const mt = resolveAdminMatchTeams();
    const matchResults = {};
    for (const round of KNOCKOUT_ROUNDS) {
      for (const matchId of round.matches) {
        const winner = adminMatchResults[matchId];
        if (!winner) continue;
        const [teamA, teamB] = mt[matchId] || [null, null];
        const loser = winner === teamA ? teamB : teamA;
        const score = adminMatchScores[matchId]?.trim() || undefined;
        matchResults[`M${matchId}`] = { winner, loser, ...(score && { score }) };
      }
    }
    if (Object.keys(matchResults).length > 0) payload.matchResults = matchResults;

    if (Object.keys(payload).length === 0) {
      throw new Error('Nothing to save — rank at least one group or pick a match winner');
    }

    // Submit to API
    await api.submitAdminResults(payload);

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

async function adminUnlockAll() {
  if (!confirm('Unlock ALL users\u2019 picks? They will be able to edit their picks again.')) return;

  const statusEl = document.getElementById('admin-status');
  const unlockButton = document.getElementById('btn-unlock-all');
  statusEl.innerHTML = '<p style="color:var(--text-muted)">Unlocking all picks…</p>';
  unlockButton.disabled = true;

  try {
    const result = await api.adminUnlockAllPicks();
    statusEl.innerHTML = `<p style="color:#4caf50">✓ Unlocked ${result.unlocked} picks (${result.skipped} already unlocked)</p>`;
  } catch (err) {
    statusEl.innerHTML = `<p style="color:#f44336">Error: ${err.message}</p>`;
  } finally {
    unlockButton.disabled = false;
  }
}

async function clearAllResults() {
  if (!confirm('Clear ALL results? This will delete stored results (picks are not affected).')) return;

  const statusEl = document.getElementById('admin-status');
  statusEl.innerHTML = '<p style="color:var(--text-muted)">Clearing results…</p>';

  try {
    await api.clearResults();

    // Reset local state
    adminGroupPicks = {};
    adminThirdPlace = [];
    adminMatchResults = {};
    adminMatchScores = {};

    // Re-render form
    const contentEl = document.getElementById('admin-content');
    if (contentEl) renderAdminForm(contentEl);

    const newStatus = document.getElementById('admin-status');
    if (newStatus) newStatus.innerHTML = '<p style="color:#4caf50">✓ Results cleared</p>';
  } catch (err) {
    statusEl.innerHTML = `<p style="color:#f44336">Error: ${err.message}</p>`;
  }
}


