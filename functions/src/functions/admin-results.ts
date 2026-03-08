import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAdmin, AuthError } from '../shared/auth.js';
import { getEntity, upsertEntity, listEntitiesByPartition } from '../shared/storage.js';
import { ResultEntity, PicksEntity, ScoreEntity } from '../shared/types.js';

// Scoring constants
const POINTS = {
  GROUP_CORRECT_ADVANCE: 1,      // Correctly predicted a team advances from their group
  THIRD_PLACE_CORRECT: 2,        // Correctly predicted which 8 third-place teams advance
  KNOCKOUT_CORRECT_WINNER: 2,    // Correctly predicted the winner of a knockout match
  KNOCKOUT_CORRECT_FINALIST: 1,  // Picked a team that reached but lost in that round
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
        matchResults?: Record<string, { winner: string; loser: string; score?: string }>;
      };

      if (!body.matchResults || typeof body.matchResults !== 'object') {
        return { status: 400, jsonBody: { error: 'matchResults object is required' } };
      }

      const now = new Date().toISOString();
      const user = (request.headers.get('x-ms-client-principal')
        ? JSON.parse(Buffer.from(request.headers.get('x-ms-client-principal')!, 'base64').toString())
        : { userId: 'unknown' }) as { userId?: string };

      await upsertEntity<ResultEntity>('Results', 'results', 'current', {
        data: JSON.stringify({ matchResults: body.matchResults, updatedAt: now }),
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
      const { matchResults } = JSON.parse(resultsEntity.data) as {
        matchResults: Record<string, { winner: string; loser: string }>;
      };

      // Load all locked picks — iterate Picks table
      // PartitionKey is userId, rowKey is 'picks'
      // We use a scan approach: list all entities in Picks table
      const client = await import('../shared/storage.js')
        .then((m) => m.picksTable());
      const allPicks: Array<{ userId: string; picks: PicksEntity }> = [];

      for await (const entity of client.listEntities<PicksEntity>()) {
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
        const score = calculateScore(picks, matchResults);
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

function calculateScore(
  picks: PicksEntity,
  matchResults: Record<string, { winner: string; loser: string }>
): Omit<ScoreEntity, 'calculatedAt'> {
  let groupPoints = 0;
  let thirdPlacePoints = 0;
  let knockoutPoints = 0;
  const breakdown: Record<string, number> = {};

  // Score group stage picks
  try {
    const groupPicks = JSON.parse(picks.groupPicks || '{}') as Record<string, string[]>;

    // For each group match result, check which teams were predicted to advance
    // matchResults keys for group stage: "M1"-"M48"
    // We compute which teams actually advanced per group from results
    const actualAdvanced = new Set<string>();
    for (const [matchId, result] of Object.entries(matchResults)) {
      const mNum = parseInt(matchId.replace('M', ''));
      if (mNum >= 1 && mNum <= 48) {
        actualAdvanced.add(result.winner);
      }
    }

    for (const [_group, predicted] of Object.entries(groupPicks)) {
      for (const teamId of predicted.slice(0, 2)) {
        if (actualAdvanced.has(teamId)) {
          groupPoints += POINTS.GROUP_CORRECT_ADVANCE;
          breakdown[`group_${teamId}`] = POINTS.GROUP_CORRECT_ADVANCE;
        }
      }
    }
  } catch { /* ignore parse errors */ }

  // Score third-place advancing picks
  try {
    const predicted3rd = JSON.parse(picks.thirdPlaceAdvancing || '[]') as string[];
    // actual 3rd-place teams that advanced
    const actual3rdAdvanced = new Set<string>();
    for (const [matchId, result] of Object.entries(matchResults)) {
      const mNum = parseInt(matchId.replace('M', ''));
      if (mNum >= 1 && mNum <= 48) {
        actual3rdAdvanced.add(result.loser);
      }
    }

    // Filter to only the 8 advancing (from group 3rd-place positions in R32)
    // For simplicity, any predicted 3rd-place team that appears in actual R32 results wins points
    const r32Participants = new Set<string>();
    for (const [matchId, result] of Object.entries(matchResults)) {
      const mNum = parseInt(matchId.replace('M', ''));
      if (mNum >= 73 && mNum <= 88) {
        r32Participants.add(result.winner);
        r32Participants.add(result.loser);
      }
    }

    for (const teamId of predicted3rd) {
      if (r32Participants.has(teamId)) {
        thirdPlacePoints += POINTS.THIRD_PLACE_CORRECT;
        breakdown[`3rd_${teamId}`] = POINTS.THIRD_PLACE_CORRECT;
      }
    }
  } catch { /* ignore parse errors */ }

  // Score knockout bracket picks
  try {
    const bracketPicks = JSON.parse(picks.bracketPicks || '{}') as Record<string, string>;

    for (const [slot, predictedWinner] of Object.entries(bracketPicks)) {
      // slot format: "R32_74", "R16_89", "QF_97", "SF_101", "F_104"
      const matchKey = `M${slot.split('_')[1]}`;
      const result = matchResults[matchKey];
      if (!result) continue;

      if (result.winner === predictedWinner) {
        knockoutPoints += POINTS.KNOCKOUT_CORRECT_WINNER;
        breakdown[`ko_${slot}`] = POINTS.KNOCKOUT_CORRECT_WINNER;
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
