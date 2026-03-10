import { describe, it, expect } from 'vitest';
import { calculateScore } from '../shared/scoring.js';
import type { PicksEntity, Results } from '../shared/types.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makePicks(partial: Partial<{
  groupPicks: Record<string, string[]>;
  thirdPlaceAdvancing: string[];
  bracketPicks: Record<string, string>;
}>): PicksEntity {
  return {
    groupPicks: JSON.stringify(partial.groupPicks ?? {}),
    thirdPlaceAdvancing: JSON.stringify(partial.thirdPlaceAdvancing ?? []),
    bracketPicks: JSON.stringify(partial.bracketPicks ?? {}),
    lockedAt: '2026-03-09T00:00:00Z',
    updatedAt: '2026-03-09T00:00:00Z',
  };
}

function makeResults(partial: Partial<Results>): Results {
  return {
    groupStandings: {},
    advancing3rdPlace: [],
    matchResults: {},
    ...partial,
  };
}

// Single group scenario helper — fills all other groups as empty so only group A scores
function singleGroupPicks(groupA: string[], advanceGroupA: boolean): PicksEntity {
  return makePicks({
    groupPicks: { A: groupA },
    thirdPlaceAdvancing: advanceGroupA ? ['A'] : [],
  });
}

function singleGroupResults(groupA: string[], advancing3rdPlace: string[]): Results {
  return makeResults({
    groupStandings: { A: groupA },
    advancing3rdPlace,
  });
}

// ─── Group Stage Tests ───────────────────────────────────────────────────────

