// pages/view-picks.js — View another user's locked picks (read-only)

import { api } from '../api.js';
import { getState } from '../state.js';
import { escapeHtml } from '../utils.js';
import { renderGroupRanking } from '../components/group-ranking.js';
import { renderBracketContent } from './bracket.js';

export async function renderViewPicksPage(container, userId) {
  container.innerHTML = `
    <div class="page active" id="page-view-picks">
      <div class="card" style="margin-bottom:1rem">
        <div class="card-title">
          Picks for <span id="view-user-name">…</span>
          <span id="view-user-score" class="view-picks-score"></span>
        </div>
      </div>
      <div id="viewpicks-loading" style="padding:1rem;color:var(--text-muted)">Loading…</div>
      <div class="groups-grid" id="view-picks-groups" style="display:none"></div>
      <div id="bracket-content" style="display:none;margin-top:1rem"></div>
    </div>
  `;

  try {
    const [picks, user] = await Promise.all([
      api.getUserPicks(userId),
      api.getUser(userId).catch(() => ({ displayName: userId })),
    ]);

    document.getElementById('view-user-name').textContent = escapeHtml(user?.displayName || userId);

    const scoreEl = document.getElementById('view-user-score');
    if (scoreEl && picks.score) {
      scoreEl.textContent = `— ${picks.score.totalPoints} pts (${picks.score.maxPossiblePoints} possible)`;
    }

    document.getElementById('viewpicks-loading')?.remove();

    const { results } = getState();

    // Groups — reuse shared component; locked=true enables result coloring, disables interaction
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

    // Bracket — reuse bracket renderer with data overrides; locked=true enables result coloring
    const bracketEl = document.getElementById('bracket-content');
    bracketEl.style.display = '';
    renderBracketContent({ picksData: picks, lockedData: true, resultsData: results });
  } catch (err) {
    const loading = document.getElementById('viewpicks-loading');
    if (loading) loading.innerHTML = `<p style="color:#f44336">Failed to load picks: ${escapeHtml(err.message)}</p>`;
  }
}

