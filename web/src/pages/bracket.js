// pages/bracket.js — Visual knockout bracket

import { getState, setState } from '../state.js';
import { BRACKET_STRUCTURE, MATCH_SCHEDULE, THIRD_PLACE_SLOTS } from '../data/bracket-structure.js';
import { getThirdPlacePlacements } from '../data/third-place-table.js';
import { TEAMS_BY_ID } from '../data/teams.js';
import { getFlag } from '../utils.js';

const ROUND_NAMES = {
  R32: 'Round of 32',
  R16: 'Round of 16',
  QF:  'Quarter-Finals',
  SF:  'Semi-Finals',
  F:   'Final',
};

/** Lookup match definition by id */
const MATCH_BY_ID = Object.fromEntries(BRACKET_STRUCTURE.map(m => [m.id, m]));

/**
 * Bracket pathway definitions — match IDs in top-to-bottom visual order.
 * Adjacent pairs in each round feed into the same next-round match
 * (e.g. R32[0]+R32[1] → R16[0]).
 */
const PATHWAY_1 = {
  R32: [74, 77, 73, 75, 83, 84, 81, 82],
  R16: [89, 90, 93, 94],
  QF:  [97, 98],
  SF:  [101],
  F:   [104],
};

const PATHWAY_2 = {
  R32: [76, 78, 79, 80, 86, 88, 85, 87],
  R16: [91, 92, 95, 96],
  QF:  [99, 100],
  SF:  [102],
  F:   [104],
};

const HALF_ROUNDS = ['R32', 'R16', 'QF', 'SF', 'F'];

// ─── Page entry point ───────────────────────────────────────

export function renderBracketPage(container) {
  const { locked } = getState();

  container.innerHTML = `
    <div class="page active" id="page-bracket">
      ${locked ? '<div class="lock-banner locked">🔒 Picks are locked — the deadline has passed</div>' : ''}
      <div id="bracket-content"></div>
    </div>
  `;

  renderBracketContent();

  if (!locked) {
    document.getElementById('bracket-content').addEventListener('click', e => {
      const el = e.target.closest('.bk-team[data-pick-team]');
      if (!el) return;
      onBracketPick(el.dataset.pickKey, el.dataset.pickTeam);
      renderBracketContent();
    });
  }
}

// ─── Render the full bracket content ────────────────────────

export function renderBracketContent() {
  const { picks, locked } = getState();
  const bp = picks?.bracketPicks ?? {};
  const gp = picks?.groupPicks ?? {};
  const tpa = picks?.thirdPlaceAdvancing ?? [];
  const mt = resolveMatchTeams(gp, tpa, bp);

  const el = document.getElementById('bracket-content');
  if (!el) return;

  el.innerHTML = `
    <div class="bk-scroll">${renderHalf(PATHWAY_1, bp, mt, locked)}</div>
    <div class="bk-scroll">${renderCenter(bp, mt, locked)}</div>
    <div class="bk-scroll">${renderHalf(PATHWAY_2, bp, mt, locked)}</div>
  `;
}

// ─── Rendering helpers ──────────────────────────────────────

function renderHalf(pathway, bracketPicks, matchTeams, locked) {
  let html = '<div class="bk-half">';

  for (let r = 0; r < HALF_ROUNDS.length; r++) {
    const round = HALF_ROUNDS[r];
    const ids = pathway[round];
    const isFirst = r === 0;
    const isLast = r === HALF_ROUNDS.length - 1;

    const cls = ['bk-round-col'];
    if (isFirst) cls.push('bk-col-first');
    if (isLast) cls.push('bk-col-last');

    html += `<div class="${cls.join(' ')}">`;
    html += `<div class="bk-round-hdr">${ROUND_NAMES[round]}</div>`;
    html += '<div class="bk-slots">';
    for (const id of ids) {
      html += renderSlot(MATCH_BY_ID[id], round, bracketPicks, matchTeams, locked);
    }
    html += '</div></div>';
  }

  return html + '</div>';
}

function renderSlot(match, round, bracketPicks, matchTeams, locked) {
  const [a, b] = matchTeams[match.id] || [null, null];
  const key = `${round}_${match.id}`;
  const picked = bracketPicks[key] ?? '';
  const canPick = !locked && (a || b);

  return `<div class="bk-slot">
    <div class="bk-match">
      ${teamRow(a, match.teamA, picked, canPick, key)}
      ${matchInfoBar(match.id)}
      ${teamRow(b, match.teamB, picked, canPick, key)}
    </div>
  </div>`;
}

function matchInfoBar(matchId) {
  const sched = MATCH_SCHEDULE[matchId];
  if (!sched) return '';
  return `<div class="bk-match-info">M${matchId} · ${sched.date} · ${sched.city}</div>`;
}

function teamRow(resolved, slotStr, picked, canPick, pickKey) {
  const isPicked = resolved && picked === resolved;
  const cls = ['bk-team'];
  if (isPicked) cls.push('picked');
  if (canPick) cls.push('pickable');
  const attrs = canPick && resolved
    ? `data-pick-team="${resolved}" data-pick-key="${pickKey}"`
    : '';

  if (resolved) {
    const t = TEAMS_BY_ID[resolved];
    return `<div class="${cls.join(' ')}" ${attrs}>${getFlag(t?.flagCode)} ${t?.name ?? resolved}</div>`;
  }
  return `<div class="${cls.join(' ')}">${slotDesc(slotStr)}</div>`;
}

