// pages/dashboard.js — Post-lock dashboard showing picks vs results

import { api } from '../api.js';
import { getState } from '../state.js';
import { TEAMS_BY_ID } from '../data/teams.js';
import { BRACKET_STRUCTURE, MATCH_SCHEDULE } from '../data/bracket-structure.js';
import { escapeHtml, getFlag } from '../utils.js';

const GROUPS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
const ROUND_NAMES = {
  R32: 'Round of 32',
  R16: 'Round of 16',
  QF:  'Quarter-Finals',
  SF:  'Semi-Finals',
  F:   'Final',
};
const MATCH_BY_ID = Object.fromEntries(BRACKET_STRUCTURE.map(m => [m.id, m]));
const PATHWAY_1 = { R32: [74, 77, 73, 75, 83, 84, 81, 82], R16: [89, 90, 93, 94], QF: [97, 98], SF: [101] };
const PATHWAY_2 = { R32: [76, 78, 79, 80, 86, 88, 85, 87], R16: [91, 92, 95, 96], QF: [99, 100], SF: [102] };
const ROUNDS = ['R32', 'R16', 'QF', 'SF', 'F'];

export async function renderDashboardPage(container) {
  container.innerHTML = `
    <div class="page active" id="page-dashboard">
      <div class="card">
        <div class="card-title">Dashboard (Posts-Lock Results)</div>
        <div id="dashboard-content"><p style="color:var(--text-muted)">Loading…</p></div>
      </div>
    </div>
  `;

  try {
    const [picks, results, teams] = await Promise.all([
      api.getPicks().catch(() => null),
      api.getResults().catch(() => ({})),
      api.getTeams().catch(() => []),
    ]);

    if (!picks) {
      document.getElementById('dashboard-content').innerHTML =
        '<p style="color:#f44336">No picks found for current user.</p>';
      return;
    }

    if (!results.groupStandings || !results.matchResults) {
      document.getElementById('dashboard-content').innerHTML =
        '<p style="color:var(--text-muted)">Results not yet entered by admin.</p>';
      return;
    }

    renderDashboardContent(picks, results, teams);
  } catch (err) {
    document.getElementById('dashboard-content').innerHTML =
      `<p style="color:#f44336">Error loading dashboard: ${err.message}</p>`;
  }
}

function renderDashboardContent(picks, results, teams) {
  const el = document.getElementById('dashboard-content');
  if (!el) return;

  el.innerHTML = `
    <div class="dashboard-wrapper">
      <div class="dashboard-groups">
        ${renderDashboardGroups(picks.groupPicks, results.groupStandings)}
      </div>
      <div class="dashboard-bracket">
        ${renderDashboardBracket(picks.bracketPicks, results.matchResults)}
      </div>
    </div>
  `;
}

function renderDashboardGroups(groupPicks, groupStandings) {
  const groups = Object.keys(groupPicks).sort();
  if (groups.length === 0) {
    return '<p style="color:var(--text-muted)">No group picks</p>';
  }

  let html = '<div class="dashboard-groups-list">';
  
  for (const group of groups) {
    const picked = groupPicks[group];
    const actual = groupStandings[group] || [];

    html += `<div class="dashboard-group-card"><div class="dashboard-group-title">Group ${group}</div><div class="dashboard-group-teams">`;

    for (let pos = 0; pos < 4; pos++) {
      const pickedTeam = picked[pos];
      const actualTeam = actual[pos];
      const status = getGroupTeamStatus(pickedTeam, pos, actual);
      const statusClass = status === 'correct' ? 'correct' : status === 'partial' ? 'partial' : status === 'incorrect' ? 'incorrect' : '';

      const pickedTeamObj = TEAMS_BY_ID[pickedTeam];
      const actualTeamObj = TEAMS_BY_ID[actualTeam];

      html += `
        <div class="dashboard-team-row ${statusClass}">
          <span class="dashboard-pos">${pos + 1}</span>
          <span class="dashboard-picked">
            ${getFlag(pickedTeamObj?.flagCode)} ${escapeHtml(pickedTeamObj?.name || pickedTeam)}
          </span>
          <span class="dashboard-actual">
            ${getFlag(actualTeamObj?.flagCode)} ${escapeHtml(actualTeamObj?.name || actualTeam)}
          </span>
        </div>
      `;
    }

    html += '</div></div>';
  }

  html += '</div>';
  return html;
}

function getGroupTeamStatus(pickedTeam, pickedPos, actualOrder) {
  if (!pickedTeam || !actualOrder) return '';
  
  // Find where picked team ended up
  const actualPos = actualOrder.indexOf(pickedTeam);
  if (actualPos === -1) return 'incorrect'; // Team didn't advance
  if (actualPos === pickedPos) return 'correct'; // Exact match
  if (pickedPos < 2 && actualPos < 2) return 'partial'; // Both in top 2 but different spots
  if (pickedPos === 2 && actualPos === 2) return 'correct'; // Both 3rd place
  if (pickedPos === 2 && actualOrder.includes(pickedTeam)) return 'partial'; // 3rd place but advanced elsewhere
  return 'incorrect';
}

