// pages/admin.js — Admin page for entering match results

import { api } from '../api.js';
import { TEAMS_BY_ID } from '../data/teams.js';
import { BRACKET_STRUCTURE, MATCH_SCHEDULE } from '../data/bracket-structure.js';
import { escapeHtml, getFlag } from '../utils.js';

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const MATCH_BY_ID = Object.fromEntries(BRACKET_STRUCTURE.map(m => [m.id, m]));

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

  try {
    const teams = (await api.getTeams()) || [];
    renderAdminForm(contentEl, teams);
  } catch (err) {
    contentEl.innerHTML = `<p style="color:#f44336">Error loading admin page: ${err.message}</p>`;
  }
}

function renderAdminForm(container, teams) {
  const groupTeams = {};
  for (const group of GROUPS) {
    groupTeams[group] = teams.filter(t => t.group === group);
  }

  const thirdPlaceTeams = teams.filter(t => {
    const groupTeams = Object.keys(teams.reduce((acc, t) => {
      if (!acc[t.group]) acc[t.group] = [];
      acc[t.group].push(t);
      return acc;
    }, {}));
    for (const g of groupTeams) {
      const gTeams = teams.filter(t => t.group === g).sort((a, b) => a.groupSeed - b.groupSeed);
      if (gTeams[2] === t) return true;
    }
    return false;
  });

  // Organize 3rd-place teams by group
  const thirdPlaceByGroup = {};
  for (const group of GROUPS) {
    const gTeams = groupTeams[group].sort((a, b) => a.groupSeed - b.groupSeed);
    if (gTeams[2]) {
      thirdPlaceByGroup[group] = gTeams[2];
    }
  }

  container.innerHTML = `
    <form id="admin-form">
      <div class="admin-section">
        <h3>Group Stage Results</h3>
        <p style="font-size: .85rem; color: var(--text-muted); margin-bottom: 1rem;">
          Enter the 1st and 2nd place finishers for each group. 3rd/4th place will be inferred.
        </p>
        ${renderGroupStandingsForm(groupTeams)}
      </div>

      <div class="admin-section">
        <h3>3rd-Place Advancing Teams (select 8)</h3>
        <p style="font-size: .85rem; color: var(--text-muted); margin-bottom: 1rem;">
          Select the 8 third-place teams that advance to Round of 32.
        </p>
        ${renderThirdPlaceForm(thirdPlaceByGroup)}
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
        <div id="admin-status" style="margin-top: 1rem; font-size: .9rem;"></div>
      </div>
    </form>
  `;

  // Attach submit handler
  document.getElementById('admin-form').addEventListener('submit', e => {
    e.preventDefault();
    submitResults(container, groupTeams);
  });

  // Attach recalc handler
  document.getElementById('btn-recalc').addEventListener('click', () => {
    recalculateScores(container);
  });
}

function renderGroupStandingsForm(groupTeams) {
  let html = '<div class="admin-groups-grid">';
  for (const group of GROUPS) {
    const teams = groupTeams[group];
    const teamOptions = teams
      .sort((a, b) => a.groupSeed - b.groupSeed)
      .map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`)
      .join('');

    html += `
      <div class="admin-group-card">
        <div class="admin-group-label">Group ${group}</div>
        <div class="admin-form-row">
          <label>1st Place:</label>
          <select name="group_${group}_1" required>
            <option value="">— Choose —</option>
            ${teamOptions}
          </select>
        </div>
        <div class="admin-form-row">
          <label>2nd Place:</label>
          <select name="group_${group}_2" required>
            <option value="">— Choose —</option>
            ${teamOptions}
          </select>
        </div>
      </div>
    `;
  }
  html += '</div>';
  return html;
}

function renderThirdPlaceForm(thirdPlaceByGroup) {
  let html = '<div class="admin-3rdplace-grid">';
  for (const group of GROUPS) {
    const team = thirdPlaceByGroup[group];
    if (!team) continue;

    html += `
      <label class="admin-checkbox-label">
        <input type="checkbox" name="3rdplace_${team.id}" value="${team.id}" />
        <span>${getFlag(team.flagCode)} ${escapeHtml(team.name)}</span>
      </label>
    `;
  }
  html += '</div>';
  return html;
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

async function submitResults(container, groupTeams) {
  const form = document.getElementById('admin-form');
  if (!form) return;

  const statusEl = document.getElementById('admin-status');
  statusEl.innerHTML = '<p style="color:var(--text-muted)">Saving…</p>';

  try {
    // Extract group standings
    const groupStandings = {};
    for (const group of GROUPS) {
      const first = form.querySelector(`select[name="group_${group}_1"]`).value;
      const second = form.querySelector(`select[name="group_${group}_2"]`).value;

      if (!first || !second) {
        throw new Error(`Group ${group} missing 1st or 2nd place`);
      }

      // Infer 3rd/4th from available teams
      const available = groupTeams[group]
        .filter(t => t.id !== first && t.id !== second)
        .sort((a, b) => a.groupSeed - b.groupSeed);

      groupStandings[group] = [first, second, available[0]?.id || 'TBD', available[1]?.id || 'TBD'];
    }

    // Extract 3rd-place advancing
    const advancing3rdPlace = [];
    for (const checkbox of form.querySelectorAll('input[type="checkbox"][name^="3rdplace_"]:checked')) {
      advancing3rdPlace.push(checkbox.value);
    }
    if (advancing3rdPlace.length !== 8) {
      throw new Error(`Must select exactly 8 third-place teams (${advancing3rdPlace.length} selected)`);
    }

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

async function recalculateScores(container) {
  const statusEl = document.getElementById('admin-status');
  statusEl.innerHTML = '<p style="color:var(--text-muted)">Recalculating scores…</p>';

  try {
    const result = await api.recalculateScores();
    statusEl.innerHTML = `<p style="color:#4caf50">✓ Recalculated ${result.recalculated} scores</p>`;
  } catch (err) {
    statusEl.innerHTML = `<p style="color:#f44336">Error: ${err.message}</p>`;
  }
}
