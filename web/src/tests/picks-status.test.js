// Tests for computeCompleteness in picks-status.js
//
// Total expected picks: 88
//   48 = 12 groups × 4 ranked positions
//    8 = 3rd-place advancing selections (exactly 8 of 12)
//   32 = knockout bracket winners (16 R32 + 8 R16 + 4 QF + 2 SF + 1 TPM + 1 F)

import { describe, it, expect } from 'vitest';
import { computeCompleteness } from '../picks-status.js';

// Fully-ranked arrays for all 12 groups (4 picks each = 48 total)
const ALL_GROUP_PICKS = {
  A: ['MEX', 'ZAF', 'KOR', 'CZE'],
  B: ['CAN', 'BIH', 'QAT', 'SUI'],
  C: ['BRA', 'MAR', 'HTI', 'SCO'],
  D: ['USA', 'PRY', 'AUS', 'TUR'],
  E: ['GER', 'IVC', 'CUR', 'ECU'],
  F: ['NED', 'JPN', 'SWE', 'TUN'],
  G: ['BEL', 'EGY', 'IRN', 'NZL'],
  H: ['ESP', 'CPV', 'KSA', 'URY'],
  I: ['FRA', 'SEN', 'IRQ', 'NOR'],
  J: ['ARG', 'ALG', 'AUT', 'JOR'],
  K: ['POR', 'COD', 'UZB', 'COL'],
  L: ['ENG', 'CRO', 'GHA', 'PAN'],
};

// 8 groups advancing their 3rd-place team
const EIGHT_THIRD_PLACE = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

// All 32 bracket pick keys (one per knockout match)
const ALL_BRACKET_PICKS = Object.fromEntries([
  'R32_73', 'R32_74', 'R32_75', 'R32_76', 'R32_77', 'R32_78',
  'R32_79', 'R32_80', 'R32_81', 'R32_82', 'R32_83', 'R32_84',
  'R32_85', 'R32_86', 'R32_87', 'R32_88',
  'R16_89', 'R16_90', 'R16_91', 'R16_92', 'R16_93', 'R16_94', 'R16_95', 'R16_96',
  'QF_97', 'QF_98', 'QF_99', 'QF_100',
  'SF_101', 'SF_102',
  'TPM_103',
  'F_104',
].map(k => [k, 'TEAM']));  // value just needs to be truthy

// ─── edge cases ────────────────────────────────────────────

describe('computeCompleteness — edge cases', () => {
  it('returns 0/88 for null picks', () => {
    expect(computeCompleteness(null)).toEqual({ done: 0, total: 88 });
  });

  it('returns 0/88 for undefined picks', () => {
    expect(computeCompleteness(undefined)).toEqual({ done: 0, total: 88 });
  });

  it('returns 0/88 for empty picks object', () => {
    expect(computeCompleteness({})).toEqual({ done: 0, total: 88 });
  });

  it('does not count falsy bracket values', () => {
    const picks = {
      bracketPicks: { 'R32_73': null, 'R32_74': '', 'R32_75': 'GER' },
    };
    // Only 'GER' is truthy → bracketDone = 1
    expect(computeCompleteness(picks)).toEqual({ done: 1, total: 88 });
  });
});

// ─── group picks counting ───────────────────────────────────

describe('computeCompleteness — group picks', () => {
  it('counts ranked positions in a single group', () => {
    const picks = { groupPicks: { A: ['MEX', 'ZAF', 'KOR', 'CZE'] } };
    expect(computeCompleteness(picks)).toEqual({ done: 4, total: 88 });
  });

  it('counts only the positions actually filled (partial group)', () => {
    const picks = { groupPicks: { A: ['MEX', 'ZAF'] } };  // only 2 of 4 ranked
    expect(computeCompleteness(picks)).toEqual({ done: 2, total: 88 });
  });

  it('counts all 48 positions when all 12 groups are fully ranked', () => {
    const picks = { groupPicks: ALL_GROUP_PICKS };
    expect(computeCompleteness(picks)).toEqual({ done: 48, total: 88 });
  });
});

// ─── third-place counting ───────────────────────────────────

describe('computeCompleteness — third-place advancing', () => {
  it('counts 3rd-place selections independently of group picks', () => {
    const picks = { thirdPlaceAdvancing: ['A', 'B', 'C'] };
    expect(computeCompleteness(picks)).toEqual({ done: 3, total: 88 });
  });

  it('adds third-place count on top of group picks', () => {
    const picks = {
      groupPicks: ALL_GROUP_PICKS,
      thirdPlaceAdvancing: EIGHT_THIRD_PLACE,
    };
    expect(computeCompleteness(picks)).toEqual({ done: 56, total: 88 });
  });
});

// ─── full completeness ──────────────────────────────────────

describe('computeCompleteness — full 88/88', () => {
  it('returns 88/88 with all groups, third-place, and bracket filled', () => {
    const picks = {
      groupPicks: ALL_GROUP_PICKS,
      thirdPlaceAdvancing: EIGHT_THIRD_PLACE,
      bracketPicks: ALL_BRACKET_PICKS,
    };
    expect(computeCompleteness(picks)).toEqual({ done: 88, total: 88 });
  });

  it('returns less than 88 if any section is incomplete', () => {
    const picks = {
      groupPicks: ALL_GROUP_PICKS,          // 48
      thirdPlaceAdvancing: EIGHT_THIRD_PLACE, // 8
      bracketPicks: { 'R32_73': 'MEX' },    // 1 of 32
    };
    const { done, total } = computeCompleteness(picks);
    expect(total).toBe(88);
    expect(done).toBe(57);
  });
});
