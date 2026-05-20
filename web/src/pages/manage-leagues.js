// pages/manage-leagues.js — Admin page for managing all leagues

import { api } from '../api.js';
import { escapeHtml } from '../utils.js';

let allLeagues = [];

export async function renderManageLeaguesPage(container) {
  container.innerHTML = `
    <div class="page active" id="page-manage-leagues">
      <div class="card">
        <div class="card-title">Manage Leagues</div>
        <div id="manage-leagues-content">Loading…</div>
      </div>
    </div>
  `;

  await loadAllLeagues();
}

async function loadAllLeagues() {
  const el = document.getElementById('manage-leagues-content');
  if (!el) return;
  try {
    allLeagues = await api.getAdminLeagues();

    if (!allLeagues.length) {
      el.innerHTML = '<p style="color:var(--text-muted)">No leagues have been created yet.</p>';
      return;
    }

    renderLeagueList(el);
  } catch (err) {
    el.innerHTML = `<p style="color:#f44336">Error loading leagues: ${escapeHtml(err.message)}</p>`;
  }
}

function renderLeagueList(el) {
  const html = allLeagues.map(league => {
    const memberRows = league.members.map(m => `
      <tr>
        <td style="padding:.3rem .5rem; border-bottom:1px solid var(--border); font-size:.85rem">${escapeHtml(m.displayName || m.email || '—')}</td>
        <td style="padding:.3rem .5rem; border-bottom:1px solid var(--border); font-size:.85rem; color:var(--text-muted)">
          ${m.email ? escapeHtml(m.email) : '—'}
          ${m.authProvider === 'aad' ? '<span title="Microsoft" style="margin-left:.3rem">🪟</span>' : m.authProvider === 'google' ? '<span title="Google" style="margin-left:.3rem">🔵</span>' : ''}
        </td>
        <td style="padding:.3rem .5rem; border-bottom:1px solid var(--border); font-size:.85rem; color:var(--text-muted); white-space:nowrap">${m.joinedAt ? new Date(m.joinedAt).toLocaleDateString() : '—'}</td>
        <td style="padding:.3rem .5rem; border-bottom:1px solid var(--border); text-align:right">
          <button class="btn btn-danger btn-sm kick-member-btn"
            data-league-id="${escapeHtml(league.leagueId)}"
            data-league-name="${escapeHtml(league.name)}"
            data-member-id="${escapeHtml(m.userId)}"
            style="font-size:.75rem; padding:.2rem .4rem">Remove</button>
        </td>
      </tr>
    `).join('');

    return `
      <div class="card manage-league-card" data-league-id="${escapeHtml(league.leagueId)}" style="margin-bottom:.75rem">
        <div style="display:flex; justify-content:space-between; align-items:center; gap:.75rem; flex-wrap:wrap">
          <div style="flex:1; min-width:0">
            <strong>${escapeHtml(league.name)}</strong>
            <span style="font-size:.8rem; color:var(--text-muted); margin-left:.5rem">Code: <code>${escapeHtml(league.joinCode)}</code></span>
          </div>
          <div style="display:flex; align-items:center; gap:.5rem; flex-shrink:0">
            <span style="font-size:.85rem; color:var(--text-muted)"><i class="fa-solid fa-users"></i> ${league.memberCount}</span>
            <button class="btn btn-danger btn-sm delete-league-btn"
              data-league-id="${escapeHtml(league.leagueId)}"
              data-league-name="${escapeHtml(league.name)}"
              style="font-size:.8rem; padding:.25rem .5rem">Delete</button>
          </div>
        </div>
        <div style="font-size:.8rem; color:var(--text-muted); margin-top:.3rem">
          Created by: ${escapeHtml(league.creatorName || league.createdBy)}
          ${league.createdAt ? `· ${new Date(league.createdAt).toLocaleDateString()}` : ''}
        </div>
        ${league.members.length > 0 ? `
          <details style="margin-top:.6rem">
            <summary style="font-size:.85rem; cursor:pointer; color:var(--text-muted)">Members (${league.members.length})</summary>
            <table style="width:100%; border-collapse:collapse; margin-top:.4rem">
              <thead><tr>
                <th style="text-align:left; padding:.3rem .5rem; font-size:.8rem; color:var(--text-muted); border-bottom:1px solid var(--border)">Name</th>
                <th style="text-align:left; padding:.3rem .5rem; font-size:.8rem; color:var(--text-muted); border-bottom:1px solid var(--border)">Email</th>
                <th style="text-align:left; padding:.3rem .5rem; font-size:.8rem; color:var(--text-muted); border-bottom:1px solid var(--border)">Joined</th>
                <th></th>
              </tr></thead>
              <tbody>${memberRows}</tbody>
            </table>
          </details>
        ` : `<div style="font-size:.8rem; color:var(--text-muted); margin-top:.4rem; font-style:italic">No members</div>`}
      </div>
    `;
  }).join('');

  el.innerHTML = `
    <p style="font-size:.85rem; color:var(--text-muted); margin-bottom:1rem">${allLeagues.length} league${allLeagues.length !== 1 ? 's' : ''} total</p>
    <div id="leagues-list">${html}</div>
  `;

  el.querySelectorAll('.delete-league-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteLeague(btn.dataset.leagueId, btn.dataset.leagueName));
  });

  el.querySelectorAll('.kick-member-btn').forEach(btn => {
    btn.addEventListener('click', () => kickMember(btn.dataset.leagueId, btn.dataset.leagueName, btn.dataset.memberId));
  });
}

async function deleteLeague(leagueId, leagueName) {
  if (!confirm(`Delete league "${leagueName}" and remove all its members? This cannot be undone.`)) return;
  try {
    await api.adminDeleteLeague(leagueId);
    allLeagues = allLeagues.filter(l => l.leagueId !== leagueId);
    const el = document.getElementById('manage-leagues-content');
    if (el) renderLeagueList(el);
  } catch (err) {
    alert(`Error deleting league: ${err.message}`);
  }
}

async function kickMember(leagueId, leagueName, memberId) {
  if (!confirm(`Remove member "${memberId}" from "${leagueName}"?`)) return;
  try {
    await api.adminKickLeagueMember(leagueId, memberId);
    const league = allLeagues.find(l => l.leagueId === leagueId);
    if (league) {
      league.members = league.members.filter(m => m.userId !== memberId);
      league.memberCount = league.members.length;
    }
    const el = document.getElementById('manage-leagues-content');
    if (el) renderLeagueList(el);
  } catch (err) {
    alert(`Error removing member: ${err.message}`);
  }
}
