// components/group-ranking.js — Shared group ranking UI (user picks & admin results)

import { TEAMS_BY_GROUP, GROUP_LETTERS } from '../data/teams.js';
import { getFlag, FIFA_RANKINGS_URL } from '../utils.js';
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

/**
 * Render the group ranking grid into a container element.
 *
 * @param {HTMLElement} gridEl - Container to render into
 * @param {object} opts
 * @param {Record<string, string[]>} opts.groupPicks - { A: ['MEX','KOR',...], ... }
 * @param {string[]} opts.thirdPlaceAdvancing - Group letters whose 3rd-place advances
 * @param {boolean} opts.locked - Disable interaction
 * @param {(groupPicks: Record<string, string[]>) => void} opts.onGroupPickChange
 * @param {(thirdPlaceAdvancing: string[]) => void} opts.onThirdPlaceChange
 */
export function renderGroupRanking(gridEl, opts) {
  const { groupPicks, thirdPlaceAdvancing, locked, results, onGroupPickChange, onThirdPlaceChange } = opts;
  const byGroup = getByGroup();
  const groupStandings = results?.groupStandings ?? {};
  const advancing3rd = new Set(results?.advancing3rdPlace ?? []);

  gridEl.innerHTML = GROUP_LETTERS.map(letter => {
    const teams = byGroup[letter];
    const selected = groupPicks[letter] ?? [];
    const actual = groupStandings[letter] ?? [];
    const thirdAdvances = thirdPlaceAdvancing.includes(letter);
    const thirdPlaceCount = thirdPlaceAdvancing.length;
    const ordered = getDisplayOrder(teams, selected);

    return `
      <div class="card group-card" id="group-card-${letter}" data-group="${letter}">
        <div class="card-title">Group ${letter}</div>
        <table class="group-table">
          <tbody>
            ${ordered.map(team => {
              const pos = selected.indexOf(team.id);
              const posClasses = ['selected-1st','selected-2nd','selected-3rd','selected-4th'];
              const cls = pos >= 0 && pos < 4 ? posClasses[pos] : '';
              const resultCls = pos >= 0 && actual.length > 0 ? getGroupTeamStatus(team.id, pos, actual, advancing3rd) : '';
              const badge = pos >= 0
                ? `<span class="rank-badge rank-${pos + 1}">${pos + 1}</span>`
                : '';
              const fifaRank = team.confirmed
                ? `<a href="${FIFA_RANKINGS_URL}" target="_blank" rel="noopener" class="fifa-rank" title="FIFA Ranking #${team.fifaRanking}">${team.fifaRanking}</a>`
                : '';
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
              return `<tr class="team-row ${cls} ${resultCls}" data-group="${letter}" data-team="${team.id}" ${locked ? '' : 'title="Click to rank 1st\u20134th"'}>
                <td>${fifaRank}${getFlag(team.flagCode)} ${team.name}</td>
                <td class="rank-cell">${advanceHtml}${badge}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }).join('');

  if (locked) return;

  // Click-to-rank handler
  gridEl.querySelectorAll('.team-row').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.advance-toggle') || e.target.closest('.fifa-rank')) return;
      const group = row.dataset.group;
      const teamId = row.dataset.team;
      const teams = byGroup[group];

      const newGroupPicks = { ...groupPicks };
      let selected = [...(newGroupPicks[group] ?? [])];
      const idx = selected.indexOf(teamId);
      if (idx !== -1) {
        selected.splice(idx, 1);
      } else if (selected.length < 4) {
        selected.push(teamId);
      }
      // Auto-fill remaining unranked teams in current display order
      if (selected.length > 0 && selected.length < 4) {
        const currentOrder = getDisplayOrder(teams, selected);
        for (const t of currentOrder) {
          if (!selected.includes(t.id)) selected.push(t.id);
        }
      }
      newGroupPicks[group] = selected;
      onGroupPickChange(newGroupPicks);
    });
  });

  // Third-place advance checkbox handler
  gridEl.querySelectorAll('.advance-cb').forEach(cb => {
    cb.addEventListener('change', (e) => {
      e.stopPropagation();
      const letter = cb.dataset.group;
      const prev = [...thirdPlaceAdvancing];
      const idx = prev.indexOf(letter);
      let next;
      if (idx !== -1) {
        next = prev.filter(l => l !== letter);
      } else if (prev.length < MAX_THIRD_ADVANCING) {
        next = [...prev, letter];
      } else {
        return;
      }
      onThirdPlaceChange(next);
    });
  });

  // Desktop drag-and-drop on all groups
  if (!IS_DESKTOP) return;
  gridEl.querySelectorAll('.group-card').forEach(card => {
    const group = card.dataset.group;

    const tbody = card.querySelector('tbody');
    if (!tbody) return;

    Sortable.create(tbody, {
      animation: 150,
      ghostClass: 'sortable-ghost',
      chosenClass: 'sortable-chosen',
      onEnd: () => {
        const rows = [...tbody.querySelectorAll('.team-row')];
        const newOrder = rows.map(r => r.dataset.team);
        const newGroupPicks = { ...groupPicks };
        newGroupPicks[group] = newOrder;
        onGroupPickChange(newGroupPicks);
      },
    });
  });
}

function getGroupTeamStatus(teamId, pickedPos, actualOrder, advancing3rd) {
  const actualPos = actualOrder.indexOf(teamId);
  if (actualPos === -1) return 'result-incorrect';
  const has3rdData = advancing3rd.size > 0;
  // Exact position match
  if (actualPos === pickedPos) {
    // 1st/2nd always advance; 3rd only counts if team actually advanced
    if (pickedPos === 2 && has3rdData && !advancing3rd.has(teamId)) return 'result-incorrect';
    return 'result-correct';
  }
  // Both in top 2 but swapped
  if (pickedPos < 2 && actualPos < 2) return 'result-partial';
  // Picked top 2, actually 3rd but advanced (or vice versa) — team advances either way
  if (pickedPos < 2 && actualPos === 2 && (!has3rdData || advancing3rd.has(teamId))) return 'result-partial';
  if (pickedPos === 2 && actualPos < 2) return 'result-partial';
  return 'result-incorrect';
}
