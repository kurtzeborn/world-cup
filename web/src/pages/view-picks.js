// pages/view-picks.js — View another user's locked picks (read-only, post-lock only)

import { api } from '../api.js';
import { getState } from '../state.js';
import { TEAMS_BY_ID } from '../data/teams.js';
import { escapeHtml, getFlag } from '../utils.js';
import { BRACKET_STRUCTURE, MATCH_SCHEDULE } from '../data/bracket-structure.js';

const ROUND_NAMES = {
  R32: 'Round of 32',
  R16: 'Round of 16',
  QF:  'Quarter-Finals',
  SF:  'Semi-Finals',
  F:   'Final',
};

const MATCH_BY_ID = Object.fromEntries(BRACKET_STRUCTURE.map(m => [m.id, m]));

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

const ROUNDS = ['R32', 'R16', 'QF', 'SF', 'F'];

export async function renderViewPicksPage(container, userId) {
  container.innerHTML = `
    <div class="page active" id="page-view-picks">
      <div class="card">
        <div class="card-title">Picks for <span id="view-user-name">User</span> <span id="view-user-score" class="view-picks-score"></span></div>
        <div id="viewpicks-content"><p style="color:var(--text-muted)">Loading…</p></div>
      </div>
    </div>
  `;

  try {
    const picks = await api.getUserPicks(userId);
    const user = await api.getUser(userId).catch(() => ({ displayName: userId }));

    const nameEl = document.getElementById('view-user-name');
    if (nameEl) {
      nameEl.textContent = escapeHtml(user?.displayName || userId);
    }

    const scoreEl = document.getElementById('view-user-score');
    if (scoreEl && picks.score) {
      scoreEl.textContent = `— Score: ${picks.score.totalPoints}pts (${picks.score.maxPossiblePoints} possible)`;
    }

    renderViewPicksContent(picks);
  } catch (err) {
    document.getElementById('viewpicks-content').innerHTML =
      `<p style="color:#f44336">Failed to load picks: ${err.message}</p>`;
  }
}

function renderViewPicksContent(picks) {
  const el = document.getElementById('viewpicks-content');
  if (!el) return;

  const groupPicks = picks?.groupPicks ?? {};
  const thirdPlaceAdvancing = picks?.thirdPlaceAdvancing ?? [];
  const bracketPicks = picks?.bracketPicks ?? {};

  el.innerHTML = `
    <div class="viewpicks-wrapper">
      <div class="viewpicks-groups">
        ${renderGroupStage(groupPicks, thirdPlaceAdvancing)}
      </div>
      <div class="viewpicks-bracket">
        ${renderViewBracket(bracketPicks)}
      </div>
    </div>
  `;
}

/** Render group stage picks in a simple vertical list */
function renderGroupStage(groupPicks, thirdPlaceAdvancing) {
  const groups = Object.keys(groupPicks).sort();
  if (groups.length === 0) {
    return '<p style="color:var(--text-muted)">No group picks</p>';
  }

  const advancingSet = new Set(thirdPlaceAdvancing);

  let html = '<div class="viewpicks-groups-list">';
  for (const group of groups) {
    const teams = groupPicks[group];
    html += `<div class="viewpicks-group-card">
      <div class="viewpicks-group-title">Group ${group}</div>
      <div class="viewpicks-group-teams">`;

    teams.forEach((teamId, i) => {
      const team = TEAMS_BY_ID[teamId] || { name: teamId, flagCode: null };
      const pos = i + 1;
      const isAdv3rd = pos === 3 && advancingSet.has(teamId);
      html += `<div class="viewpicks-team-row">
        <span class="viewpicks-pos">${pos}</span>
        <span class="viewpicks-flag">${getFlag(team.flagCode)}</span>
        <span class="viewpicks-name">${escapeHtml(team.name)}</span>
        ${isAdv3rd ? '<span class="viewpicks-adv-badge">↗ Advancing 3rd</span>' : ''}
      </div>`;
    });

    html += `</div></div>`;
  }
  html += '</div>';
  return html;
}