describe('calculateScore — Group Stage', () => {

  // T1: Perfect group order
  it('T1 — exact order awards 9 points (3 scored positions × 3 pts each)', () => {
    // picks: MEX 1st, RSA 2nd, KOR 3rd (advance box unchecked), UEFA-D 4th
    // actual: MEX 1st, RSA 2nd, KOR 3rd, UEFA-D 4th
    // KOR not advancing (advance box unchecked, and game hasn't selected KOR either)
    const picks = singleGroupPicks(['MEX', 'RSA', 'KOR', 'UEFA-D'], false);
    const results = singleGroupResults(['MEX', 'RSA', 'KOR', 'UEFA-D'], []);

    const score = calculateScore(picks, results);

    // pos0 MEX exact=3, pos1 RSA exact=3, pos2 KOR exact=3, pos3 skip
    expect(score.groupPoints).toBe(9);
    expect(score.thirdPlacePoints).toBe(0);
    expect(score.knockoutPoints).toBe(0);
    expect(score.totalPoints).toBe(9);
  });

  // T2: Top-2 swapped
  it('T2 — top-2 swap awards 5 points (1+1+3)', () => {
    // picks: RSA 1st, MEX 2nd, KOR 3rd (advance box checked), UEFA-D 4th
    // actual: MEX 1st, RSA 2nd, KOR 3rd (KOR advances as 3rd-place qualifier)
    const picks = singleGroupPicks(['RSA', 'MEX', 'KOR', 'UEFA-D'], true);
    const results = singleGroupResults(['MEX', 'RSA', 'KOR', 'UEFA-D'], ['KOR']);

    const score = calculateScore(picks, results);

    // RSA picked 1st, actually 2nd: userPred=advance(pos<2=true), actualAdv=actual<2=true → 1 pt
    // MEX picked 2nd, actually 1st: userPred=advance(pos<2=true), actualAdv=actual<2=true → 1 pt
    // KOR picked 3rd + advance checked, actually 3rd + advancing → exact(3) → 3 pts
    // UEFA-D pos3 → skip
    expect(score.groupPoints).toBe(5);
    // T2 uses advance box checked on group A, but KOR is the 3rd-place team in standings
    // and KOR is in advancing3rdPlace, so thirdPlacePoints should be 2
    expect(score.thirdPlacePoints).toBe(2);
    expect(score.totalPoints).toBe(7);
  });

  // T3: User picks 2nd-place finish, team actually advancing as 3rd-place qualifier
  it('T3 — top-2 pick advances as 3rd-place qualifier: 5 group pts (3+1+1)', () => {
    // picks: MEX 1st, KOR 2nd, RSA 3rd (advance box checked), UEFA-D 4th
    // actual: MEX 1st, RSA 2nd, KOR 3rd — KOR advances as 3rd-place qualifier
    const picks = singleGroupPicks(['MEX', 'KOR', 'RSA', 'UEFA-D'], true);
    const results = singleGroupResults(['MEX', 'RSA', 'KOR', 'UEFA-D'], ['KOR']);

    const score = calculateScore(picks, results);

    // MEX picked 1st, actually 1st → exact(3)
    // KOR picked 2nd (pos<2→advance predicted), actually 3rd in standings but IS in advancing3rdSet → teamActuallyAdvanced=true → 1 pt
    // RSA picked 3rd + advance box checked for A → userPredictedAdvance=true; actually 2nd → actualPos<2=true → 1 pt
    // UEFA-D pos3 → skip
    expect(score.groupPoints).toBe(5);
    // advance box is for group A; KOR is 3rd in standings and in advancing3rdSet → thirdPlacePoints=2
    expect(score.thirdPlacePoints).toBe(2);
    expect(score.totalPoints).toBe(7);
  });

  // T4: User picks 3rd+advance, team actually finishes 2nd
  it('T4 — 3rd-place+advance pick finishes top-2, others wrong: 3 group pts (1+1+1)', () => {
    // picks: RSA 1st, KOR 2nd, MEX 3rd (advance checked), UEFA-D 4th
    // actual: MEX 1st, RSA 2nd, KOR 3rd — KOR advances as 3rd-place qualifier
    const picks = singleGroupPicks(['RSA', 'KOR', 'MEX', 'UEFA-D'], true);
    const results = singleGroupResults(['MEX', 'RSA', 'KOR', 'UEFA-D'], ['KOR']);

    const score = calculateScore(picks, results);

    // RSA picked 1st, actually 2nd: userPred=advance(true), actualAdv=actual<2=true → 1 pt
    // KOR picked 2nd, actually 3rd + in advancing: userPred=advance(true), actualAdv=true → 1 pt
    // MEX picked 3rd + advance box checked → userPred=true; actually 1st → actualPos<2=true → 1 pt
    // UEFA-D skip
    expect(score.groupPoints).toBe(3);
    // KOR is 3rd in standings and in advancing3rdSet → thirdPlacePoints=2
    expect(score.thirdPlacePoints).toBe(2);
    expect(score.totalPoints).toBe(5);
  });

  // T5: Completely wrong order, advance box unchecked, 3rd-place team does not advance
  it('T5 — completely wrong order, advance unchecked: 0 group pts', () => {
    // picks: UEFA-D 1st, KOR 2nd, RSA 3rd (advance box NOT checked), MEX 4th
    // actual: MEX 1st, RSA 2nd, KOR 3rd — nobody from group A advances as 3rd
    const picks = singleGroupPicks(['UEFA-D', 'KOR', 'RSA', 'MEX'], false);
    const results = singleGroupResults(['MEX', 'RSA', 'KOR', 'UEFA-D'], []);

    const score = calculateScore(picks, results);

    // UEFA-D picked 1st: actualPos=3, not exact; userPred=advance(true), teamAdv=false → 0
    // KOR picked 2nd: actualPos=2, not exact(pos=1); userPred=advance(true), teamAdv=(actualPos<2?no, advancing3rdSet.has(KOR)?no) → 0
    // RSA picked 3rd: userPred=advance(thirdPlaceGroups.has('A')?false) → skip
    // MEX pos3 skip
    expect(score.groupPoints).toBe(0);
    expect(score.thirdPlacePoints).toBe(0);
    expect(score.totalPoints).toBe(0);
  });

});

// ─── 3rd-Place Advancement Scoring ──────────────────────────────────────────

