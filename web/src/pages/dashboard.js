// pages/dashboard.js — Post-lock dashboard showing own picks vs results

import { api } from '../api.js';
import { escapeHtml } from '../utils.js';
import { renderGroupRanking } from '../components/group-ranking.js';
import { renderBracketContent } from './bracket.js';

export async function renderDashboardPage(container) {
  container.innerHTML = `
    <div class="page active" id="page-dashboard">
      <div class="card" style="margin-bottom:.75rem">
        <div class="card-title">My Picks</div>
      </div>
      <div class="slide-tabs" id="dashboard-tabs">
        <button class="active" data-tab="groups">Groups</button>
        <button data-tab="bracket">Bracket</button>
      </div>
      <div id="dashboard-loading" style="padding:1rem;color:var(--text-muted)">Loading…</div>
      <div class="groups-grid" id="dashboard-groups" style="display:none;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));max-width:660px"></div>
      <div id="bracket-content" style="display:none"></div>
    </div>
  `;

  document.getElementById('dashboard-tabs').querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#dashboard-tabs button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById('dashboard-groups').style.display = tab === 'groups' ? '' : 'none';
      document.getElementById('bracket-content').style.display = tab === 'bracket' ? '' : 'none';
    });
  });

  try {
    const [picks, results] = await Promise.all([
      api.getPicks().catch(() => null),
      api.getResults().catch(() => ({})),
    ]);

    if (!picks) {
      document.getElementById('dashboard-loading').innerHTML =
        '<p style="color:#f44336">No picks found.</p>';
      return;
    }

    document.getElementById('dashboard-loading')?.remove();

    const groupsEl = document.getElementById('dashboard-groups');
    groupsEl.style.display = '';
    renderGroupRanking(groupsEl, {
      groupPicks: picks.groupPicks ?? {},
      thirdPlaceAdvancing: picks.thirdPlaceAdvancing ?? [],
      locked: true,
      results,
      onGroupPickChange: null,
      onThirdPlaceChange: null,
    });

    renderBracketContent({ picksData: picks, lockedData: true, resultsData: results });
    document.getElementById('bracket-content').style.display = 'none';
  } catch (err) {
    const loading = document.getElementById('dashboard-loading');
    if (loading) loading.innerHTML = `<p style="color:#f44336">Error loading dashboard: ${escapeHtml(err.message)}</p>`;
  }
}