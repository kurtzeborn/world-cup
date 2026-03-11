// pages/groups.js — Group stage picks page

import { getState, setState } from '../state.js';
import { renderGroupRanking } from '../components/group-ranking.js';
import { checkAuthPrompt } from '../auth-prompt.js';

export function renderGroupsPage(container) {
  const { locked } = getState();

  container.innerHTML = `
    <div class="page active" id="page-groups">
      ${locked ? '<div class="lock-banner locked">🔒 Picks are locked — the deadline has passed</div>' : ''}
      <div class="groups-grid" id="groups-grid"></div>
    </div>
  `;

  const grid = document.getElementById('groups-grid');
  if (!grid) return;

  function refresh() {
    const { picks: p, locked: l } = getState();
    renderGroupRanking(grid, {
      groupPicks: p?.groupPicks ?? {},
      thirdPlaceAdvancing: p?.thirdPlaceAdvancing ?? [],
      locked: l,
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
