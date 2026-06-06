// Tests for cascadeClearBracketPicks in pages/bracket.js
//
// Match reference (relevant slots):
//   R32_79 : 1A  vs 3P_79   (Group A winner vs 3rd-place team assigned to slot 79)
//   R32_73 : 2A  vs 2B      (Group A runner-up vs Group B runner-up)
//   R32_74 : 1E  vs 3P_74   (Group E winner vs 3rd-place team assigned to slot 74)
//   R16_92 : W79 vs W80     (downstream of R32_79)
//   QF_99  : W91 vs W92     (downstream of R16_92)

import { describe, it, expect } from 'vitest';
import { cascadeClearBracketPicks } from '../pages/bracket.js';

// ─── helpers ────────────────────────────────────────────────

/** Build a groupPicks object with only the specified groups filled in. */
function gp(overrides = {}) {
  return overrides;
}

// ─── no-op cases ────────────────────────────────────────────

describe('cascadeClearBracketPicks — no-op cases', () => {
  it('returns empty object when bracketPicks is empty', () => {
    const result = cascadeClearBracketPicks({}, [], {});
    expect(result).toEqual({});
  });

  it('keeps a valid R32 pick when the group pick is unchanged', () => {
    // 1A = MEX; pick MEX to win R32_79 → still valid
    const result = cascadeClearBracketPicks(
      gp({ A: ['MEX', 'ZAF', 'KOR', 'CZE'] }),
      [],
      { 'R32_79': 'MEX' }
    );
    expect(result).toEqual({ 'R32_79': 'MEX' });
  });

  it('keeps a valid runner-up (2A) R32 pick', () => {
    // 2A = ZAF (index 1); pick ZAF to win R32_73 → still valid
    const result = cascadeClearBracketPicks(
      gp({ A: ['MEX', 'ZAF', 'KOR', 'CZE'] }),
      [],
      { 'R32_73': 'ZAF' }
    );
    expect(result).toEqual({ 'R32_73': 'ZAF' });
  });

  it('keeps a pick for a completely unrelated group/match', () => {
    // R32_74 = 1E vs 3P_74; pick GER (1E) — unaffected by changes to Group A
    const result = cascadeClearBracketPicks(
      gp({ E: ['GER', 'IVC', 'CUR', 'ECU'] }),
      [],
      { 'R32_74': 'GER' }
    );
    expect(result).toEqual({ 'R32_74': 'GER' });
  });
});

// ─── single-pick clearing ────────────────────────────────────

describe('cascadeClearBracketPicks — single pick cleared', () => {
  it('clears R32 pick when group winner changes', () => {
    // 1A was MEX, now ZAF is 1st → R32_79 match has [ZAF, null], MEX not in it
    const result = cascadeClearBracketPicks(
      gp({ A: ['ZAF', 'MEX', 'KOR', 'CZE'] }),
      [],
      { 'R32_79': 'MEX' }
    );
    expect(result).toEqual({});
  });

  it('clears R32 runner-up pick when 1st/2nd swap', () => {
    // 2A was ZAF (index 1), now group is swapped so 2A = MEX; ZAF not in [MEX, null]
    const result = cascadeClearBracketPicks(
      gp({ A: ['ZAF', 'MEX', 'KOR', 'CZE'] }),
      [],
      { 'R32_73': 'ZAF' }
    );
    expect(result).toEqual({});
  });

  it('keeps the new valid pick after a group change', () => {
    // After swap, ZAF is 1A — a pick of ZAF for R32_79 is valid
    const result = cascadeClearBracketPicks(
      gp({ A: ['ZAF', 'MEX', 'KOR', 'CZE'] }),
      [],
      { 'R32_79': 'ZAF' }
    );
    expect(result).toEqual({ 'R32_79': 'ZAF' });
  });
});

// ─── cascade clearing ────────────────────────────────────────

describe('cascadeClearBracketPicks — cascade into later rounds', () => {
  it('clears both R32 pick and downstream R16 pick', () => {
    // R32_79 pick MEX becomes invalid → R16_92 (W79 vs W80) also loses MEX
    const result = cascadeClearBracketPicks(
      gp({ A: ['ZAF', 'MEX', 'KOR', 'CZE'] }),
      [],
      { 'R32_79': 'MEX', 'R16_92': 'MEX' }
    );
    expect(result).toEqual({});
  });

  it('clears R32, R16, and QF picks in a chain', () => {
    // MEX: R32_79 → R16_92 → QF_99 — all depend on the same chain
    const result = cascadeClearBracketPicks(
      gp({ A: ['ZAF', 'MEX', 'KOR', 'CZE'] }),
      [],
      { 'R32_79': 'MEX', 'R16_92': 'MEX', 'QF_99': 'MEX' }
    );
    expect(result).toEqual({});
  });

  it('clears only the affected branch, leaves the other branch intact', () => {
    // R32_74 (Group E pathway) is unaffected by Group A changes
    const result = cascadeClearBracketPicks(
      gp({ A: ['ZAF', 'MEX', 'KOR', 'CZE'], E: ['GER', 'IVC', 'CUR', 'ECU'] }),
      [],
      { 'R32_79': 'MEX', 'R16_92': 'MEX', 'R32_74': 'GER' }
    );
    expect(result).toEqual({ 'R32_74': 'GER' });
  });
});
