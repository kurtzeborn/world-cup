// pages/leaderboard.js — Leaderboard page (global + league)

import { api } from '../api.js';
import { escapeHtml, getFlag } from '../utils.js';
import { TEAMS_BY_ID } from '../data/teams.js';

export async function renderLeaderboardPage(container, leagueId) {
  container.innerHTML = `
    <div class="page active" id="page-leaderboard">
      <div class="card">
        <div class="card-title" id="leaderboard-title">Leaderboard</div>
        <div id="leaderboard-content"><p style="color:var(--text-muted)">Loading…</p></div>
      </div>
    </div>
  `;

  try {
    let leaderboard;

    if (leagueId) {
      const data = await api.getLeagueLeaderboard(leagueId);
      leaderboard = data.leaderboard;
      document.getElementById('leaderboard-title').textContent = data.leagueName || 'League Leaderboard';
    } else {
      leaderboard = await api.getLeaderboard();
      document.getElementById('leaderboard-title').textContent = 'Global Leaderboard';
    }

    renderTable(leaderboard);
  } catch (err) {
    document.getElementById('leaderboard-content').innerHTML =
      `<p style="color:#f44336">Failed to load leaderboard: ${err.message}</p>`;
  }
}

function championFlagCell(teamId) {
  if (!teamId) return '<td class="lb-champion-cell">—</td>';
  const team = TEAMS_BY_ID[teamId];
  if (!team) return `<td class="lb-champion-cell"><span style="font-size:.75em;color:var(--text-muted)">${escapeHtml(teamId)}</span></td>`;
  return `<td class="lb-champion-cell" title="${escapeHtml(team.name)}">${getFlag(team.flagCode, team.name)}</td>`;
}

function renderTable(leaderboard) {
  const el = document.getElementById('leaderboard-content');
  if (!el) return;

  if (!leaderboard.length) {
    el.innerHTML = '<p style="color:var(--text-muted)">No members.</p>';
    return;
  }

  el.innerHTML = `
    <table class="leaderboard-table">
      <thead>
        <tr>
          <th>#</th>
          <th class="lb-champion-header" title="Predicted champion">🏆</th>
          <th>Player</th>
          <th>Total</th>
          <th>Max</th>
          <th class="lb-hide-mobile">Group</th>
          <th class="lb-hide-mobile">3rd Place</th>
          <th class="lb-hide-mobile">Knockout</th>
        </tr>
      </thead>
      <tbody>
        ${leaderboard.map((row, i) => {
          const name = escapeHtml(row.displayName || row.userId);
          const flagCell = championFlagCell(row.championPick);
          return `
          <tr class="lb-clickable" data-user-id="${row.userId}">
            <td class="rank-num">${i + 1}</td>
            ${flagCell}
            <td>${name}</td>
            <td class="points-total">${row.totalPoints}</td>
            <td class="points-max">${row.maxPossiblePoints ?? '—'}</td>
            <td class="lb-hide-mobile">${row.groupPoints}</td>
            <td class="lb-hide-mobile">${row.thirdPlacePoints}</td>
            <td class="lb-hide-mobile">${row.knockoutPoints}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;

  // Click row → view picks
  el.querySelectorAll('tr[data-user-id]').forEach(row => {
    row.style.cursor = 'pointer';
    row.addEventListener('click', () => {
      const userId = row.dataset.userId;
      history.pushState(null, '', `/view-picks/${userId}`);
      dispatchEvent(new PopStateEvent('popstate'));
    });
  });
}
