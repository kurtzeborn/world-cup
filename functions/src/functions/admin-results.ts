import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAdmin, AuthError } from '../shared/auth.js';
import { getEntity, upsertEntity, listEntitiesByPartition } from '../shared/storage.js';
import { ResultEntity, PicksEntity, ScoreEntity, Results } from '../shared/types.js';
import { calculateScore } from '../shared/scoring.js';

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
