// pages/view-picks.js — View another user's locked picks (read-only)

import { api } from '../api.js';
import { getState } from '../state.js';
import { escapeHtml } from '../utils.js';
import { renderGroupRanking } from '../components/group-ranking.js';
import { renderBracketContent } from './bracket.js';

export async function renderViewPicksPage(container, userId) {
  container.innerHTML = `
    <div class="page active" id="page-view-picks">
      <div class="card" style="margin-bottom:.75rem">
        <div class="card-title">
          Picks for <span id="view-user-name">…</span>
          <span id="view-user-score" class="view-picks-score"></span>
        </div>
      </div>
      <div class="slide-tabs" id="viewpicks-tabs">
        <button class="active" data-tab="groups">Groups</button>
        <button data-tab="bracket">Bracket</button>
      </div>
      <div id="viewpicks-loading" style="padding:1rem;color:var(--text-muted)">Loading…</div>
      <div class="groups-grid" id="view-picks-groups" style="display:none;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));max-width:660px"></div>
      <div id="bracket-content" style="display:none"></div>
    </div>
  `;

  // Tab switching
  document.getElementById('viewpicks-tabs').querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#viewpicks-tabs button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.getElementById('view-picks-groups').style.display = tab === 'groups' ? '' : 'none';
      document.getElementById('bracket-content').style.display = tab === 'bracket' ? '' : 'none';
    });
  });

  try {
    const [picks, user, results] = await Promise.all([
      api.getUserPicks(userId),
      api.getUser(userId).catch(() => ({ displayName: userId })),
      api.getResults().catch(() => getState().results ?? {}),
    ]);

    document.getElementById('view-user-name').textContent = escapeHtml(user?.displayName || userId);

    const scoreEl = document.getElementById('view-user-score');
    if (scoreEl && picks.score) {
      scoreEl.textContent = `— ${picks.score.totalPoints} pts (${picks.score.maxPossiblePoints} possible)`;
    }

    document.getElementById('viewpicks-loading')?.remove();

    // Groups tab (shown by default) — locked=true enables result coloring, disables interaction
    const groupsEl = document.getElementById('view-picks-groups');
    groupsEl.style.display = '';
    renderGroupRanking(groupsEl, {
      groupPicks: picks.groupPicks ?? {},
      thirdPlaceAdvancing: picks.thirdPlaceAdvancing ?? [],
      locked: true,
      results,
      onGroupPickChange: null,
      onThirdPlaceChange: null,
    });

    // Bracket tab (pre-rendered while hidden) — locked=true enables result coloring
    renderBracketContent({ picksData: picks, lockedData: true, resultsData: results });
    document.getElementById('bracket-content').style.display = 'none';
  } catch (err) {
    const loading = document.getElementById('viewpicks-loading');
    if (loading) loading.innerHTML = `<p style="color:#f44336">Failed to load picks: ${escapeHtml(err.message)}</p>`;
  }
}

