// pages/groups.js — Group stage picks page

import { getState, setState } from '../state.js';
import { renderGroupRanking } from '../components/group-ranking.js';
import { checkAuthPrompt } from '../auth-prompt.js';

export function renderGroupsPage(container) {
  const { locked } = getState();

  container.innerHTML = `
    <div class="page active" id="page-groups">
      ${locked ? '<div class="lock-banner">🔒 Picks are locked</div>' : ''}
      <div class="groups-grid" id="groups-grid"></div>
    </div>
  `;

  const grid = document.getElementById('groups-grid');
  if (!grid) return;

  function refresh() {
    const { picks: p, locked: l, results: r } = getState();
    renderGroupRanking(grid, {
      groupPicks: p?.groupPicks ?? {},
      thirdPlaceAdvancing: p?.thirdPlaceAdvancing ?? [],
      locked: l,
      results: r,
      onGroupPickChange: (newGroupPicks) => {
        const { picks } = getState();
        setState({ picks: { ...(picks ?? {}), groupPicks: newGroupPicks } });
        refresh();
        checkAuthPrompt();
      },
      onThirdPlaceChange: (newThirdPlace) => {
        const { picks } = getState();
        setState({ picks: { ...(picks ?? {}), thirdPlaceAdvancing: newThirdPlace } });
        refresh();
        checkAuthPrompt();
      },
    });
  }

  refresh();
}
