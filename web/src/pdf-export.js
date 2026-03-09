// pdf-export.js — Export picks to visual PDF with bracket and flags
// Landscape A3: page 1 = group stage, page 2 = knockout bracket

import { jsPDF } from 'jspdf';
import { getState } from './state.js';
import { GROUP_LETTERS, TEAMS_BY_ID, TEAMS_BY_GROUP } from './data/teams.js';
import {
  BRACKET_STRUCTURE, MATCH_SCHEDULE, THIRD_PLACE_SLOTS,
} from './data/bracket-structure.js';
import { getThirdPlacePlacements } from './data/third-place-table.js';

// ─── Bracket pathway definitions (mirrors bracket.js) ───────

const PATHWAY_1_R32 = [74, 77, 73, 75, 83, 84, 81, 82];
const PATHWAY_1_R16 = [89, 90, 93, 94];
const PATHWAY_1_QF  = [97, 98];
const PATHWAY_1_SF  = [101];

const PATHWAY_2_R32 = [76, 78, 79, 80, 86, 88, 85, 87];
const PATHWAY_2_R16 = [91, 92, 95, 96];
const PATHWAY_2_QF  = [99, 100];
const PATHWAY_2_SF  = [102];

const MATCH_BY_ID = Object.fromEntries(BRACKET_STRUCTURE.map(m => [m.id, m]));

// ─── Flag image cache ───────────────────────────────────────

const _flagCache = new Map();

async function _loadFlag(flagCode) {
  if (!flagCode || flagCode === 'xx') return null;
  if (_flagCache.has(flagCode)) return _flagCache.get(flagCode);
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = `https://flagcdn.com/w80/${flagCode}.png`;
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    const dataUrl = c.toDataURL('image/png');
    _flagCache.set(flagCode, dataUrl);
    return dataUrl;
  } catch {
    _flagCache.set(flagCode, null);
    return null;
  }
}

async function _preloadFlags(teamIds) {
  const codes = new Set();
  for (const id of teamIds) {
    const t = TEAMS_BY_ID[id];
    if (t?.flagCode && t.flagCode !== 'xx') codes.add(t.flagCode);
  }
  await Promise.all([...codes].map(c => _loadFlag(c)));
}

// ─── Match resolution (same as bracket.js, which doesn't export it) ─

function resolveMatchTeams(groupPicks, thirdPlaceAdvancing, bracketPicks) {
  const result = {};
  let thirdPlaceBySlot = {};
  if (thirdPlaceAdvancing.length === 8) {
    const placements = getThirdPlacePlacements(thirdPlaceAdvancing);
    if (placements) {
      THIRD_PLACE_SLOTS.forEach((matchId, i) => {
        const groupLetter = placements[i];
        thirdPlaceBySlot[matchId] = (groupPicks[groupLetter] ?? [])[2] ?? null;
      });
    }
  }
  for (const match of BRACKET_STRUCTURE) {
    if (match.round !== 'R32') continue;
    result[match.id] = [
      _resolveSlot(match.teamA, groupPicks, thirdPlaceBySlot),
      _resolveSlot(match.teamB, groupPicks, thirdPlaceBySlot),
    ];
  }
  for (const round of ['R16', 'QF', 'SF', 'TPM', 'F']) {
    for (const match of BRACKET_STRUCTURE.filter(m => m.round === round)) {
      result[match.id] = [
        _resolveKnockoutSlot(match.teamA, bracketPicks, result),
        _resolveKnockoutSlot(match.teamB, bracketPicks, result),
      ];
    }
  }
  return result;
}

function _resolveSlot(slot, groupPicks, thirdPlaceBySlot) {
  if (!slot) return null;
  if (slot.startsWith('3P_')) {
    return thirdPlaceBySlot[parseInt(slot.replace('3P_', ''))] ?? null;
  }
  const rank = parseInt(slot[0]);
  const group = slot.slice(1);
  if (rank === 1 || rank === 2) return groupPicks[group]?.[rank - 1] ?? null;
  return null;
}

function _resolveKnockoutSlot(slot, bracketPicks, resolved) {
  if (!slot) return null;
  if (slot.startsWith('W')) {
    const matchId = parseInt(slot.slice(1));
    const match = MATCH_BY_ID[matchId];
    return match ? bracketPicks[`${match.round}_${matchId}`] ?? null : null;
  }
  if (slot.startsWith('L')) {
    const matchId = parseInt(slot.slice(1));
    const match = MATCH_BY_ID[matchId];
    if (!match) return null;
    const winner = bracketPicks[`${match.round}_${matchId}`];
    const [a, b] = resolved[matchId] ?? [];
    if (!winner || (!a && !b)) return null;
    return winner === a ? b : a;
  }
  return null;
}

