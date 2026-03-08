// pages/bracket.js — Knockout bracket picks page

import { getState, setState } from '../state.js';
import { api } from '../api.js';
import { BRACKET_STRUCTURE } from '../data/bracket-structure.js';
import { getThirdPlacePlacements } from '../data/third-place-table.js';

const ROUND_LABELS = {
  R32: 'Round of 32',
  R16: 'Round of 16',
  QF:  'Quarter-Finals',
  SF:  'Semi-Finals',
  TPM: 'Third-Place Match',
  F:   'Final',
};

export function renderBracketPage(container) {
  const { picks, locked, teams } = getState();
  const bracketPicks = picks?.bracketPicks ?? {};
  const groupPicks = picks?.groupPicks ?? {};
  const thirdPlaceAdvancing = picks?.thirdPlaceAdvancing ?? [];

  // Build team lookup
  const teamById = Object.fromEntries(teams.map(t => [t.id, t]));

  // Resolve who plays in each R32 match based on group picks + third-place table
  const matchTeams = resolveMatchTeams(groupPicks, thirdPlaceAdvancing, bracketPicks, teamById);

  const rounds = ['R32','R16','QF','SF','TPM','F'];

  container.innerHTML = `
    <div class="page active" id="page-bracket">
      ${locked ? '<div class="lock-banner locked">🔒 Picks are locked</div>' : ''}
      <p style="font-size:.85rem;color:var(--text-muted);margin-bottom:1rem">
        Pick the winner of each match. Matches unlock as you complete earlier rounds.
      </p>
      ${rounds.map(round => renderRound(round, bracketPicks, matchTeams, locked, teamById)).join('')}
      ${!locked ? `<div style="margin-top:1rem">
        <button class="btn btn-primary" id="save-bracket-btn">Save Bracket</button>
        <span id="bracket-save-status" style="margin-left:.5rem;font-size:.85rem;color:var(--text-muted)"></span>
      </div>` : ''}
    </div>
  `;

  if (!locked) {
    container.querySelectorAll('select.pick-select').forEach(sel => {
      sel.addEventListener('change', e => {
        const { matchId } = e.target.dataset;
        onBracketPick(matchId, e.target.value);
      });
    });
    document.getElementById('save-bracket-btn').addEventListener('click', saveBracket);
  }
}

function renderRound(round, bracketPicks, matchTeams, locked, teamById) {
  const matches = BRACKET_STRUCTURE.filter(m => m.round === round);
  if (!matches.length) return '';

  return `
    <div class="bracket-round card">
      <div class="card-title">${ROUND_LABELS[round]}</div>
      <div class="match-list">
        ${matches.map(m => renderMatch(m, bracketPicks, matchTeams, locked, teamById)).join('')}
      </div>
    </div>
  `;
}

function renderMatch(match, bracketPicks, matchTeams, locked, teamById) {
  const [slotA, slotB] = matchTeams[match.id] || [null, null];
  const picked = bracketPicks[`${match.round}_${match.id}`] ?? '';

  const getTeamLabel = (t) => t ? (teamById[t]?.name ?? t) : '?';

  if (locked) {
    return `
      <div class="match-card">
        <div class="match-id">M${match.id}</div>
        <div class="match-slot ${picked === slotA ? 'winner' : ''}">${getTeamLabel(slotA)}</div>
        <div class="match-slot ${picked === slotB ? 'winner' : ''}">${getTeamLabel(slotB)}</div>
        ${picked ? `<div style="font-size:.75rem;color:var(--text-muted)">Pick: ${getTeamLabel(picked)}</div>` : ''}
      </div>
    `;
  }

  const options = [slotA, slotB].filter(Boolean).map(t =>
    `<option value="${t}" ${picked === t ? 'selected' : ''}>${getTeamLabel(t)}</option>`
  ).join('');

  return `
    <div class="match-card">
      <div class="match-id">M${match.id}: ${getTeamLabel(slotA)} vs ${getTeamLabel(slotB)}</div>
      <select class="pick-select" data-match-id="${match.round}_${match.id}">
        <option value="">— pick winner —</option>
        ${options}
      </select>
    </div>
  `;
}

