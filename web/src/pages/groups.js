// pages/groups.js — Group stage picks page

import { getState, setState } from '../state.js';
import { renderGroupRanking } from '../components/group-ranking.js';
import { checkAuthPrompt } from '../auth-prompt.js';
import { cascadeClearBracketPicks } from './bracket.js';

export function renderGroupsPage(container) {
  container.innerHTML = `
    <div class="page active" id="page-groups">
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
        const cleanedBracket = cascadeClearBracketPicks(
          newGroupPicks,
          picks?.thirdPlaceAdvancing ?? [],
          picks?.bracketPicks ?? {}
        );
        setState({ picks: { ...(picks ?? {}), groupPicks: newGroupPicks, bracketPicks: cleanedBracket } });
        refresh();
        checkAuthPrompt();
      },
      onThirdPlaceChange: (newThirdPlace) => {
        const { picks } = getState();
        const cleanedBracket = cascadeClearBracketPicks(
          picks?.groupPicks ?? {},
          newThirdPlace,
          picks?.bracketPicks ?? {}
        );
        setState({ picks: { ...(picks ?? {}), thirdPlaceAdvancing: newThirdPlace, bracketPicks: cleanedBracket } });
        refresh();
        checkAuthPrompt();
      },
    });
  }

  refresh();
}