// ─── Drawing primitives ─────────────────────────────────────

const FLAG_W = 7;
const FLAG_H = 5;

function _drawFlag(doc, teamId, x, y) {
  const t = TEAMS_BY_ID[teamId];
  if (!t) return;
  const dataUrl = _flagCache.get(t.flagCode);
  if (dataUrl) {
    try { doc.addImage(dataUrl, 'PNG', x, y - FLAG_H + 1, FLAG_W, FLAG_H); } catch { /* skip */ }
  }
}

function _teamName(id) { return TEAMS_BY_ID[id]?.name ?? 'TBD'; }

// ─── Public export ──────────────────────────────────────────

export async function exportPicksPDF() {
  const { picks, user, displayName } = getState();
  if (!picks) return;

  const gp = picks.groupPicks ?? {};
  const tpa = picks.thirdPlaceAdvancing ?? [];
  const bp = picks.bracketPicks ?? {};
  const mt = resolveMatchTeams(gp, tpa, bp);

  // Collect every team ID and preload flags
  const ids = new Set();
  for (const l of GROUP_LETTERS) {
    for (const id of gp[l] ?? []) ids.add(id);
    for (const t of TEAMS_BY_GROUP[l]) ids.add(t.id);
  }
  for (const v of Object.values(bp)) { if (v) ids.add(v); }
  for (const arr of Object.values(mt)) {
    if (Array.isArray(arr)) arr.forEach(id => { if (id) ids.add(id); });
  }
  await _preloadFlags(ids);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a3' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 10;
  const name = displayName || user?.userDetails || 'Anonymous';

  // PAGE 1 — Group Stage
  _drawHeader(doc, W, margin, name);
  _drawGroupStage(doc, W, H, margin, gp, tpa);

  // PAGE 2 — Knockout Bracket
  doc.addPage('a3', 'landscape');
  _drawHeader(doc, W, margin, name);
  _drawBracket(doc, W, H, margin, bp, mt);

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFontSize(6);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150);
    doc.text('wc.k61.dev', W / 2, H - 4, { align: 'center' });
    doc.text(`Page ${p} of ${pages}`, W - margin, H - 4, { align: 'right' });
    doc.setTextColor(0);
  }

  const safeName = name.replace(/[^a-zA-Z0-9]/g, '');
  doc.save(`world-cup-2026-picks${safeName ? '-' + safeName : ''}.pdf`);
}

// ─── Header ─────────────────────────────────────────────────

function _drawHeader(doc, W, margin, name) {
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('FIFA World Cup 2026 Picks', W / 2, margin + 5, { align: 'center' });
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const date = new Date().toLocaleDateString('en-US',
    { year: 'numeric', month: 'long', day: 'numeric' });
  doc.text(`${name}  |  ${date}`, W / 2, margin + 10, { align: 'center' });
  doc.setDrawColor(180);
  doc.line(margin, margin + 13, W - margin, margin + 13);
}

// ─── Group Stage (12 groups — 4 cols × 3 rows) ─────────────

function _drawGroupStage(doc, W, H, margin, groupPicks, thirdAdvancing) {
  const top = margin + 20;
  const cols = 4;
  const rows = 3;
  const colW = (W - margin * 2) / cols;
  const rowH = (H - top - margin - 8) / rows;

  // Section label
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Group Stage', margin, top - 2);

  for (let i = 0; i < GROUP_LETTERS.length; i++) {
    const letter = GROUP_LETTERS[i];
    const col = i % cols;
    const row = Math.floor(i / cols);
    _drawGroupCard(doc, letter, margin + col * colW, top + row * rowH,
      colW - 4, groupPicks, thirdAdvancing);
  }
}

