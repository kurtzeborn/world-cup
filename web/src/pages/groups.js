// pages/groups.js — Group stage picks page

import { getState, setState } from '../state.js';
import { api } from '../api.js';
import { TEAMS } from '../data/teams.js';

const GROUP_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L'];

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
      <div class="groups-grid" id="groups-grid"></div>

      <div class="third-place-section card" id="third-place-section">
        <div class="card-title">Third-Place Teams Advancing (pick 8 of 12 groups)</div>
        <p style="font-size:.85rem;color:var(--text-muted);margin-bottom:.75rem">
          Select the 8 groups whose third-place team advances to the Round of 32.
        </p>
        <div class="third-place-groups" id="third-place-groups"></div>
        <p id="third-place-count" style="margin-top:.5rem;font-size:.85rem"></p>
      </div>

      ${!locked ? `<div style="margin-top:1rem;display:flex;gap:.75rem;align-items:center">
        <button class="btn btn-primary" id="save-picks-btn">Save Picks</button>
        <button class="btn btn-secondary" id="lock-picks-btn">Lock &amp; Submit</button>
        <span id="save-status" style="font-size:.85rem;color:var(--text-muted)"></span>
      </div>` : ''}
    </div>
  `;

  renderGroupGrid(byGroup, groupPicks, locked);
  renderThirdPlaceSelector(thirdPlaceAdvancing, locked);

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
              const cls = pos === 0 ? 'selected-1st' : pos === 1 ? 'selected-2nd' : '';
              const badge = pos === 0
                ? `<span class="rank-badge rank-1">1</span>`
                : pos === 1
                  ? `<span class="rank-badge rank-2">2</span>`
                  : '';
              return `<tr class="team-row ${cls}" data-group="${letter}" data-team="${team.id}" ${locked ? '' : 'title="Click to select as 1st/2nd"'}>
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
    // Deselect
    selected.splice(idx, 1);
  } else if (selected.length < 2) {
    selected.push(teamId);
  } else {
    // Replace last selection
    selected[1] = teamId;
  }

  groupPicks[group] = selected;
  setState({ picks: { ...(picks ?? {}), groupPicks } });

  // Re-render just the group grid portion
  const byGroup = {};
  for (const letter of GROUP_LETTERS) byGroup[letter] = [];
  for (const team of TEAMS) {
    if (byGroup[team.group]) byGroup[team.group].push(team);
  }
  for (const letter of GROUP_LETTERS) {
    byGroup[letter].sort((a, b) => a.groupSeed - b.groupSeed);
  }
  renderGroupGrid(byGroup, groupPicks, false);
}

function renderThirdPlaceSelector(thirdPlaceAdvancing, locked) {
  const container = document.getElementById('third-place-groups');
  if (!container) return;

  container.innerHTML = GROUP_LETTERS.map(letter => {
    const sel = thirdPlaceAdvancing.includes(letter);
    const cnt = thirdPlaceAdvancing.length;
    const canAdd = cnt < 8 || sel;
    return `<button class="group-btn ${sel ? 'selected' : ''}" data-group="${letter}"
      ${locked || (!canAdd && !sel) ? 'disabled' : ''}>
      Group ${letter}
    </button>`;
  }).join('');

  updateThirdPlaceCount(thirdPlaceAdvancing.length);

  if (!locked) {
    container.querySelectorAll('.group-btn').forEach(btn => {
      btn.addEventListener('click', () => toggleThirdPlace(btn.dataset.group));
    });
  }
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
  renderThirdPlaceSelector(next, false);
}

function updateThirdPlaceCount(count) {
  const el = document.getElementById('third-place-count');
  if (el) el.textContent = `${count} / 8 selected`;
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
  const missingGroups = GROUP_LETTERS.filter(g => (groupPicks[g]?.length ?? 0) < 2);
  if (missingGroups.length > 0) {
    alert(`Please pick 2 teams to advance from groups: ${missingGroups.join(', ')}`);
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