function slotDesc(slot) {
  if (!slot) return '<span class="bk-tbd">TBD</span>';
  if (slot.startsWith('3P_')) return '<span class="bk-tbd">3rd place</span>';
  if (slot.startsWith('W')) return `<span class="bk-tbd">Winner M${slot.slice(1)}</span>`;
  if (slot.startsWith('L')) return `<span class="bk-tbd">Loser M${slot.slice(1)}</span>`;
  const rank = parseInt(slot[0]);
  const group = slot.slice(1);
  if (rank === 1) return `<span class="bk-tbd">1st ${group}</span>`;
  if (rank === 2) return `<span class="bk-tbd">2nd ${group}</span>`;
  return `<span class="bk-tbd">${slot}</span>`;
}

function renderCenter(bp, mt, locked) {
  const tpm = renderCenterMatch(103, 'TPM', bp, mt, locked);

  // Champion (winner of Final)
  const finalPick = bp['F_104'] ?? null;
  const champTeam = finalPick ? TEAMS_BY_ID[finalPick] : null;
  const champHtml = champTeam
    ? `<div class="bk-champ-team">${getFlag(champTeam.flagCode)} ${champTeam.name}</div>`
    : `<div class="bk-champ-team bk-tbd"></div>`;

  // 3rd Place winner
  const tpmPick = bp['TPM_103'] ?? null;
  const thirdTeam = tpmPick ? TEAMS_BY_ID[tpmPick] : null;
  const thirdHtml = thirdTeam
    ? `<div class="bk-third-team">${getFlag(thirdTeam.flagCode)} ${thirdTeam.name}</div>`
    : `<div class="bk-third-team bk-tbd"></div>`;

  return `
    <div class="bk-center">
      <div class="bk-award">
        <div class="bk-center-hdr">🏆 Champion</div>
        ${champHtml}
      </div>
      <div class="bk-center-secondary">
        <div class="bk-center-tpm-wrap">
          <div class="bk-center-hdr">3rd Place Match</div>
          ${tpm}
        </div>
        <div class="bk-award">
          <div class="bk-center-hdr">🥉 3rd Place</div>
          ${thirdHtml}
        </div>
      </div>
    </div>
  `;
}

function renderCenterMatch(matchId, round, bp, mt, locked) {
  const match = MATCH_BY_ID[matchId];
  const [a, b] = mt[matchId] || [null, null];
  const key = `${round}_${matchId}`;
  const picked = bp[key] ?? '';
  const canPick = !locked && (a || b);

  return `<div class="bk-match">
    ${teamRow(a, match.teamA, picked, canPick, key)}
    ${matchInfoBar(matchId)}
    ${teamRow(b, match.teamB, picked, canPick, key)}
  </div>`;
}

// ─── State & persistence ────────────────────────────────────

function onBracketPick(matchKey, winnerId) {
  const { picks } = getState();
  const gp = picks?.groupPicks ?? {};
  const tpa = picks?.thirdPlaceAdvancing ?? [];
  let bracketPicks = { ...(picks?.bracketPicks ?? {}), [matchKey]: winnerId };

  // Cascade: clear any downstream picks that are now invalid.
  // Loop because clearing one pick can invalidate further rounds.
  let changed = true;
  while (changed) {
    changed = false;
    const mt = resolveMatchTeams(gp, tpa, bracketPicks);
    for (const key of Object.keys(bracketPicks)) {
      const matchId = parseInt(key.split('_')[1]);
      const [a, b] = mt[matchId] || [null, null];
      const picked = bracketPicks[key];
      if (picked && picked !== a && picked !== b) {
        delete bracketPicks[key];
        changed = true;
      }
    }
  }

  setState({ picks: { ...(picks ?? {}), bracketPicks } });
}

// ─── Match resolution (group picks → R32 → R16 → … → Final) ─

function resolveMatchTeams(groupPicks, thirdPlaceAdvancing, bracketPicks) {
  const result = {};

  // Determine 3rd-place slot assignments
  let thirdPlaceBySlot = {};
  if (thirdPlaceAdvancing.length === 8) {
    const placements = getThirdPlacePlacements(thirdPlaceAdvancing);
    if (placements) {
      THIRD_PLACE_SLOTS.forEach((matchId, i) => {
        const groupLetter = placements[i];
        const groupTeams = groupPicks[groupLetter] ?? [];
        thirdPlaceBySlot[matchId] = groupTeams[2] ?? null;
      });
    }
  }

  // Resolve R32 matches from group picks
  for (const match of BRACKET_STRUCTURE) {
    if (match.round !== 'R32') continue;
    result[match.id] = [
      resolveSlot(match.teamA, groupPicks, thirdPlaceBySlot),
      resolveSlot(match.teamB, groupPicks, thirdPlaceBySlot),
    ];
  }

  // Resolve subsequent rounds from bracket picks
  for (const round of ['R16', 'QF', 'SF', 'TPM', 'F']) {
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
  if (slot.startsWith('3P_')) {
    const matchId = parseInt(slot.replace('3P_', ''));
    return thirdPlaceBySlot[matchId] ?? null;
  }
  const rank = parseInt(slot[0]);
  const group = slot.slice(1);
  if (rank === 1 || rank === 2) return groupPicks[group]?.[rank - 1] ?? null;
  return null;
}

function resolveKnockoutSlot(slot, bracketPicks, resolvedMatches) {
  if (!slot) return null;
  if (slot.startsWith('W')) {
    const matchId = parseInt(slot.slice(1));
    const match = MATCH_BY_ID[matchId];
    if (!match) return null;
    return bracketPicks[`${match.round}_${matchId}`] ?? null;
  }
  if (slot.startsWith('L')) {
    const matchId = parseInt(slot.slice(1));
    const match = MATCH_BY_ID[matchId];
    if (!match) return null;
    const winner = bracketPicks[`${match.round}_${matchId}`];
    const [teamA, teamB] = resolvedMatches[matchId] ?? [];
    if (!winner || (!teamA && !teamB)) return null;
    return winner === teamA ? teamB : teamA;
  }
  return null;
}