function _drawGroupCard(doc, letter, x, y, w, groupPicks, thirdAdvancing) {
  const selected = groupPicks[letter] ?? [];
  const teams = TEAMS_BY_GROUP[letter] ?? [];
  const thirdAdv = thirdAdvancing.includes(letter);

  // Header
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(26, 122, 60);
  doc.text(`Group ${letter}`, x + 1, y + 4);
  doc.setTextColor(0);
  doc.setDrawColor(200);
  doc.line(x + 1, y + 5.5, x + w, y + 5.5);

  // Teams ordered: ranked first, then unranked
  const ranked = selected.map(id => TEAMS_BY_ID[id]).filter(Boolean);
  const unranked = teams.filter(t => !selected.includes(t.id));
  const ordered = [...ranked, ...unranked];
  const lineH = 6;

  for (let j = 0; j < ordered.length; j++) {
    const team = ordered[j];
    const ty = y + 10 + j * lineH;
    const rank = selected.indexOf(team.id);

    // Rank badge (circle with number)
    if (rank >= 0) {
      const colors = [
        [26, 122, 60],   // 1st green
        [33, 150, 243],  // 2nd blue
        [255, 152, 0],   // 3rd orange
        [158, 158, 158], // 4th grey
      ];
      const [r, g, b] = colors[rank] ?? [158, 158, 158];
      doc.setFillColor(r, g, b);
      doc.circle(x + 4, ty - 1.2, 2, 'F');
      doc.setFontSize(5.5);
      doc.setTextColor(255);
      doc.setFont('helvetica', 'bold');
      doc.text(`${rank + 1}`, x + 4, ty - 0.5, { align: 'center' });
      doc.setTextColor(0);
    }

    // Flag
    _drawFlag(doc, team.id, x + 8, ty);

    // Name
    doc.setFontSize(7.5);
    doc.setFont('helvetica', rank >= 0 ? 'bold' : 'normal');
    if (rank === 0 || rank === 1) doc.setTextColor(26, 122, 60);
    else if (rank === 2) doc.setTextColor(180, 120, 0);
    else doc.setTextColor(80);
    doc.text(team.name, x + 16, ty);
    if (rank === 0 || rank === 1 || (rank === 2 && thirdAdv)) {
      const nameW = doc.getTextWidth(team.name);
      doc.setFontSize(5.5);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(26, 122, 60);
      doc.text('Advancing', x + 16 + nameW + 2, ty);
    }
    doc.setTextColor(0);
  }
}

// ─── Knockout Bracket ───────────────────────────────────────
// Layout: R32 (16) → R16 (8) → QF (4) → SF (2) → F (1), left-to-right

function _drawBracket(doc, W, H, margin, bp, mt) {
  const top = margin + 20;
  const usableH = H - top - margin - 8;
  const usableW = W - margin * 2;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Knockout Stage', margin, top - 2);

  const colGap = 3;
  const numCols = 5; // R32, R16, QF, SF, F
  const colW = (usableW - colGap * (numCols - 1)) / numCols;

  const roundDefs = [
    { ids: [...PATHWAY_1_R32, ...PATHWAY_2_R32], round: 'R32', label: 'Round of 32' },
    { ids: [...PATHWAY_1_R16, ...PATHWAY_2_R16], round: 'R16', label: 'Round of 16' },
    { ids: [...PATHWAY_1_QF,  ...PATHWAY_2_QF],  round: 'QF',  label: 'Quarter-Finals' },
    { ids: [...PATHWAY_1_SF,  ...PATHWAY_2_SF],  round: 'SF',  label: 'Semi-Finals' },
    { ids: [104],                                 round: 'F',   label: 'Final' },
  ];

  for (let c = 0; c < roundDefs.length; c++) {
    const { ids, round, label } = roundDefs[c];
    const x = margin + c * (colW + colGap);
    const matchStartY = top + 5;
    const matchH = usableH - 5;
    const slotH = matchH / ids.length;

    // Round label
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(100);
    doc.text(label, x + colW / 2, top + 2, { align: 'center' });
    doc.setTextColor(0);

    for (let i = 0; i < ids.length; i++) {
      const matchId = ids[i];
      const [teamA, teamB] = mt[matchId] || [null, null];
      const picked = bp[`${round}_${matchId}`] ?? null;
      const slotCY = matchStartY + i * slotH + slotH / 2;
      const cardH = Math.min(slotH * 0.85, 14);
      const cardY = slotCY - cardH / 2;

      _drawMatchCard(doc, x, cardY, colW, cardH, matchId, teamA, teamB, picked);

      // Connector lines to next round
      if (c < roundDefs.length - 1) {
        const exitX = x + colW;
        const gapMidX = x + colW + colGap / 2;

        doc.setDrawColor(180);
        doc.setLineWidth(0.3);
        doc.line(exitX, slotCY, gapMidX, slotCY);

        if (ids.length === 1) {
          const nextX = gapMidX + colGap / 2;
          doc.line(gapMidX, slotCY, nextX, slotCY);
        } else if (i % 2 === 0 && i + 1 < ids.length) {
          const pairCY = matchStartY + (i + 1) * slotH + slotH / 2;
          doc.line(gapMidX, slotCY, gapMidX, pairCY);
          const midY = (slotCY + pairCY) / 2;
          const nextX = gapMidX + colGap / 2;
          doc.line(gapMidX, midY, nextX, midY);
        }
      }
    }

    // For the Final column, draw Champion above and TPM/3rd below
    if (round === 'F') {
      const slotCY = matchStartY + matchH / 2;
      const cardH = Math.min(slotH * 0.85, 14);
      _drawFinalExtras(doc, bp, mt, x, slotCY, colW, cardH);
    }
  }
}

