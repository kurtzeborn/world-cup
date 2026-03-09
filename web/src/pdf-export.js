// pdf-export.js — Export picks to PDF (client-side, no server cost)

import { jsPDF } from 'jspdf';
import { getState } from './state.js';
import { GROUP_LETTERS, TEAMS_BY_ID, TEAMS_BY_GROUP } from './data/teams.js';
import { BRACKET_STRUCTURE, MATCH_SCHEDULE } from './data/bracket-structure.js';

const ROUND_ORDER = ['R32', 'R16', 'QF', 'SF', 'TPM', 'F'];
const ROUND_LABELS = {
  R32: 'Round of 32',
  R16: 'Round of 16',
  QF:  'Quarter-Finals',
  SF:  'Semi-Finals',
  TPM: '3rd Place Match',
  F:   'Final',
};

export async function exportPicksPDF() {
  const { picks, user, displayName } = getState();
  if (!picks) return;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;

  // ── Title ──
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('FIFA World Cup 2026 Picks', W / 2, y, { align: 'center' });
  y += 8;

  // ── Subtitle ──
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const name = displayName || user?.userDetails || 'Anonymous';
  const date = new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  doc.text(`${name}  |  ${date}`, W / 2, y, { align: 'center' });
  y += 3;

  // Divider
  doc.setDrawColor(180);
  doc.line(margin, y, W - margin, y);
  y += 6;

  // ── Group Stage ──
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Group Stage', margin, y);
  y += 7;

  const groupPicks = picks.groupPicks ?? {};
  const thirdAdvancing = picks.thirdPlaceAdvancing ?? [];
  const cols = 4;
  const colW = (W - margin * 2) / cols;
  const groupH = 26;

  for (let i = 0; i < GROUP_LETTERS.length; i++) {
    const letter = GROUP_LETTERS[i];
    const col = i % cols;
    if (col === 0 && i > 0) y += groupH + 2;

    if (y + groupH > H - margin - 10) {
      doc.addPage();
      y = margin;
    }

    const x = margin + col * colW;
    const selected = groupPicks[letter] ?? [];
    const teams = TEAMS_BY_GROUP[letter] ?? [];

    // Group header
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 122, 60); // green
    doc.text(`Group ${letter}`, x + 1, y);
    doc.setTextColor(0);

    // Teams in display order (ranked first, then unranked)
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');

    const ranked = selected.map(id => TEAMS_BY_ID[id]).filter(Boolean);
    const unranked = teams.filter(t => !selected.includes(t.id));
    const ordered = [...ranked, ...unranked];

    for (let j = 0; j < ordered.length; j++) {
      const team = ordered[j];
      const ty = y + 5 + j * 4.5;
      const rank = selected.indexOf(team.id);

      let prefix = rank >= 0 ? `${rank + 1}.` : '  ';
      let suffix = '';
      if (rank === 2 && thirdAdvancing.includes(letter)) suffix = '  [adv]';

      // Color code by rank
      if (rank === 0 || rank === 1) doc.setTextColor(26, 122, 60);
      else if (rank === 2) doc.setTextColor(180, 120, 0);
      else doc.setTextColor(80);

      doc.text(`${prefix} ${team?.name ?? 'TBD'}${suffix}`, x + 2, ty);
      doc.setTextColor(0);
    }
  }

  y += groupH + 6;

  // ── 3rd Place Summary ──
  if (y + 10 > H - margin) { doc.addPage(); y = margin; }
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  const advGroups = thirdAdvancing.length > 0
    ? [...thirdAdvancing].sort().join(', ')
    : 'None selected';
  doc.text(`3rd Place Advancing (${thirdAdvancing.length}/8):  ${advGroups}`, margin, y);
  y += 8;

  // ── Knockout Stage ──
  doc.addPage();
  y = margin;

  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Knockout Stage', margin, y);
  y += 8;

  const bp = picks.bracketPicks ?? {};

  for (const round of ROUND_ORDER) {
    const matches = BRACKET_STRUCTURE.filter(m => m.round === round);
    if (matches.length === 0) continue;

    if (y + 10 > H - margin) { doc.addPage(); y = margin; }

    // Round header
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 122, 60);
    doc.text(ROUND_LABELS[round], margin, y);
    doc.setTextColor(0);
    y += 5;

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');

    // Two-column layout for R32 (16 matches), single for others
    const useTwoCol = round === 'R32';
    const matchColW = useTwoCol ? (W - margin * 2) / 2 : W - margin * 2;

    for (let m = 0; m < matches.length; m++) {
      const match = matches[m];
      const col = useTwoCol ? m % 2 : 0;
      if (useTwoCol && col === 0 && m > 0) y += 4.5;
      if (!useTwoCol && m > 0) y += 4.5;

      if (y + 5 > H - margin) { doc.addPage(); y = margin; }

      const key = `${round}_${match.id}`;
      const pick = bp[key];
      const pickTeam = pick ? TEAMS_BY_ID[pick] : null;
      const sched = MATCH_SCHEDULE[match.id];

      const x = margin + col * matchColW;
      const info = sched ? `M${match.id} ${sched.date}` : `M${match.id}`;
      const pickText = pickTeam ? pickTeam.name : '\u2014';

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100);
      doc.text(info, x + 1, y);
      doc.setTextColor(0);
      doc.setFont('helvetica', 'bold');
      doc.text(pickText, x + 30, y);
      doc.setFont('helvetica', 'normal');
    }
    if (useTwoCol) y += 4.5;
    y += 4;
  }

  // ── Champion & 3rd Place ──
  if (y + 20 > H - margin) { doc.addPage(); y = margin; }
  y += 4;

  doc.setDrawColor(180);
  doc.line(margin, y, W - margin, y);
  y += 6;

  const champPick = bp['F_104'];
  const champTeam = champPick ? TEAMS_BY_ID[champPick] : null;
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Champion:  ${champTeam?.name ?? '\u2014'}`, margin, y);
  y += 7;

  const thirdPick = bp['TPM_103'];
  const thirdTeam = thirdPick ? TEAMS_BY_ID[thirdPick] : null;
  doc.setFontSize(10);
  doc.text(`3rd Place:  ${thirdTeam?.name ?? '\u2014'}`, margin, y);

  // ── Footer on every page ──
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(150);
    doc.text('wc.k61.dev', W / 2, H - 5, { align: 'center' });
    doc.text(`Page ${p} of ${totalPages}`, W - margin, H - 5, { align: 'right' });
    doc.setTextColor(0);
  }

  // Save
  const safeName = name.replace(/[^a-zA-Z0-9]/g, '');
  doc.save(`world-cup-2026-picks${safeName ? '-' + safeName : ''}.pdf`);
}