function onBracketPick(matchKey, winnerId) {
  const { picks } = getState();
  const bracketPicks = { ...(picks?.bracketPicks ?? {}), [matchKey]: winnerId };
  setState({ picks: { ...(picks ?? {}), bracketPicks } });
}

async function saveBracket() {
  const { picks } = getState();
  const statusEl = document.getElementById('bracket-save-status');
  try {
    if (statusEl) statusEl.textContent = 'Saving…';
    await api.savePicks({
      groupPicks: picks?.groupPicks ?? {},
      thirdPlaceAdvancing: picks?.thirdPlaceAdvancing ?? [],
      bracketPicks: picks?.bracketPicks ?? {},
    });
    if (statusEl) statusEl.textContent = '✓ Saved';
    setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 3000);
  } catch (err) {
    if (statusEl) statusEl.textContent = `Error: ${err.message}`;
  }
}

/**
 * Resolve which two teams play in each match based on current picks.
 * Returns { matchId: [teamA, teamB] }
 */
function resolveMatchTeams(groupPicks, thirdPlaceAdvancing, bracketPicks, teamById) {
  const result = {};

  // Determine 3rd-place slot assignments
  let thirdPlaceBySlot = {}; // matchId -> teamId
  if (thirdPlaceAdvancing.length === 8) {
    const placements = getThirdPlacePlacements(thirdPlaceAdvancing);
    if (placements) {
      // THIRD_PLACE_SLOTS = [74,77,79,80,82,81,85,87] mapped to placements[0..7]
      const SLOTS = [74,77,79,80,82,81,85,87];
      SLOTS.forEach((matchId, i) => {
        const groupLetter = placements[i];
        // 3rd-place team is at index 2 in the user's 1-4 ordering
        const groupTeams = groupPicks[groupLetter] ?? [];
        thirdPlaceBySlot[matchId] = groupTeams[2] ?? null;
      });
    }
  }

  // Resolve R32 matches
  for (const match of BRACKET_STRUCTURE) {
    if (match.round !== 'R32') continue;
    result[match.id] = [
      resolveSlot(match.teamA, groupPicks, thirdPlaceBySlot),
      resolveSlot(match.teamB, groupPicks, thirdPlaceBySlot),
    ];
  }

  // Resolve subsequent rounds from bracket picks
  for (const round of ['R16','QF','SF','TPM','F']) {
    for (const match of BRACKET_STRUCTURE.filter(m => m.round === round)) {
      result[match.id] = [
        resolveKnockoutSlot(match.teamA, bracketPicks, result),
        resolveKnockoutSlot(match.teamB, bracketPicks, result),
      ];
    }
  }

  return result;
}

function resolveSlot(slot, groupPicks, thirdPlaceBySlot) {
  if (!slot) return null;
  // "1X" = 1st place group X, "2X" = 2nd place group X
  const rank = parseInt(slot[0]);
  const group = slot.slice(1);

  if (slot.startsWith('3P_')) {
    const matchId = parseInt(slot.replace('3P_', ''));
    return thirdPlaceBySlot[matchId] ?? null;
  }

  if (rank === 1 || rank === 2) {
    return groupPicks[group]?.[rank - 1] ?? null;
  }

  return null;
}

function resolveKnockoutSlot(slot, bracketPicks, resolvedMatches) {
  if (!slot) return null;
  // "WXX" = winner of match XX, "LXX" = loser of match XX
  if (slot.startsWith('W')) {
    const matchId = parseInt(slot.slice(1));
    // Find which round/key this match belongs to
    const match = BRACKET_STRUCTURE.find(m => m.id === matchId);
    if (!match) return null;
    const pickKey = `${match.round}_${matchId}`;
    return bracketPicks[pickKey] ?? null;
  }
  if (slot.startsWith('L')) {
    // Loser of a match — for TPM
    const matchId = parseInt(slot.slice(1));
    const match = BRACKET_STRUCTURE.find(m => m.id === matchId);
    if (!match) return null;
    const pickKey = `${match.round}_${matchId}`;
    const winner = bracketPicks[pickKey];
    const [teamA, teamB] = resolvedMatches[matchId] ?? [];
    if (!winner || (!teamA && !teamB)) return null;
    return winner === teamA ? teamB : teamA;
  }
  return null;
}
