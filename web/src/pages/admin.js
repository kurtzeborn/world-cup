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

      html += `<div class="admin-match-card">
        ${adminTeamRow(teamA, winner, matchId, infoStr, true)}
        <div class="bk-match-info">${infoStr}</div>
        ${adminTeamRow(teamB, winner, matchId, null, false)}
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

    // Build match results from local state
    const mt = resolveAdminMatchTeams();
    const matchResults = {};
    for (const round of KNOCKOUT_ROUNDS) {
      for (const matchId of round.matches) {
        const winner = adminMatchResults[matchId];
        if (!winner) {
          throw new Error(`Match M${matchId} has no winner selected`);
        }
        const [teamA, teamB] = mt[matchId] || [null, null];
        const loser = winner === teamA ? teamB : teamA;
        matchResults[`M${matchId}`] = { winner, loser };
      }
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
