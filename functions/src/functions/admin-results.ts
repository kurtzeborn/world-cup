import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAdmin, AuthError } from '../shared/auth.js';
import { getEntity, upsertEntity, listEntitiesByPartition } from '../shared/storage.js';
import { ResultEntity, PicksEntity, ScoreEntity, Results } from '../shared/types.js';

// GET /api/admin/health — diagnostic to verify this file loads
app.http('adminHealth', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'admin/health',
  handler: async (): Promise<HttpResponseInit> => {
    return { status: 200, jsonBody: { ok: true, file: 'admin-results', ts: Date.now() } };
  },
});

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

      if (!body.groupStandings && !body.advancing3rdPlace && !body.matchResults) {
        return { status: 400, jsonBody: { error: 'At least one of groupStandings, advancing3rdPlace, or matchResults is required' } };
      }

      const now = new Date().toISOString();
      const user = (request.headers.get('x-ms-client-principal')
        ? JSON.parse(Buffer.from(request.headers.get('x-ms-client-principal')!, 'base64').toString())
        : { userId: 'unknown' }) as { userId?: string };

      // Load existing results and merge
      const existing = await getEntity<ResultEntity>('Results', 'results', 'current');
      const prev: Results = existing
        ? JSON.parse(existing.data)
        : { groupStandings: {}, advancing3rdPlace: [], matchResults: {} };

      const resultsData: Results = {
        groupStandings: { ...prev.groupStandings, ...body.groupStandings },
        advancing3rdPlace: body.advancing3rdPlace ?? prev.advancing3rdPlace,
        matchResults: { ...prev.matchResults, ...body.matchResults },
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
      return { status: 500, jsonBody: { error: err instanceof Error ? err.message : 'Unknown error' } };
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
        const { calculateScore } = await import('../shared/scoring.js');
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
      return { status: 500, jsonBody: { error: err instanceof Error ? err.message : 'Unknown error' } };
    }
  },
});

// POST /api/admin/lock-all — force-lock all users' picks that are not already locked
export async function adminLockAllHandler(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  try {
    requireAdmin(request);

    const table = await import('../shared/storage.js').then((m) => m.picksTable());
    const now = new Date().toISOString();
    let locked = 0;
    let skipped = 0;

    for await (const entity of table.listEntities<PicksEntity>()) {
      if (entity.rowKey !== 'picks') continue;
      if (entity.lockedAt) {
        skipped++;
        continue;
      }

      await upsertEntity<PicksEntity>('Picks', entity.partitionKey!, 'picks', {
        groupPicks: entity.groupPicks,
        thirdPlaceAdvancing: entity.thirdPlaceAdvancing,
        bracketPicks: entity.bracketPicks,
        lockedAt: now,
        updatedAt: now,
      });
      locked++;
    }

    return { status: 200, jsonBody: { locked, skipped, lockedAt: now } };
  } catch (err) {
    if (err instanceof AuthError) {
      return { status: err.statusCode, jsonBody: { error: err.message } };
    }
    return { status: 500, jsonBody: { error: err instanceof Error ? err.message : 'Unknown error' } };
  }
}

app.http('adminLockAll', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'admin/lock-all',
  handler: adminLockAllHandler,
});
