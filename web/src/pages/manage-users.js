// pages/manage-users.js — Admin page for managing users and their picks

import { api } from '../api.js';

let allUsers = [];

export async function renderManageUsersPage(container) {
  container.innerHTML = `
    <div class="page active" id="page-manage-users">
      <div class="card">
        <div class="card-title">Manage Users</div>
        <div id="manage-users-content">Loading…</div>
      </div>
    </div>
  `;

  const contentEl = document.getElementById('manage-users-content');
  if (!contentEl) return;

  try {
    allUsers = await api.getAdminUsers();

    if (!allUsers || allUsers.length === 0) {
      contentEl.innerHTML = '<p style="color:var(--text-muted)">No users with picks found.</p>';
      return;
    }

    contentEl.innerHTML = `
      <div class="manage-users-toolbar" style="margin-bottom:1rem; display:flex; align-items:center; gap:.75rem; flex-wrap:wrap;">
        <input type="text" id="user-search" placeholder="Search by name…"
          style="flex:1; min-width:200px; padding:.4rem .6rem; border:1px solid var(--border); border-radius:6px; background:var(--bg-card); color:var(--text);" />
        <span id="user-count" style="font-size:.85rem; color:var(--text-muted);"></span>
      </div>
      <div id="users-table-wrap"></div>
    `;

    renderFilteredTable('');

    document.getElementById('user-search').addEventListener('input', (e) => {
      renderFilteredTable(e.target.value);
    });
  } catch (err) {
    contentEl.innerHTML = `<p style="color:#f44336">Error loading users: ${err.message}</p>`;
  }
}

function renderFilteredTable(query) {
  const wrap = document.getElementById('users-table-wrap');
  if (!wrap) return;

  const q = query.toLowerCase().trim();
  const filtered = q
    ? allUsers.filter(u => u.displayName.toLowerCase().includes(q) || (u.email && u.email.toLowerCase().includes(q)))
    : allUsers;

  document.getElementById('user-count').textContent =
    q ? `${filtered.length} of ${allUsers.length} users` : `${allUsers.length} users`;

  if (filtered.length === 0) {
    wrap.innerHTML = '<p style="color:var(--text-muted); margin-top:.5rem;">No matching users.</p>';
    return;
  }

  let html = `<table style="width:100%; border-collapse:collapse; font-size:.9rem;">
    <thead><tr>
      <th style="text-align:left; padding:.5rem; border-bottom:1px solid var(--border)">User</th>
      <th style="text-align:left; padding:.5rem; border-bottom:1px solid var(--border)">Locked</th>
      <th style="text-align:right; padding:.5rem; border-bottom:1px solid var(--border)">Actions</th>
    </tr></thead><tbody>`;

  for (const u of filtered) {
    html += `<tr data-user-id="${escapeHtml(u.userId)}">
        <td style="padding:.5rem; border-bottom:1px solid var(--border)">${escapeHtml(u.displayName)}${u.email ? ` <span style="color:var(--text-muted)">(${escapeHtml(u.email)})</span>` : ''}</td>
      <td style="padding:.5rem; border-bottom:1px solid var(--border)">${u.isLocked ? 'Yes' : 'No'}</td>
      <td style="padding:.5rem; border-bottom:1px solid var(--border); text-align:right">
        <button class="btn btn-danger btn-sm admin-delete-user" data-user-id="${escapeHtml(u.userId)}" data-display-name="${escapeHtml(u.displayName)}" style="font-size:.8rem; padding:.25rem .5rem;">Delete Picks</button>
      </td>
    </tr>`;
  }

  html += '</tbody></table>';
  wrap.innerHTML = html;

  wrap.querySelectorAll('.admin-delete-user').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = btn.dataset.userId;
      const name = btn.dataset.displayName;
      if (!confirm(`Delete all picks for "${name}"? This cannot be undone.`)) return;

      btn.disabled = true;
      btn.textContent = 'Deleting…';
      try {
        await api.deleteUserPicks(userId);
        // Remove from allUsers array and re-render
        allUsers = allUsers.filter(u => u.userId !== userId);
        renderFilteredTable(document.getElementById('user-search')?.value || '');
      } catch (err) {
        alert(`Error deleting picks: ${err.message}`);
        btn.disabled = false;
        btn.textContent = 'Delete Picks';
      }
    });
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