describe('calculateScore — 3rd-Place Advancement', () => {

  // T6: 8 correct third-place predictions (full 16 pts)
  it('T6a — all 8 third-place advancing groups correct: 16 pts', () => {
    // Build 12 groups each with a distinct 3rd-place team
    const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    const groupStandings: Record<string, string[]> = {};
    for (const g of groups) {
      groupStandings[g] = [`T1${g}`, `T2${g}`, `T3${g}`, `T4${g}`];
    }
    // User picks groups A-H as having an advancing 3rd-place team
    // Groups A-H actually advance their 3rd-place team
    const advancing3rdPlace = groups.slice(0, 8).map(g => `T3${g}`); // T3A, T3B, ..., T3H

    const picks = makePicks({
      thirdPlaceAdvancing: groups.slice(0, 8), // A-H
    });
    const results = makeResults({ groupStandings, advancing3rdPlace });

    const score = calculateScore(picks, results);

    expect(score.thirdPlacePoints).toBe(16); // 8 × 2
  });

  it('T6b — 4 out of 8 third-place advancing groups correct: 8 pts', () => {
    const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    const groupStandings: Record<string, string[]> = {};
    for (const g of groups) {
      groupStandings[g] = [`T1${g}`, `T2${g}`, `T3${g}`, `T4${g}`];
    }
    // User picks A-H, but only A-D actually advance their 3rd-place teams
    const advancing3rdPlace = groups.slice(0, 4).map(g => `T3${g}`); // T3A-T3D + 4 from I-L

    const picks = makePicks({
      thirdPlaceAdvancing: groups.slice(0, 8), // A-H
    });
    const results = makeResults({ groupStandings, advancing3rdPlace });

    const score = calculateScore(picks, results);

    expect(score.thirdPlacePoints).toBe(8); // 4 × 2
  });

  it('T6c — 0 correct third-place advancing groups: 0 pts', () => {
    const groups = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    const groupStandings: Record<string, string[]> = {};
    for (const g of groups) {
      groupStandings[g] = [`T1${g}`, `T2${g}`, `T3${g}`, `T4${g}`];
    }
    // User picks A-H, but groups I-L advance their 3rd-place teams instead
    const advancing3rdPlace = groups.slice(8).map(g => `T3${g}`); // T3I-T3L

    const picks = makePicks({
      thirdPlaceAdvancing: groups.slice(0, 8), // A-H
    });
    const results = makeResults({ groupStandings, advancing3rdPlace });

    const score = calculateScore(picks, results);

    expect(score.thirdPlacePoints).toBe(0);
  });

});

// ─── Knockout Stage Tests ────────────────────────────────────────────────────

describe('calculateScore — Knockout Stage', () => {

  // T7: Exact bracket slot — full credit
  it('T7 — exact R32 slot pick: 2 pts', () => {
    const picks = makePicks({
      bracketPicks: { R32_74: 'BRA' },
    });
    const results = makeResults({
      matchResults: { M74: { winner: 'BRA', loser: 'SEN' } },
    });

    const score = calculateScore(picks, results);
    expect(score.knockoutPoints).toBe(2);
  });

  it('T7b — exact QF slot pick: 8 pts', () => {
    const picks = makePicks({
      bracketPicks: { QF_97: 'FRA' },
    });
    const results = makeResults({
      matchResults: { M97: { winner: 'FRA', loser: 'ENG' } },
    });

    const score = calculateScore(picks, results);
    expect(score.knockoutPoints).toBe(8);
  });

  it('T7c — exact Final pick: 32 pts', () => {
    const picks = makePicks({
      bracketPicks: { F_104: 'ARG' },
    });
    const results = makeResults({
      matchResults: { M104: { winner: 'ARG', loser: 'FRA' } },
    });

    const score = calculateScore(picks, results);
    expect(score.knockoutPoints).toBe(32);
  });

  // T8: Team won in same round but different slot — partial credit
  it('T8 — BRA won R32 in M73 but user predicted R32_74: 1 pt partial', () => {
    const picks = makePicks({
      bracketPicks: { R32_74: 'BRA' },
    });
    const results = makeResults({
      matchResults: {
        M73: { winner: 'BRA', loser: 'SEN' }, // BRA won in M73 (R32) not M74
        M74: { winner: 'GER', loser: 'USA' }, // M74 won by GER
      },
    });

    const score = calculateScore(picks, results);
    expect(score.knockoutPoints).toBe(1); // partial credit: BRA did win an R32 match
  });

  it('T8b — partial credit in SF: 8 pts', () => {
    const picks = makePicks({
      bracketPicks: { SF_101: 'ESP' },
    });
    const results = makeResults({
      matchResults: {
        M101: { winner: 'FRA', loser: 'ENG' }, // SF_101 won by FRA
        M102: { winner: 'ESP', loser: 'GER' }, // ESP won the OTHER SF
      },
    });

    const score = calculateScore(picks, results);
    expect(score.knockoutPoints).toBe(8); // partial: ESP won an SF match, just not M101
  });

  // T9: Team eliminated before reaching this round — no credit
  it('T9 — team eliminated before the predicted round: 0 pts', () => {
    const picks = makePicks({
      bracketPicks: { QF_97: 'BRA' },
    });
    // BRA lost in R32, did not reach QF — no entry in matchResults for QF with BRA
    const results = makeResults({
      matchResults: {
        M73: { winner: 'ARG', loser: 'BRA' }, // BRA eliminated in R32
        M97: { winner: 'FRA', loser: 'ENG' }, // QF_97 won by FRA
      },
    });

    const score = calculateScore(picks, results);
    expect(score.knockoutPoints).toBe(0);
  });

  it('T9b — picking wrong team and the predicted team never entered the round: 0 pts', () => {
    const picks = makePicks({
      bracketPicks: { F_104: 'NED' }, // user picks NED to win Final
    });
    const results = makeResults({
      matchResults: {
        M104: { winner: 'FRA', loser: 'ARG' }, // NED not in the final
        // NED also didn't win any other match (no entry)
      },
    });

    const score = calculateScore(picks, results);
    expect(score.knockoutPoints).toBe(0);
  });

  // Multiple knockout picks
  it('accumulates points across multiple bracket slots', () => {
    const picks = makePicks({
      bracketPicks: {
        R32_74: 'BRA',  // exact
        R16_89: 'FRA',  // partial (FRA won M90 not M89)
        QF_98: 'GER',   // 0 (GER not in QF)
      },
    });
    const results = makeResults({
      matchResults: {
        M74: { winner: 'BRA', loser: 'SEN' },   // R32 exact → 2
        M89: { winner: 'ARG', loser: 'ENG' },   // R16_89 won by ARG, not FRA
        M90: { winner: 'FRA', loser: 'ESP' },   // FRA won R16 in M90 → partial for M89 slot → 2
        M98: { winner: 'NED', loser: 'POR' },   // QF_98 won by NED
        // GER is not a winner in any QF match → 0
      },
    });

    const score = calculateScore(picks, results);
    expect(score.knockoutPoints).toBe(4); // 2 (exact R32) + 2 (partial R16) + 0
  });

});

