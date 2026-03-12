// pages/leaderboard.js — Leaderboard page

import { getState } from '../state.js';
import { api } from '../api.js';
import { escapeHtml } from '../utils.js';

export async function renderLeaderboardPage(container) {
  container.innerHTML = `
    <div class="page active" id="page-leaderboard">
      <div class="card">
        <div class="card-title">Global Leaderboard</div>
        <div id="leaderboard-content"><p style="color:var(--text-muted)">Loading…</p></div>
      </div>
    </div>
  `;

  try {
    const leaderboard = await api.getLeaderboard();
    renderTable(leaderboard);
  } catch (err) {
    document.getElementById('leaderboard-content').innerHTML =
      `<p style="color:#f44336">Failed to load leaderboard: ${err.message}</p>`;
  }
}

function renderTable(leaderboard) {
  const el = document.getElementById('leaderboard-content');
  if (!el) return;

  if (!leaderboard.length) {
    el.innerHTML = '<p style="color:var(--text-muted)">No scores yet — check back after matches begin.</p>';
    return;
  }

  const { user, locked } = getState();

  el.innerHTML = `
    <table class="leaderboard-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Player</th>
          <th>Total</th>
          <th>Max</th>
          <th>Group</th>
          <th>3rd Place</th>
          <th>Knockout</th>
        </tr>
      </thead>
      <tbody>
        ${leaderboard.map((row, i) => {
          const classes = [];
          if (user?.userId === row.userId) classes.push('current-user-row');
          if (locked) classes.push('lb-clickable');
          return `
          <tr ${classes.length ? `class="${classes.join(' ')}"` : ''} ${locked ? `data-user-id="${row.userId}"` : ''}>
            <td class="rank-num">${i + 1}</td>
            <td>${escapeHtml(row.displayName || row.userId)}</td>
            <td class="points-total">${row.totalPoints}</td>
            <td class="points-max">${row.maxPossiblePoints ?? '—'}</td>
            <td>${row.groupPoints}</td>
            <td>${row.thirdPlacePoints}</td>
            <td>${row.knockoutPoints}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;

  // Add click handlers to rows if picks are locked
  if (locked) {
    el.querySelectorAll('tr[data-user-id]').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => {
        const userId = row.dataset.userId;
        window.location.hash = `#view-picks/${userId}`;
      });
    });
  }
}



