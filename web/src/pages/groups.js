// pages/groups.js — Group stage picks page

import { getState, setState } from '../state.js';
import { api } from '../api.js';
import { TEAMS } from '../data/teams.js';

const GROUP_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L'];

const FIFA_RANKINGS_URL = 'https://inside.fifa.com/fifa-world-ranking/men';

export function renderGroupsPage(container) {
  const { picks, locked } = getState();
  const groupPicks = picks?.groupPicks ?? {};
  const thirdPlaceAdvancing = picks?.thirdPlaceAdvancing ?? [];

  // Group teams by group letter
  const byGroup = {};
  for (const letter of GROUP_LETTERS) byGroup[letter] = [];
  for (const team of TEAMS) {
    if (byGroup[team.group]) byGroup[team.group].push(team);
  }
  for (const letter of GROUP_LETTERS) {
    byGroup[letter].sort((a, b) => a.groupSeed - b.groupSeed);
  }

  container.innerHTML = `
    <div class="page active" id="page-groups">
      ${locked ? '<div class="lock-banner locked">🔒 Picks are locked</div>' : ''}
      <p class="third-place-counter" id="third-place-counter" style="font-size:.85rem;color:var(--text-muted);margin-bottom:.75rem">
        Third-place teams advancing: <strong>${thirdPlaceAdvancing.length}</strong> / 8 selected
      </p>
      <div class="groups-grid" id="groups-grid"></div>

      ${!locked ? `<div style="margin-top:1rem;display:flex;gap:.75rem;align-items:center">
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

function renderGroupGrid(byGroup, groupPicks, locked) {
  const grid = document.getElementById('groups-grid');
  if (!grid) return;

  grid.innerHTML = GROUP_LETTERS.map(letter => {
    const teams = byGroup[letter];
    const selected = groupPicks[letter] ?? [];
    return `
      <div class="card group-card">
        <div class="card-title">Group ${letter}</div>
        <table class="group-table">
          <thead><tr><th>Team</th><th>FIFA Rank</th><th></th></tr></thead>
          <tbody>
            ${teams.map(team => {
              const pos = selected.indexOf(team.id);
              const posClasses = ['selected-1st','selected-2nd','selected-3rd','selected-4th'];
              const cls = pos >= 0 && pos < 4 ? posClasses[pos] : '';
              const badge = pos >= 0
                ? `<span class="rank-badge rank-${pos + 1}">${pos + 1}</span>`
                : '';
              return `<tr class="team-row ${cls}" data-group="${letter}" data-team="${team.id}" ${locked ? '' : 'title="Click to rank 1st–4th"'}>
                <td>${getFlag(team.flagCode)} ${team.name}</td>
                <td>${team.confirmed ? team.fifaRanking : '—'}</td>
                <td>${badge}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }).join('');

  if (!locked) {
    grid.querySelectorAll('.team-row').forEach(row => {
      row.addEventListener('click', () => {
        const group = row.dataset.group;
        const teamId = row.dataset.team;
        toggleGroupPick(group, teamId);
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

  // Re-render the group grid
  const byGroup = {};
  for (const letter of GROUP_LETTERS) byGroup[letter] = [];
  for (const team of TEAMS) {
    if (byGroup[team.group]) byGroup[team.group].push(team);
  }
  for (const letter of GROUP_LETTERS) {
    byGroup[letter].sort((a, b) => a.groupSeed - b.groupSeed);
  }
  const { picks: updatedPicks } = getState();
  renderGroupGrid(byGroup, groupPicks, updatedPicks?.thirdPlaceAdvancing ?? [], false);
}

function toggleThirdPlace(letter) {
  const { picks } = getState();
  const prev = [...(picks?.thirdPlaceAdvancing ?? [])];
  const idx = prev.indexOf(letter);
  let next;
  if (idx !== -1) {
    next = prev.filter(l => l !== letter);
  } else if (prev.length < 8) {
    next = [...prev, letter];
  } else {
    return; // already have 8
  }
  setState({ picks: { ...(picks ?? {}), thirdPlaceAdvancing: next } });

  // Update counter
  const counterEl = document.getElementById('third-place-counter');
  if (counterEl) {
    counterEl.innerHTML = `Third-place teams advancing: <strong>${next.length}</strong> / 8 selected`;
  }

  // Re-render grid to update checkboxes
  const groupPicks = picks?.groupPicks ?? {};
  const byGroup = {};
  for (const letter2 of GROUP_LETTERS) byGroup[letter2] = [];
  for (const team of TEAMS) {
    if (byGroup[team.group]) byGroup[team.group].push(team);
  }
  for (const letter2 of GROUP_LETTERS) {
    byGroup[letter2].sort((a, b) => a.groupSeed - b.groupSeed);
  }
  renderGroupGrid(byGroup, groupPicks, next, false);
}

async function savePicks() {
  const { picks } = getState();
  const statusEl = document.getElementById('save-status');
  try {
    statusEl.textContent = 'Saving…';
    await api.savePicks({
      groupPicks: picks?.groupPicks ?? {},
      thirdPlaceAdvancing: picks?.thirdPlaceAdvancing ?? [],
      bracketPicks: picks?.bracketPicks ?? {},
    });
    statusEl.textContent = '✓ Saved';
    setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
  }
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
  if (thirdPlace.length !== 8) {
    alert('Please select exactly 8 third-place groups to advance.');
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

function getFlag(flagCode) {
  if (!flagCode || flagCode === 'xx') return '<span class="flag flag-tbd">?</span>';
  return `<img class="flag" src="https://flagcdn.com/w40/${flagCode}.png" srcset="https://flagcdn.com/w80/${flagCode}.png 2x" alt="" width="20" height="15" loading="lazy">`;
}
