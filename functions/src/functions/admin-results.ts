import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAdmin, AuthError } from '../shared/auth.js';
import { getEntity, upsertEntity, listEntitiesByPartition } from '../shared/storage.js';
import { ResultEntity, PicksEntity, ScoreEntity, Results } from '../shared/types.js';

// Scoring constants (matching docs/rules.md)
const POINTS = {
  GROUP_EXACT_POSITION: 3,       // Exact group final position (1st, 2nd, 3rd, or 4th)
  GROUP_CORRECT_ADVANCE: 1,      // Top 2 teams that advance but wrong position
  THIRD_PLACE_CORRECT: 2,        // Correctly predicted a 3rd-place team advances
  R32_FULL: 2,
  R32_PARTIAL: 1,
  R16_FULL: 4,
  R16_PARTIAL: 2,
  QF_FULL: 8,
  QF_PARTIAL: 4,
  SF_FULL: 16,
  SF_PARTIAL: 8,
  TPM_FULL: 16,                  // Third-place match
  TPM_PARTIAL: 8,
  FINAL_FULL: 32,
  FINAL_PARTIAL: 16,
};

// POST /api/admin/results — enter or update match results
app.http('adminSetResults', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'admin/results',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      requireAdmin(request);

      const body = await request.json() as {
        groupStandings?: Record<string, string[]>;
        advancing3rdPlace?: string[];
        matchResults?: Record<string, { winner: string; loser: string; score?: string }>;
      };

      if (!body.groupStandings || !body.advancing3rdPlace || !body.matchResults) {
        return { status: 400, jsonBody: { error: 'groupStandings, advancing3rdPlace, and matchResults are required' } };
      }

      const now = new Date().toISOString();
      const user = (request.headers.get('x-ms-client-principal')
        ? JSON.parse(Buffer.from(request.headers.get('x-ms-client-principal')!, 'base64').toString())
        : { userId: 'unknown' }) as { userId?: string };

      const resultsData: Results = {
        groupStandings: body.groupStandings,
        advancing3rdPlace: body.advancing3rdPlace,
        matchResults: body.matchResults,
        updatedAt: now,
      };

      await upsertEntity<ResultEntity>('Results', 'results', 'current', {
        data: JSON.stringify(resultsData),
        enteredBy: user.userId ?? 'unknown',
        enteredAt: now,
      });

      return { status: 200, jsonBody: { updatedAt: now } };
    } catch (err) {
      if (err instanceof AuthError) {
        return { status: err.statusCode, jsonBody: { error: err.message } };
      }
      throw err;
    }
  },
});

// POST /api/admin/recalculate — recalculate all user scores
app.http('adminRecalculate', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'admin/recalculate',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      requireAdmin(request);

      // Load results
      const resultsEntity = await getEntity<ResultEntity>('Results', 'results', 'current');
      if (!resultsEntity) {
        return { status: 400, jsonBody: { error: 'No results entered yet' } };
      }
      const results: Results = JSON.parse(resultsEntity.data);

      // Load all locked picks
      const picksTable = await import('../shared/storage.js').then((m) => m.picksTable());
      const allPicks: Array<{ userId: string; picks: PicksEntity }> = [];

      for await (const entity of picksTable.listEntities<PicksEntity>()) {
        if (entity.rowKey === 'picks' && entity.lockedAt) {
          allPicks.push({
            userId: entity.partitionKey!,
            picks: entity as unknown as PicksEntity,
          });
        }
      }

      const now = new Date().toISOString();
      let recalcCount = 0;

      for (const { userId, picks } of allPicks) {
        const score = calculateScore(picks, results);
        await upsertEntity<ScoreEntity>('Scores', 'global', userId, {
          ...score,
          calculatedAt: now,
        });
        recalcCount++;
      }

      return { status: 200, jsonBody: { recalculated: recalcCount, calculatedAt: now } };
    } catch (err) {
      if (err instanceof AuthError) {
        return { status: err.statusCode, jsonBody: { error: err.message } };
      }
      throw err;
    }
  },
});

