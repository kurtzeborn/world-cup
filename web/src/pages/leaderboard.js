// pages/leaderboard.js — Leaderboard page (global + league)

import { getState } from '../state.js';
import { api } from '../api.js';
import { escapeHtml } from '../utils.js';

export async function renderLeaderboardPage(container, leagueId) {
  const { user } = getState();
  if (!user) {
    container.innerHTML = `
      <div class="page active" id="page-leaderboard">
        <div class="card">
          <div class="card-title">Leaderboard</div>
          <p style="color:var(--text-muted)">Sign in to view the leaderboard.</p>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="page active" id="page-leaderboard">
      <div class="card">
        <div class="card-title" id="leaderboard-title">Leaderboard</div>
        <div id="leaderboard-content"><p style="color:var(--text-muted)">Loading…</p></div>
      </div>
    </div>
  `;

  try {
    let leaderboard, createdBy;

    if (leagueId) {
      const data = await api.getLeagueLeaderboard(leagueId);
      leaderboard = data.leaderboard;
      createdBy = data.createdBy;
      document.getElementById('leaderboard-title').textContent = data.leagueName || 'League Leaderboard';
    } else {
      leaderboard = await api.getLeaderboard();
      document.getElementById('leaderboard-title').textContent = 'Global Leaderboard';
    }

    renderTable(leaderboard, { leagueId, createdBy });
  } catch (err) {
    document.getElementById('leaderboard-content').innerHTML =
      `<p style="color:#f44336">Failed to load leaderboard: ${err.message}</p>`;
  }
}

function renderTable(leaderboard, { leagueId, createdBy } = {}) {
  const el = document.getElementById('leaderboard-content');
  if (!el) return;

  const { user, locked } = getState();
  const isCreator = leagueId && user && createdBy === user.userId;

  if (!leaderboard.length) {
    el.innerHTML = '<p style="color:var(--text-muted)">No members yet.</p>';
    if (leagueId) el.innerHTML += backToLeaguesLink();
    return;
  }

  el.innerHTML = `
    ${leagueId ? backToLeaguesLink() : ''}
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
          ${isCreator ? '<th></th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${leaderboard.map((row, i) => {
          const classes = [];
          if (user?.userId === row.userId) classes.push('current-user-row');
          if (locked) classes.push('lb-clickable');
          const name = escapeHtml(row.displayName || row.userId);
          let kickCell = '';
          if (isCreator && row.userId !== user.userId) {
            kickCell = `<td><button class="btn-icon kick-btn" data-user-id="${row.userId}" data-name="${name}" title="Remove member"><i class="fa-solid fa-user-xmark"></i></button></td>`;
          } else if (isCreator) {
            kickCell = '<td></td>';
          }
          return `
          <tr ${classes.length ? `class="${classes.join(' ')}"` : ''} ${locked ? `data-user-id="${row.userId}"` : ''}>
            <td class="rank-num">${i + 1}</td>
            <td>${name}</td>
            <td class="points-total">${row.totalPoints}</td>
            <td class="points-max">${row.maxPossiblePoints ?? '—'}</td>
            <td>${row.groupPoints}</td>
            <td>${row.thirdPlacePoints}</td>
            <td>${row.knockoutPoints}</td>
            ${kickCell}
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;

  // Click row → view picks (if locked)
  if (locked) {
    el.querySelectorAll('tr[data-user-id]').forEach(row => {
      row.style.cursor = 'pointer';
      row.addEventListener('click', (e) => {
        if (e.target.closest('.kick-btn')) return;
        const userId = row.dataset.userId;
        history.pushState(null, '', `/view-picks/${userId}`);
        dispatchEvent(new PopStateEvent('popstate'));
      });
    });
  }

  // Kick member handlers
  if (isCreator) {
    el.querySelectorAll('.kick-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const memberId = btn.dataset.userId;
        const name = btn.dataset.name;
        if (!confirm(`Remove ${name} from this league?`)) return;
        try {
          await api.kickMember(leagueId, memberId);
          // Re-render the page
          const container = document.getElementById('page-leaderboard').parentElement;
          await renderLeaderboardPage(container, leagueId);
        } catch (err) {
          alert(`Error: ${err.message}`);
        }
      });
    });
  }
}

function backToLeaguesLink() {
  return '<p style="margin-bottom:1rem"><a href="/leagues" style="color:var(--accent)"><i class="fa-solid fa-arrow-left"></i> Back to Leagues</a></p>';
}