/** Render the bracket in read-only mode (matches existing bracket.js visual structure) */
function renderViewBracket(bracketPicks) {
  let html = `<div class="bk-scroll"><div class="bk-bracket">`;

  for (let r = 0; r < ROUNDS.length; r++) {
    const round = ROUNDS[r];
    const isFirst = r === 0;
    const isLast = r === ROUNDS.length - 1;

    const ids = round === 'F' ? [104]
      : [...PATHWAY_1[round], ...PATHWAY_2[round]];

    const cls = ['bk-round-col'];
    if (isFirst) cls.push('bk-col-first');
    if (isLast) cls.push('bk-col-last');

    html += `<div class="${cls.join(' ')}">`;
    html += `<div class="bk-round-hdr">${ROUND_NAMES[round]}</div>`;

    if (isLast) {
      html += renderViewFinalColumn(bracketPicks);
    } else {
      html += '<div class="bk-slots">';
      for (const id of ids) {
        html += renderViewSlot(MATCH_BY_ID[id], round, bracketPicks);
      }
      html += '</div>';
    }

    html += '</div>';
  }

  html += '</div></div>';
  return html;
}

function renderViewFinalColumn(bracketPicks) {
  const finalPick = bracketPicks['F_104'] ?? null;
  const champTeam = finalPick ? TEAMS_BY_ID[finalPick] : null;
  const champHtml = champTeam
    ? `<div class="bk-champ-team">${getFlag(champTeam.flagCode)} ${champTeam.name}</div>`
    : `<div class="bk-champ-team bk-tbd"></div>`;

  const tpmPick = bracketPicks['TPM_103'] ?? null;
  const thirdTeam = tpmPick ? TEAMS_BY_ID[tpmPick] : null;
  const thirdHtml = thirdTeam
    ? `<div class="bk-third-team">${getFlag(thirdTeam.flagCode)} ${thirdTeam.name}</div>`
    : `<div class="bk-third-team bk-tbd"></div>`;

  return `
    <div class="bk-final-wrap">
      <div class="bk-award">
        <div class="bk-center-hdr">🏆 Champion</div>
        ${champHtml}
      </div>

      <div class="bk-slots">
        ${renderViewSlot(MATCH_BY_ID[104], 'F', bracketPicks)}
      </div>

      <div class="bk-final-below">
        <div class="bk-tpm-wrap">
          <div class="bk-center-hdr">3rd Place Match</div>
          <div class="bk-match">
            ${renderViewTeamRow(null, null, '—')}
            ${matchInfoBar(103)}
            ${renderViewTeamRow(null, null, '—')}
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

function renderViewSlot(match, round, bracketPicks) {
  const key = `${round}_${match.id}`;
  const picked = bracketPicks[key] ?? '';

  const aTeam = picked === match.teamA ? TEAMS_BY_ID[picked] : null;
  const bTeam = picked === match.teamB ? TEAMS_BY_ID[picked] : null;

  return `<div class="bk-slot">
    <div class="bk-match">
      ${renderViewTeamRow(aTeam?.name, aTeam?.flagCode, slotDesc(match.teamA), picked === match.teamA)}
      ${matchInfoBar(match.id)}
      ${renderViewTeamRow(bTeam?.name, bTeam?.flagCode, slotDesc(match.teamB), picked === match.teamB)}
    </div>
  </div>`;
}

function renderViewTeamRow(name, flagCode, slot, isPicked) {
  const cls = ['bk-team'];
  if (isPicked) cls.push('picked');

  if (name) {
    return `<div class="${cls.join(' ')}">${getFlag(flagCode)} ${escapeHtml(name)}</div>`;
  }
  return `<div class="${cls.join(' ')}">${slotDesc(slot)}</div>`;
}

function matchInfoBar(matchId) {
  const sched = MATCH_SCHEDULE[matchId];
  if (!sched) return '';
  return `<div class="bk-match-info">M${matchId} · ${sched.date} · ${sched.city}</div>`;
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
