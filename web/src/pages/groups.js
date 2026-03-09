// pages/groups.js — Group stage picks page

import { getState, setState } from '../state.js';
import { TEAMS_BY_GROUP, GROUP_LETTERS } from '../data/teams.js';
import { getFlag, FIFA_RANKINGS_URL } from '../utils.js';
import { checkAuthPrompt } from '../auth-prompt.js';
import Sortable from 'sortablejs';

const MAX_THIRD_ADVANCING = 8;
const IS_DESKTOP = window.matchMedia('(pointer: fine)').matches;

/** Build a copy of teams-by-group (safe to reference without mutation). */
function getByGroup() {
  const byGroup = {};
  for (const letter of GROUP_LETTERS) {
    byGroup[letter] = [...(TEAMS_BY_GROUP[letter] ?? [])];
  }
  return byGroup;
}

/** Return teams in display order: ranked first (rank order), then unranked (draw order). */
function getDisplayOrder(teams, selected) {
  const ranked = selected.map(id => teams.find(t => t.id === id)).filter(Boolean);
  const unranked = teams.filter(t => !selected.includes(t.id));
  return [...ranked, ...unranked];
}

export function renderGroupsPage(container) {
  const { picks, locked } = getState();
  const groupPicks = picks?.groupPicks ?? {};
  const thirdPlaceAdvancing = picks?.thirdPlaceAdvancing ?? [];

  const byGroup = getByGroup();

  container.innerHTML = `
    <div class="page active" id="page-groups">
      ${locked ? '<div class="lock-banner locked">🔒 Picks are locked — the deadline has passed</div>' : ''}
      <div class="groups-grid" id="groups-grid"></div>
    </div>
  `;

  renderGroupGrid(byGroup, groupPicks, thirdPlaceAdvancing, locked);
}

function renderGroupGrid(byGroup, groupPicks, thirdPlaceAdvancing, locked) {
  const grid = document.getElementById('groups-grid');
  if (!grid) return;

  grid.innerHTML = GROUP_LETTERS.map(letter => {
    const teams = byGroup[letter];
    const selected = groupPicks[letter] ?? [];
    const thirdAdvances = thirdPlaceAdvancing.includes(letter);
    const thirdPlaceCount = thirdPlaceAdvancing.length;
    const allRanked = selected.length >= 4;
    const showDrag = IS_DESKTOP && allRanked && !locked;

    // Display order: ranked teams first (in rank order), then unranked (draw order)
    const ordered = getDisplayOrder(teams, selected);

    return `
      <div class="card group-card" data-group="${letter}">
        <div class="card-title">Group ${letter}</div>
        <table class="group-table">
          <tbody>
            ${ordered.map(team => {
              const pos = selected.indexOf(team.id);
              const posClasses = ['selected-1st','selected-2nd','selected-3rd','selected-4th'];
              const cls = pos >= 0 && pos < 4 ? posClasses[pos] : '';
              const badge = pos >= 0
                ? `<span class="rank-badge rank-${pos + 1}">${pos + 1}</span>`
                : '';
              const fifaRank = team.confirmed
                ? `<a href="${FIFA_RANKINGS_URL}" target="_blank" rel="noopener" class="fifa-rank" title="FIFA Ranking #${team.fifaRanking}">${team.fifaRanking}</a>`
                : '';
              // Advance indicators based on position
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
              const dragHtml = showDrag
                ? '<i class="fa-solid fa-grip-vertical drag-handle"></i> '
                : '';
              return `<tr class="team-row ${cls}" data-group="${letter}" data-team="${team.id}" ${locked ? '' : 'title="Click to rank 1st\u20134th"'}>
                <td>${dragHtml}${getFlag(team.flagCode)} ${team.name} ${fifaRank}</td>
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
        // Don't trigger rank toggle when clicking the advance checkbox, FIFA rank, or drag handle
        if (e.target.closest('.advance-toggle') || e.target.closest('.fifa-rank') || e.target.closest('.drag-handle')) return;
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

    // Desktop drag-and-drop (only for fully-ranked groups)
    initDragAndDrop(grid, groupPicks);
  }
}

/** Initialize SortableJS on each fully-ranked group tbody (desktop only). */
function initDragAndDrop(grid, groupPicks) {
  if (!IS_DESKTOP) return;

  grid.querySelectorAll('.group-card').forEach(card => {
    const group = card.dataset.group;
    const selected = groupPicks[group] ?? [];
    if (selected.length < 4) return;

    const tbody = card.querySelector('tbody');
    if (!tbody) return;

    Sortable.create(tbody, {
      animation: 150,
      handle: '.drag-handle',
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      onEnd: () => {
        const rows = [...tbody.querySelectorAll('.team-row')];
        const newOrder = rows.map(r => r.dataset.team);

        const { picks } = getState();
        const gp = { ...(picks?.groupPicks ?? {}) };
        gp[group] = newOrder;
        setState({ picks: { ...(picks ?? {}), groupPicks: gp } });

        const updatedPicks = getState().picks;
        renderGroupGrid(getByGroup(), gp, updatedPicks?.thirdPlaceAdvancing ?? [], false);
        checkAuthPrompt();
      },
    });
  });
}

function toggleGroupPick(group, teamId) {
  const { picks } = getState();
  const groupPicks = { ...(picks?.groupPicks ?? {}) };
  const selected = [...(groupPicks[group] ?? [])];

  const idx = selected.indexOf(teamId);
  if (idx !== -1) {
    selected.splice(idx, 1);
  } else if (selected.length < 4) {
    selected.push(teamId);
  }

  groupPicks[group] = selected;
  setState({ picks: { ...(picks ?? {}), groupPicks } });

  const { picks: updatedPicks } = getState();
  renderGroupGrid(getByGroup(), groupPicks, updatedPicks?.thirdPlaceAdvancing ?? [], false);
  checkAuthPrompt();
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
    return;
  }
  setState({ picks: { ...(picks ?? {}), thirdPlaceAdvancing: next } });

  const groupPicks = picks?.groupPicks ?? {};
  renderGroupGrid(getByGroup(), groupPicks, next, false);
  checkAuthPrompt();
}
