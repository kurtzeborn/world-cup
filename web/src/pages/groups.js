// pages/groups.js — Group stage picks page

import { getState, setState } from '../state.js';
import { api } from '../api.js';
import { TEAMS_BY_GROUP, GROUP_LETTERS } from '../data/teams.js';
import { getFlag, FIFA_RANKINGS_URL, savePicksToServer } from '../utils.js';

const MAX_THIRD_ADVANCING = 8;

/** Build a copy of teams-by-group (safe to reference without mutation). */
function getByGroup() {
  const byGroup = {};
  for (const letter of GROUP_LETTERS) {
    byGroup[letter] = [...(TEAMS_BY_GROUP[letter] ?? [])];
  }
  return byGroup;
}

export function renderGroupsPage(container) {
  const { picks, locked } = getState();
  const groupPicks = picks?.groupPicks ?? {};
  const thirdPlaceAdvancing = picks?.thirdPlaceAdvancing ?? [];

  // Group teams by group letter (use pre-sorted data)
  const byGroup = getByGroup();

  container.innerHTML = `
    <div class="page active" id="page-groups">
      ${locked ? '<div class="lock-banner locked">🔒 Picks are locked</div>' : ''}
      <div class="groups-grid" id="groups-grid"></div>

      ${!locked ? `<div class="groups-actions">
        <button class="btn btn-primary" id="save-picks-btn">Save Picks</button>
        <button class="btn btn-secondary" id="lock-picks-btn">Lock &amp; Submit</button>
        <span id="save-status" style="font-size:.85rem;color:var(--text-muted)"></span>
      </div>` : ''}
    </div>
  `;

  renderGroupGrid(byGroup, groupPicks, thirdPlaceAdvancing, locked);

  if (!locked) {
    document.getElementById('save-picks-btn').addEventListener('click', savePicks);
    document.getElementById('lock-picks-btn').addEventListener('click', lockPicks);
  }
}

function renderGroupGrid(byGroup, groupPicks, thirdPlaceAdvancing, locked) {
  const grid = document.getElementById('groups-grid');
  if (!grid) return;

  grid.innerHTML = GROUP_LETTERS.map(letter => {
    const teams = byGroup[letter];
    const selected = groupPicks[letter] ?? [];
    const thirdAdvances = thirdPlaceAdvancing.includes(letter);
    const thirdPlaceCount = thirdPlaceAdvancing.length;
    return `
      <div class="card group-card">
        <div class="card-title">Group ${letter}</div>
        <table class="group-table">
          <thead><tr><th>Team</th><th></th></tr></thead>
          <tbody>
            ${teams.map(team => {
              const pos = selected.indexOf(team.id);
              const posClasses = ['selected-1st','selected-2nd','selected-3rd','selected-4th'];
              const cls = pos >= 0 && pos < 4 ? posClasses[pos] : '';
              const badge = pos >= 0
                ? `<span class="rank-badge rank-${pos + 1}">${pos + 1}</span>`
                : '';
              const fifaRank = team.confirmed
                ? `<a href="${FIFA_RANKINGS_URL}" target="_blank" rel="noopener" class="fifa-rank" title="FIFA Ranking #${team.fifaRanking}">${team.fifaRanking}</a>`
                : '';
              // Show advance indicators based on position
              let advanceHtml = '';
              if (pos === 0 || pos === 1) {
                advanceHtml = '<span class="advance-auto">Advances</span>';
              } else if (pos === 2) {
                advanceHtml = `<label class="advance-toggle" title="Advances to Round of 32">
                     <input type="checkbox" class="advance-cb" data-group="${letter}"
                       ${thirdAdvances ? 'checked' : ''}
                       ${locked ? 'disabled' : ''}
                       ${!thirdAdvances && thirdPlaceCount >= MAX_THIRD_ADVANCING ? 'disabled' : ''}>
                     <span class="advance-label">Advance?</span>
                   </label>`;
              }
              return `<tr class="team-row ${cls}" data-group="${letter}" data-team="${team.id}" ${locked ? '' : 'title="Click to rank 1st\u20134th"'}>
                <td>${getFlag(team.flagCode)} ${team.name} ${fifaRank}</td>
                <td class="rank-cell">${advanceHtml}${badge}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }).join('');

  if (!locked) {
    grid.querySelectorAll('.team-row').forEach(row => {
      row.addEventListener('click', (e) => {
        // Don't trigger rank toggle when clicking the advance checkbox or FIFA rank link
        if (e.target.closest('.advance-toggle') || e.target.closest('.fifa-rank')) return;
        const group = row.dataset.group;
        const teamId = row.dataset.team;
        toggleGroupPick(group, teamId);
      });
    });

    grid.querySelectorAll('.advance-cb').forEach(cb => {
      cb.addEventListener('change', (e) => {
        e.stopPropagation();
        toggleThirdPlace(cb.dataset.group);
      });
    });
  }
}

function toggleGroupPick(group, teamId) {
  const { picks } = getState();
  const groupPicks = { ...(picks?.groupPicks ?? {}) };
  const selected = [...(groupPicks[group] ?? [])];

  const idx = selected.indexOf(teamId);
  if (idx !== -1) {
    // Deselect — remove and shift later teams up
    selected.splice(idx, 1);
  } else if (selected.length < 4) {
    // Add as next rank
    selected.push(teamId);
  }
  // If already 4 ranked, must deselect one first

  groupPicks[group] = selected;
  setState({ picks: { ...(picks ?? {}), groupPicks } });

  const { picks: updatedPicks } = getState();
  renderGroupGrid(getByGroup(), groupPicks, updatedPicks?.thirdPlaceAdvancing ?? [], false);
}

function toggleThirdPlace(letter) {
  const { picks } = getState();
  const prev = [...(picks?.thirdPlaceAdvancing ?? [])];
  const idx = prev.indexOf(letter);
  let next;
  if (idx !== -1) {
    next = prev.filter(l => l !== letter);
  } else if (prev.length < MAX_THIRD_ADVANCING) {
    next = [...prev, letter];
  } else {
    return; // already at max
  }
  setState({ picks: { ...(picks ?? {}), thirdPlaceAdvancing: next } });

  // Re-render grid to update checkboxes
  const groupPicks = picks?.groupPicks ?? {};
  renderGroupGrid(getByGroup(), groupPicks, next, false);
}

async function savePicks() {
  await savePicksToServer(document.getElementById('save-status'));
}

async function lockPicks() {
  const { picks } = getState();
  const groupPicks = picks?.groupPicks ?? {};
  const thirdPlace = picks?.thirdPlaceAdvancing ?? [];

  // Basic validation
  const missingGroups = GROUP_LETTERS.filter(g => (groupPicks[g]?.length ?? 0) < 4);
  if (missingGroups.length > 0) {
    alert(`Please rank all 4 teams in groups: ${missingGroups.join(', ')}`);
    return;
  }
  if (thirdPlace.length !== MAX_THIRD_ADVANCING) {
    alert(`Please select exactly ${MAX_THIRD_ADVANCING} third-place groups to advance.`);
    return;
  }

  if (!confirm('Lock your picks? This cannot be undone.')) return;

  try {
    await savePicks();
    const result = await api.lockPicks();
    setState({ picks: { ...picks, lockedAt: result.lockedAt }, locked: true });
    alert('Your picks are locked! ✓');
    location.reload();
  } catch (err) {
    alert(`Error locking picks: ${err.message}`);
  }
}