// ─── Perfect Score Test ──────────────────────────────────────────────────────

describe('calculateScore — Perfect Score', () => {

  it('T10 — perfect picks: 300 total points (108 group + 16 third-place + 176 knockout)', () => {
    // 12 groups × 3 teams scored × 3 pts exact = 108 group pts
    // 8 correct 3rd-place advancing groups × 2 pts = 16 third-place pts
    // Knockout: 16×R32_FULL(2) + 8×R16_FULL(4) + 4×QF_FULL(8) + 2×SF_FULL(16) + 1×TPM_FULL(16) + 1×FINAL_FULL(32) = 32+32+32+32+16+32 = 176

    const TEAMS = {
      A: ['A1', 'A2', 'A3', 'A4'],
      B: ['B1', 'B2', 'B3', 'B4'],
      C: ['C1', 'C2', 'C3', 'C4'],
      D: ['D1', 'D2', 'D3', 'D4'],
      E: ['E1', 'E2', 'E3', 'E4'],
      F: ['F1', 'F2', 'F3', 'F4'],
      G: ['G1', 'G2', 'G3', 'G4'],
      H: ['H1', 'H2', 'H3', 'H4'],
      I: ['I1', 'I2', 'I3', 'I4'],
      J: ['J1', 'J2', 'J3', 'J4'],
      K: ['K1', 'K2', 'K3', 'K4'],
      L: ['L1', 'L2', 'L3', 'L4'],
    };

    // 8 groups advance their 3rd-place teams (A-H)
    const advancing3rdPlace = ['A3', 'B3', 'C3', 'D3', 'E3', 'F3', 'G3', 'H3'];

    // User correctly picks exact order for all 12 groups
    // and correctly marks groups A-H as having advancing 3rd-place teams
    const groupPicks: Record<string, string[]> = {};
    for (const [g, teams] of Object.entries(TEAMS)) {
      groupPicks[g] = [...teams];
    }

    // Perfect bracket: R32 M73-M88, R16 M89-M96, QF M97-M100, SF M101-M102, TPM M103, F M104
    // We just need the predicted winner to match the actual winner for every match
    const bracketPicks: Record<string, string> = {};
    const matchResults: Record<string, { winner: string; loser: string }> = {};

    // R32: M73-M88 (16 matches)
    const r32Winners = ['WR32_1','WR32_2','WR32_3','WR32_4','WR32_5','WR32_6','WR32_7','WR32_8',
                        'WR32_9','WR32_10','WR32_11','WR32_12','WR32_13','WR32_14','WR32_15','WR32_16'];
    for (let i = 0; i < 16; i++) {
      const mNum = 73 + i;
      bracketPicks[`R32_${mNum}`] = r32Winners[i];
      matchResults[`M${mNum}`] = { winner: r32Winners[i], loser: `LOSER_R32_${i}` };
    }

    // R16: M89-M96 (8 matches)
    const r16Winners = ['WR16_1','WR16_2','WR16_3','WR16_4','WR16_5','WR16_6','WR16_7','WR16_8'];
    for (let i = 0; i < 8; i++) {
      const mNum = 89 + i;
      bracketPicks[`R16_${mNum}`] = r16Winners[i];
      matchResults[`M${mNum}`] = { winner: r16Winners[i], loser: `LOSER_R16_${i}` };
    }

    // QF: M97-M100 (4 matches)
    const qfWinners = ['WQF_1','WQF_2','WQF_3','WQF_4'];
    for (let i = 0; i < 4; i++) {
      const mNum = 97 + i;
      bracketPicks[`QF_${mNum}`] = qfWinners[i];
      matchResults[`M${mNum}`] = { winner: qfWinners[i], loser: `LOSER_QF_${i}` };
    }

    // SF: M101-M102
    bracketPicks['SF_101'] = 'WSF_1';
    bracketPicks['SF_102'] = 'WSF_2';
    matchResults['M101'] = { winner: 'WSF_1', loser: 'LOSER_SF_1' };
    matchResults['M102'] = { winner: 'WSF_2', loser: 'LOSER_SF_2' };

    // TPM: M103
    bracketPicks['TPM_103'] = 'WTPM';
    matchResults['M103'] = { winner: 'WTPM', loser: 'LOSER_TPM' };

    // Final: M104
    bracketPicks['F_104'] = 'WFINAL';
    matchResults['M104'] = { winner: 'WFINAL', loser: 'LOSER_FINAL' };

    const picks = makePicks({
      groupPicks,
      thirdPlaceAdvancing: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
      bracketPicks,
    });
    const results = makeResults({
      groupStandings: TEAMS as Record<string, string[]>,
      advancing3rdPlace,
      matchResults,
    });

    const score = calculateScore(picks, results);

    expect(score.groupPoints).toBe(108);     // 12 groups × 3 positions × 3 pts
    expect(score.thirdPlacePoints).toBe(16); // 8 × 2 pts
    expect(score.knockoutPoints).toBe(176);  // 32+32+32+32+16+32
    expect(score.totalPoints).toBe(300);
  });

});

