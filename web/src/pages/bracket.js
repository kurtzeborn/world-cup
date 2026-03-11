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
 * Adjacent pairs in each round feed into the same next-round match.
 */
const PATHWAY_1 = {
  R32: [74, 77, 73, 75, 83, 84, 81, 82],
  R16: [89, 90, 93, 94],
  QF:  [97, 98],
  SF:  [101],
};

const PATHWAY_2 = {
  R32: [76, 78, 79, 80, 86, 88, 85, 87],
  R16: [91, 92, 95, 96],
  QF:  [99, 100],
  SF:  [102],
};

/** Rounds in left-to-right order (merged P1+P2 for R32–SF, then single Final) */
const ROUNDS = ['R32', 'R16', 'QF', 'SF', 'F'];

// ─── Page entry point ───────────────────────────────────────

export function renderBracketPage(container) {
  const { locked } = getState();

  container.innerHTML = `
    <div class="page active" id="page-bracket">
      ${locked ? '<div class="lock-banner">🔒 Picks are locked</div>' : ''}
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
  const { picks, locked, results } = getState();
  const bp = picks?.bracketPicks ?? {};
  const gp = picks?.groupPicks ?? {};
  const tpa = picks?.thirdPlaceAdvancing ?? [];
  const mt = resolveMatchTeams(gp, tpa, bp);
  const mr = results?.matchResults ?? {};

  const el = document.getElementById('bracket-content');
  if (!el) return;

  el.innerHTML = `
    <div class="bk-scroll">
      <div class="bk-bracket">
        ${renderBracketCols(bp, mt, locked, mr)}
      </div>
    </div>
  `;
}

// ─── Rendering helpers ──────────────────────────────────────

/** Build all columns: R32(16) → R16(8) → QF(4) → SF(2) → F(1) */
function renderBracketCols(bp, mt, locked, mr) {
  let html = '';

  for (let r = 0; r < ROUNDS.length; r++) {
    const round = ROUNDS[r];
    const isFirst = r === 0;
    const isLast = r === ROUNDS.length - 1;

    // Merge P1 + P2 ids for R32–SF; Final is just [104]
    const ids = round === 'F' ? [104]
      : [...PATHWAY_1[round], ...PATHWAY_2[round]];

    const cls = ['bk-round-col'];
    if (isFirst) cls.push('bk-col-first');
    if (isLast) cls.push('bk-col-last');

    html += `<div class="${cls.join(' ')}">`;
    html += `<div class="bk-round-hdr">${ROUND_NAMES[round]}</div>`;

    if (isLast) {
      // Final column: Champion above, Final match, TPM + 3rd below
      html += renderFinalColumn(bp, mt, locked, mr);
    } else {
      html += '<div class="bk-slots">';
      for (const id of ids) {
        html += renderSlot(MATCH_BY_ID[id], round, bp, mt, locked, mr);
      }
      html += '</div>';
    }

    html += '</div>';
  }

  return html;
}

/** Final column: champion card → Final match → TPM + 3rd place */
function renderFinalColumn(bp, mt, locked, mr) {
  const finalPick = bp['F_104'] ?? null;
  const champTeam = finalPick ? TEAMS_BY_ID[finalPick] : null;
  const champHtml = champTeam
    ? `<div class="bk-champ-team">${getFlag(champTeam.flagCode)} ${champTeam.name}</div>`
    : `<div class="bk-champ-team bk-tbd"></div>`;

  const tpmPick = bp['TPM_103'] ?? null;
  const thirdTeam = tpmPick ? TEAMS_BY_ID[tpmPick] : null;
  const thirdHtml = thirdTeam
    ? `<div class="bk-third-team">${getFlag(thirdTeam.flagCode)} ${thirdTeam.name}</div>`
    : `<div class="bk-third-team bk-tbd"></div>`;

  const tpmMatch = MATCH_BY_ID[103];
  const [tpmA, tpmB] = mt[103] || [null, null];
  const tpmKey = 'TPM_103';
  const tpmPicked = bp[tpmKey] ?? '';
  const tpmCanPick = !locked && (tpmA || tpmB);
  const tpmResult = mr['M103'];

  return `
    <div class="bk-final-wrap">
      <div class="bk-award">
        <div class="bk-center-hdr">🏆 Champion</div>
        ${champHtml}
      </div>

      <div class="bk-slots">
        ${renderSlot(MATCH_BY_ID[104], 'F', bp, mt, locked, mr)}
      </div>

      <div class="bk-final-below">
        <div class="bk-tpm-wrap">
          <div class="bk-center-hdr">3rd Place Match</div>
          <div class="bk-match">
            ${teamRow(tpmA, tpmMatch.teamA, tpmPicked, tpmCanPick, tpmKey, tpmResult)}
            ${matchInfoBar(103)}
            ${teamRow(tpmB, tpmMatch.teamB, tpmPicked, tpmCanPick, tpmKey, tpmResult)}
          </div>
        </div>
        <div class="bk-award">
          <div class="bk-center-hdr">🥉 3rd Place</div>
          ${thirdHtml}
        </div>
      </div>
    </div>
  `;
}

function renderSlot(match, round, bracketPicks, matchTeams, locked, mr) {
  const [a, b] = matchTeams[match.id] || [null, null];
  const key = `${round}_${match.id}`;
  const picked = bracketPicks[key] ?? '';
  const canPick = !locked && (a || b);
  const result = mr['M' + match.id];

  return `<div class="bk-slot">
    <div class="bk-match">
      ${teamRow(a, match.teamA, picked, canPick, key, result)}
      ${matchInfoBar(match.id)}
      ${teamRow(b, match.teamB, picked, canPick, key, result)}
    </div>
  </div>`;
}

function matchInfoBar(matchId) {
  const sched = MATCH_SCHEDULE[matchId];
  if (!sched) return '';
  return `<div class="bk-match-info">M${matchId} · ${sched.date} · ${sched.city}</div>`;
}

function teamRow(resolved, slotStr, picked, canPick, pickKey, result) {
  const isPicked = resolved && picked === resolved;
  const actualWinner = result?.winner;
  const cls = ['bk-team'];
  if (isPicked) cls.push('picked');
  if (canPick) cls.push('pickable');
  if (actualWinner && resolved === actualWinner) cls.push('correct');
  else if (actualWinner && isPicked && resolved !== actualWinner) cls.push('incorrect');
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