function calculateScore(picks: PicksEntity, results: Results): Omit<ScoreEntity, 'calculatedAt'> {
  let groupPoints = 0;
  let thirdPlacePoints = 0;
  let knockoutPoints = 0;
  const breakdown: Record<string, number> = {};

  // === GROUP STAGE SCORING ===
  try {
    const groupPicks = JSON.parse(picks.groupPicks || '{}') as Record<string, string[]>;
    // thirdPlaceAdvancing stores GROUP LETTERS (e.g. ["A","C","E",...]) — which groups'
    // 3rd-place team the user predicted would qualify as one of the 8 advancing teams.
    const thirdPlaceGroups = new Set(JSON.parse(picks.thirdPlaceAdvancing || '[]') as string[]);
    // advancing3rdPlace stores TEAM IDs of the 8 teams that actually advanced.
    const advancing3rdSet = new Set(results.advancing3rdPlace);
    const { groupStandings } = results;

    for (const [groupId, predictedOrder] of Object.entries(groupPicks)) {
      const actualOrder = groupStandings[groupId];
      if (!actualOrder) continue;

      for (let pos = 0; pos < 4; pos++) {
        const predictedTeam = predictedOrder[pos];
        if (!predictedTeam) continue;

        // 4th place never scores (rules: "4th place — no points regardless of correctness")
        if (pos === 3) continue;

        const actualPos = actualOrder.indexOf(predictedTeam);
        if (actualPos === -1) continue;

        if (actualPos === pos) {
          // Exact position match (positions 1st, 2nd, or 3rd)
          groupPoints += POINTS.GROUP_EXACT_POSITION;
          breakdown[`group_${groupId}_pos${pos + 1}_exact`] = POINTS.GROUP_EXACT_POSITION;
          continue;
        }

        // Did the user predict this team would advance?
        //   Picking 1st or 2nd = predicting top-2 advance.
        //   Picking 3rd AND checking the advance box = predicting qualifying 3rd-place advance.
        const userPredictedAdvance =
          pos < 2 ||
          (pos === 2 && thirdPlaceGroups.has(groupId));

        if (!userPredictedAdvance) continue;

        // Did the team actually advance?
        const teamActuallyAdvanced =
          actualPos < 2 ||                                       // finished top 2
          (actualPos === 2 && advancing3rdSet.has(predictedTeam)); // finished 3rd + is one of 8

        if (teamActuallyAdvanced) {
          groupPoints += POINTS.GROUP_CORRECT_ADVANCE;
          breakdown[`group_${groupId}_pos${pos + 1}_advance`] = POINTS.GROUP_CORRECT_ADVANCE;
        }
      }
    }
  } catch { /* ignore parse errors */ }

  // === 3RD-PLACE ADVANCEMENT SCORING ===
  // picks.thirdPlaceAdvancing = group letters; results.advancing3rdPlace = team IDs.
  // Convert via groupStandings to compare correctly.
  try {
    const predicted3rdGroups = JSON.parse(picks.thirdPlaceAdvancing || '[]') as string[];
    const advancing3rdSet = new Set(results.advancing3rdPlace);
    const { groupStandings } = results;

    for (const groupLetter of predicted3rdGroups) {
      // Find which team actually finished 3rd in this group
      const actualThirdTeam = groupStandings[groupLetter]?.[2];
      if (actualThirdTeam && advancing3rdSet.has(actualThirdTeam)) {
        thirdPlacePoints += POINTS.THIRD_PLACE_CORRECT;
        breakdown[`3rd_advance_${groupLetter}`] = POINTS.THIRD_PLACE_CORRECT;
      }
    }
  } catch { /* ignore parse errors */ }

  // === KNOCKOUT STAGE SCORING ===
  try {
    const bracketPicks = JSON.parse(picks.bracketPicks || '{}') as Record<string, string>;
    const { matchResults } = results;

    // Build a map of team → set of rounds they won in (for partial credit)
    const roundMap = buildRoundMap(matchResults);

    for (const [slot, predictedWinner] of Object.entries(bracketPicks)) {
      // slot format: "R32_74", "R16_89", "QF_97", "SF_101", "TPM_102", "F_103"
      const [roundName, slotNum] = slot.split('_');
      const matchKey = `M${slotNum}`;
      const result = matchResults[matchKey];
      
      if (!result) continue;

      const actualWinner = result.winner;
      const roundPoints = getRoundPoints(roundName);

      if (actualWinner === predictedWinner) {
        // Full credit: team won in the exact slot
        knockoutPoints += roundPoints.full;
        breakdown[`ko_${slot}_full`] = roundPoints.full;
      } else if (roundMap[predictedWinner]?.has(getRoundForSlot(roundName))) {
        // Partial credit: team won a match in this round, but different slot
        knockoutPoints += roundPoints.partial;
        breakdown[`ko_${slot}_partial`] = roundPoints.partial;
      }
    }
  } catch { /* ignore parse errors */ }

  const totalPoints = groupPoints + thirdPlacePoints + knockoutPoints;

  return {
    totalPoints,
    groupPoints,
    thirdPlacePoints,
    knockoutPoints,
    breakdown: JSON.stringify(breakdown),
  };
}

