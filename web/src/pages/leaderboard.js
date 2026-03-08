// pages/leaderboard.js — Leaderboard page

import { getState } from '../state.js';
import { api } from '../api.js';

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

  const { user } = getState();

  el.innerHTML = `
    <table class="leaderboard-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Player</th>
          <th>Total</th>
          <th>Group</th>
          <th>3rd Place</th>
          <th>Knockout</th>
        </tr>
      </thead>
      <tbody>
        ${leaderboard.map((row, i) => `
          <tr ${user?.userId === row.userId ? 'style="background:#fffde7"' : ''}>
            <td class="rank-num">${i + 1}</td>
            <td>${escapeHtml(row.displayName || row.userId)}</td>
            <td class="points-total">${row.totalPoints}</td>
            <td>${row.groupPoints}</td>
            <td>${row.thirdPlacePoints}</td>
            <td>${row.knockoutPoints}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