// ─── Edge Cases ──────────────────────────────────────────────────────────────

describe('calculateScore — Edge Cases', () => {

  it('handles empty picks gracefully (all zeros)', () => {
    const picks = makePicks({});
    const results = makeResults({});
    const score = calculateScore(picks, results);
    expect(score.totalPoints).toBe(0);
  });

  it('handles missing group in results without crashing', () => {
    const picks = makePicks({ groupPicks: { A: ['MEX', 'RSA', 'KOR', 'UEFA-D'] } });
    // Results has no group A standings
    const results = makeResults({ groupStandings: {} });
    const score = calculateScore(picks, results);
    expect(score.groupPoints).toBe(0);
  });

  it('handles missing match in results without crashing', () => {
    const picks = makePicks({ bracketPicks: { R32_74: 'BRA' } });
    const results = makeResults({ matchResults: {} }); // M74 not present
    const score = calculateScore(picks, results);
    expect(score.knockoutPoints).toBe(0);
  });

  it('returns correct breakdown keys', () => {
    const picks = singleGroupPicks(['MEX', 'RSA', 'KOR', 'UEFA-D'], false);
    const results = singleGroupResults(['MEX', 'RSA', 'KOR', 'UEFA-D'], []);
    const score = calculateScore(picks, results);

    const breakdown = JSON.parse(score.breakdown);
    expect(breakdown['group_A_pos1_exact']).toBe(3);
    expect(breakdown['group_A_pos2_exact']).toBe(3);
    expect(breakdown['group_A_pos3_exact']).toBe(3);
  });

});