/** Build a map of team → set of rounds they won in */
function buildRoundMap(matchResults: Record<string, { winner: string; loser: string }>): Record<string, Set<string>> {
  const roundMap: Record<string, Set<string>> = {};

  for (const [matchKey, result] of Object.entries(matchResults)) {
    const round = getRoundFromMatchKey(matchKey);
    if (!round) continue;

    const team = result.winner;
    if (!roundMap[team]) {
      roundMap[team] = new Set();
    }
    roundMap[team].add(round);
  }

  return roundMap;
}

/** Map match number to round name (based on FIFA bracket structure) */
function getRoundFromMatchKey(matchKey: string): string | null {
  const mNum = parseInt(matchKey.replace('M', ''));
  if (isNaN(mNum)) return null;

  // M1-M48: Group stage (not used in knockout scoring)
  // M73-M88: Round of 32 (16 matches)
  // M89-M96: Round of 16 (8 matches)
  // M97-M100: Quarterfinals (4 matches)
  // M101-M102: Semifinals (2 matches)
  // M103: Third-place match
  // M104: Final

  if (mNum >= 73 && mNum <= 88) return 'R32';
  if (mNum >= 89 && mNum <= 96) return 'R16';
  if (mNum >= 97 && mNum <= 100) return 'QF';
  if (mNum >= 101 && mNum <= 102) return 'SF';
  if (mNum === 103) return 'TPM';
  if (mNum === 104) return 'F';

  return null;
}

/** Get round from slot name */
function getRoundForSlot(roundName: string): string {
  return roundName; // R32, R16, QF, SF, TPM, F
}

/** Get full and partial credit points for a round */
function getRoundPoints(roundName: string): { full: number; partial: number } {
  switch (roundName) {
    case 'R32': return { full: POINTS.R32_FULL, partial: POINTS.R32_PARTIAL };
    case 'R16': return { full: POINTS.R16_FULL, partial: POINTS.R16_PARTIAL };
    case 'QF': return { full: POINTS.QF_FULL, partial: POINTS.QF_PARTIAL };
    case 'SF': return { full: POINTS.SF_FULL, partial: POINTS.SF_PARTIAL };
    case 'TPM': return { full: POINTS.TPM_FULL, partial: POINTS.TPM_PARTIAL };
    case 'F': return { full: POINTS.FINAL_FULL, partial: POINTS.FINAL_PARTIAL };
    default: return { full: 0, partial: 0 };
  }
}