function renderDashboardBracket(bracketPicks, matchResults) {
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
      html += renderDashboardFinalColumn(bracketPicks, matchResults);
    } else {
      html += '<div class="bk-slots">';
      for (const id of ids) {
        html += renderDashboardSlot(MATCH_BY_ID[id], round, bracketPicks, matchResults);
      }
      html += '</div>';
    }

    html += '</div>';
  }

  html += '</div></div>';
  return html;
}

function renderDashboardFinalColumn(bracketPicks, matchResults) {
  const finalMatchId = 104;
  const finalResult = matchResults[`M${finalMatchId}`];
  const finalPick = bracketPicks['F_104'] ?? null;

  const actualChamp = finalResult?.winner;
  const champStatus = getMatchStatus(finalPick, actualChamp);
  const champTeam = actualChamp ? TEAMS_BY_ID[actualChamp] : null;
  const champHtml = champTeam
    ? `<div class="bk-champ-team ${champStatus}">${getFlag(champTeam.flagCode)} ${champTeam.name}</div>`
    : `<div class="bk-champ-team bk-tbd"></div>`;

  // TPM
  const tpmMatchId = 103;
  const tpmResult = matchResults[`M${tpmMatchId}`];
  const tpmPick = bracketPicks['TPM_103'] ?? null;
  const actualThird = tpmResult?.winner;
  const thirdStatus = getMatchStatus(tpmPick, actualThird);
  const thirdTeam = actualThird ? TEAMS_BY_ID[actualThird] : null;
  const thirdHtml = thirdTeam
    ? `<div class="bk-third-team ${thirdStatus}">${getFlag(thirdTeam.flagCode)} ${thirdTeam.name}</div>`
    : `<div class="bk-third-team bk-tbd"></div>`;

  return `
    <div class="bk-final-wrap">
      <div class="bk-award">
        <div class="bk-center-hdr">🏆 Champion</div>
        ${champHtml}
      </div>

      <div class="bk-slots">
        ${renderDashboardSlot(MATCH_BY_ID[104], 'F', bracketPicks, matchResults)}
      </div>

      <div class="bk-final-below">
        <div class="bk-tpm-wrap">
          <div class="bk-center-hdr">3rd Place Match</div>
          <div class="bk-match">
            <div class="bk-team">—</div>
            ${matchInfoBar(103, tpmResult?.score)}
            <div class="bk-team">—</div>
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

function renderDashboardSlot(match, round, bracketPicks, matchResults) {
  const key = `${round}_${match.id}`;
  const pickedWinner = bracketPicks[key] ?? '';
  const result = matchResults[`M${match.id}`];
  const actualWinner = result?.winner;
  const score = result?.score;

  const pickStatus = getMatchStatus(pickedWinner, actualWinner);

  return `<div class="bk-slot">
    <div class="bk-match">
      ${renderDashboardTeamRow(match.teamA, pickedWinner, actualWinner, pickStatus)}
      ${matchInfoBar(match.id, score)}
      ${renderDashboardTeamRow(match.teamB, pickedWinner, actualWinner, pickStatus)}
    </div>
  </div>`;
}

function renderDashboardTeamRow(slotStr, pickedWinner, actualWinner, pickStatus) {
  const cls = ['bk-team'];
  if (slotStr && slotStr === pickedWinner) cls.push('picked');
  if (slotStr && slotStr === actualWinner) cls.push(pickStatus);

  if (slotStr && slotStr.length <= 3) {
    const t = TEAMS_BY_ID[slotStr];
    return `<div class="${cls.join(' ')}">${getFlag(t?.flagCode)} ${escapeHtml(t?.name || slotStr)}</div>`;
  }
  return `<div class="${cls.join(' ')}">${slotDesc(slotStr)}</div>`;
}

function getMatchStatus(pickedWinner, actualWinner) {
  if (!pickedWinner && !actualWinner) return '';
  if (!actualWinner) return '';
  if (pickedWinner === actualWinner) return 'correct';
  if (pickedWinner) return 'incorrect';
  return '';
}

function matchInfoBar(matchId, score) {
  const sched = MATCH_SCHEDULE[matchId];
  if (!sched) return '';
  const scoreHtml = score ? ` · <strong>${escapeHtml(score)}</strong>` : '';
  return `<div class="bk-match-info">M${matchId} · ${sched.date} · ${sched.city}${scoreHtml}</div>`;
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
