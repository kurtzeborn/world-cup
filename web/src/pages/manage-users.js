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
      <div class="admin-actions" style="margin-bottom:1rem;">
        <button type="button" class="btn btn-danger" id="btn-lock-all">Force Lock All Picks</button>
        <button type="button" class="btn btn-secondary" id="btn-unlock-all">Unlock All Picks</button>
        <div id="manage-users-status" style="font-size: .9rem;"></div>
      </div>
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

    document.getElementById('btn-lock-all').addEventListener('click', () => adminLockAll());
    document.getElementById('btn-unlock-all').addEventListener('click', () => adminUnlockAll());
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
      <th style="text-align:center; padding:.5rem; border-bottom:1px solid var(--border)">Locked</th>
      <th style="text-align:right; padding:.5rem; border-bottom:1px solid var(--border)">Actions</th>
    </tr></thead><tbody>`;

  for (const u of filtered) {
    const lockBtnClass = u.isLocked ? 'btn btn-secondary btn-sm' : 'btn btn-danger btn-sm';
    const lockBtnLabel = u.isLocked ? 'Unlock' : 'Lock';
    html += `<tr data-user-id="${escapeHtml(u.userId)}">
        <td style="padding:.5rem; border-bottom:1px solid var(--border)">${escapeHtml(u.displayName)}${u.email ? ` <span style="color:var(--text-muted)">(${escapeHtml(u.email)})</span>` : ''}</td>
      <td style="padding:.5rem; border-bottom:1px solid var(--border); text-align:center">
        <button class="${lockBtnClass} admin-toggle-lock" data-user-id="${escapeHtml(u.userId)}" data-display-name="${escapeHtml(u.displayName)}" data-locked="${u.isLocked}" style="font-size:.8rem; padding:.25rem .5rem; min-width:60px;">${lockBtnLabel}</button>
      </td>
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
        renderFilteredTable(getSearchQuery());
      } catch (err) {
        alert(`Error deleting picks: ${err.message}`);
        btn.disabled = false;
        btn.textContent = 'Delete Picks';
      }
    });
  });

  wrap.querySelectorAll('.admin-toggle-lock').forEach(btn => {
    btn.addEventListener('click', async () => {
      const userId = btn.dataset.userId;
      const name = btn.dataset.displayName;
      const isLocked = btn.dataset.locked === 'true';

      if (!confirm(`${isLocked ? 'Unlock' : 'Lock'} picks for "${name}"?`)) return;

      btn.disabled = true;
      btn.textContent = isLocked ? 'Unlocking…' : 'Locking…';
      try {
        await api.adminToggleUserLock(userId, !isLocked);
        const user = allUsers.find(u => u.userId === userId);
        if (user) user.isLocked = !isLocked;
        renderFilteredTable(getSearchQuery());
      } catch (err) {
        alert(`Error: ${err.message}`);
        btn.disabled = false;
        btn.textContent = isLocked ? 'Unlock' : 'Lock';
      }
    });
  });
}

function getSearchQuery() {
  return document.getElementById('user-search')?.value || '';
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

async function adminLockAll() {
  if (!confirm('Lock ALL users\u2019 picks now?')) return;

  const statusEl = document.getElementById('manage-users-status');
  const btn = document.getElementById('btn-lock-all');
  statusEl.innerHTML = '<p style="color:var(--text-muted)">Locking all picks…</p>';
  btn.disabled = true;

  try {
    const result = await api.adminLockAllPicks();
    statusEl.innerHTML = `<p style="color:#4caf50">✓ Locked ${result.locked} picks (${result.skipped} already locked)</p>`;
    allUsers.forEach(u => u.isLocked = true);
    renderFilteredTable(getSearchQuery());
  } catch (err) {
    statusEl.innerHTML = `<p style="color:#f44336">Error: ${err.message}</p>`;
  } finally {
    btn.disabled = false;
  }
}

async function adminUnlockAll() {
  if (!confirm('Unlock ALL users\u2019 picks? They will be able to edit their picks again.')) return;

  const statusEl = document.getElementById('manage-users-status');
  const btn = document.getElementById('btn-unlock-all');
  statusEl.innerHTML = '<p style="color:var(--text-muted)">Unlocking all picks…</p>';
  btn.disabled = true;

  try {
    const result = await api.adminUnlockAllPicks();
    statusEl.innerHTML = `<p style="color:#4caf50">✓ Unlocked ${result.unlocked} picks (${result.skipped} already unlocked)</p>`;
    allUsers.forEach(u => u.isLocked = false);
    renderFilteredTable(getSearchQuery());
  } catch (err) {
    statusEl.innerHTML = `<p style="color:#f44336">Error: ${err.message}</p>`;
  } finally {
    btn.disabled = false;
  }
}