// ─── Champion + TPM + 3rd Place (around the Final card) ────

function _drawFinalExtras(doc, bp, mt, x, finalCY, colW, cardH) {
  const finalPick = bp['F_104'] ?? null;

  // Champion card (above Final)
  const champTeam = finalPick ? TEAMS_BY_ID[finalPick] : null;
  const champY = finalCY - cardH / 2 - 14;

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(180, 150, 0);
  doc.text('Champion', x + colW / 2, champY, { align: 'center' });
  doc.setTextColor(0);

  if (champTeam) {
    doc.setDrawColor(200, 170, 0);
    doc.setLineWidth(0.5);
    doc.roundedRect(x + 2, champY + 1, colW - 4, 9, 2, 2, 'S');
    _drawFlag(doc, champTeam.id, x + 5, champY + 8);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(champTeam.name, x + 13, champY + 7);
  }

  // TPM (below Final)
  const tpmY = finalCY + cardH / 2 + 8;
  _label(doc, '3rd Place Match', x + colW / 2, tpmY - 2);
  const [tpmA, tpmB] = mt[103] || [null, null];
  const tpmPick = bp['TPM_103'] ?? null;
  const tpmCardH = Math.min(14, cardH);
  _drawMatchCard(doc, x, tpmY, colW, tpmCardH, 103, tpmA, tpmB, tpmPick);

  // 3rd place winner
  const thirdTeam = tpmPick ? TEAMS_BY_ID[tpmPick] : null;
  const thirdY = tpmY + tpmCardH + 4;
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(205, 127, 50);
  doc.text('3rd Place', x + colW / 2, thirdY, { align: 'center' });
  doc.setTextColor(0);

  if (thirdTeam) {
    doc.setDrawColor(205, 127, 50);
    doc.setLineWidth(0.5);
    doc.roundedRect(x + 2, thirdY + 1, colW - 4, 8, 2, 2, 'S');
    _drawFlag(doc, thirdTeam.id, x + 5, thirdY + 7);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.text(thirdTeam.name, x + 13, thirdY + 6);
  }
}

function _label(doc, text, x, y) {
  doc.setFontSize(6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100);
  doc.text(text, x, y, { align: 'center' });
  doc.setTextColor(0);
}

// ─── Match card ─────────────────────────────────────────────

function _drawMatchCard(doc, x, y, w, h, matchId, teamA, teamB, picked) {
  doc.setDrawColor(200);
  doc.setLineWidth(0.2);
  doc.setFillColor(255);
  doc.roundedRect(x, y, w, h, 1, 1, 'FD');

  const half = h / 2;
  const ts = Math.max(7, Math.min(8, h * 0.45));

  // Team A (top half)
  const aY = y + half / 2 + ts * 0.3;
  if (teamA && picked === teamA) {
    doc.setFillColor(212, 237, 218);
    doc.rect(x + 0.5, y + 0.5, w - 1, half - 0.5, 'F');
  }
  _drawTeamRow(doc, teamA, x, aY, w, ts, picked === teamA);

  // Divider
  doc.setDrawColor(220);
  doc.setLineWidth(0.15);
  doc.line(x + 1, y + half, x + w - 1, y + half);

  // Match number label
  doc.setFontSize(5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(170);
  doc.text(`M${matchId}`, x + w - 1, y + half + 0.3, { align: 'right' });
  doc.setTextColor(0);

  // Team B (bottom half)
  const bY = y + half + half / 2 + ts * 0.3;
  if (teamB && picked === teamB) {
    doc.setFillColor(212, 237, 218);
    doc.rect(x + 0.5, y + half + 0.5, w - 1, half - 1, 'F');
  }
  _drawTeamRow(doc, teamB, x, bY, w, ts, picked === teamB);
  doc.setFont('helvetica', 'normal');
}

function _drawTeamRow(doc, teamId, x, baseY, w, fontSize, isBold) {
  if (teamId) {
    _drawFlag(doc, teamId, x + 2, baseY);
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', isBold ? 'bold' : 'normal');
    doc.text(_teamName(teamId), x + 10, baseY - 0.5, { maxWidth: w - 14 });
  } else {
    doc.setFontSize(fontSize - 0.5);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150);
    doc.text('TBD', x + 3, baseY - 0.5);
    doc.setTextColor(0);
  }
}
