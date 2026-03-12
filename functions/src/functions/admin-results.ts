import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAdmin, AuthError } from '../shared/auth.js';
import { getEntity, upsertEntity, deleteEntity, listEntitiesByPartition } from '../shared/storage.js';
import { ResultEntity, PicksEntity, ScoreEntity, UserEntity, Results } from '../shared/types.js';
import { calculateScore, calculateMaxPossible } from '../shared/scoring.js';

// POST /api/manage/results — enter or update match results
app.http('adminSetResults', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'manage/results',
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

// POST /api/manage/recalculate — recalculate all user scores
app.http('adminRecalculate', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'manage/recalculate',
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
        const maxPossiblePoints = calculateMaxPossible(picks, results, score);
        await upsertEntity<ScoreEntity>('Scores', 'global', userId, {
          ...score,
          maxPossiblePoints,
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

// POST /api/manage/lock-all — force-lock all users' picks that are not already locked
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
  route: 'manage/lock-all',
  handler: adminLockAllHandler,
});

// POST /api/manage/unlock-all — clear lockedAt on all users' picks
export async function adminUnlockAllHandler(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  try {
    requireAdmin(request);

    const table = await import('../shared/storage.js').then((m) => m.picksTable());
    const now = new Date().toISOString();
    let unlocked = 0;
    let skipped = 0;

    for await (const entity of table.listEntities<PicksEntity>()) {
      if (entity.rowKey !== 'picks') continue;
      if (!entity.lockedAt) {
        skipped++;
        continue;
      }

      await upsertEntity<PicksEntity>('Picks', entity.partitionKey!, 'picks', {
        groupPicks: entity.groupPicks,
        thirdPlaceAdvancing: entity.thirdPlaceAdvancing,
        bracketPicks: entity.bracketPicks,
        lockedAt: null,
        updatedAt: now,
      });
      unlocked++;
    }

    return { status: 200, jsonBody: { unlocked, skipped } };
  } catch (err) {
    if (err instanceof AuthError) {
      return { status: err.statusCode, jsonBody: { error: err.message } };
    }
    return { status: 500, jsonBody: { error: err instanceof Error ? err.message : 'Unknown error' } };
  }
}

app.http('adminUnlockAll', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'manage/unlock-all',
  handler: adminUnlockAllHandler,
});

// DELETE /api/manage/results — clear all results
app.http('adminClearResults', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'manage/results',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      requireAdmin(request);

      await deleteEntity('Results', 'results', 'current');

      return { status: 200, jsonBody: { cleared: true } };
    } catch (err) {
      if (err instanceof AuthError) {
        return { status: err.statusCode, jsonBody: { error: err.message } };
      }
      return { status: 500, jsonBody: { error: err instanceof Error ? err.message : 'Unknown error' } };
    }
  },
});

// GET /api/manage/users — list all users with picks
app.http('adminListUsers', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'manage/users',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      requireAdmin(request);

      const table = await import('../shared/storage.js').then((m) => m.picksTable());
      const users: Array<{ userId: string; displayName: string; isLocked: boolean; updatedAt: string }> = [];

      for await (const entity of table.listEntities<PicksEntity>()) {
        if (entity.rowKey !== 'picks') continue;
        // Try to get display name from Users table
        const userEntity = await getEntity<UserEntity>('Users', 'user', entity.partitionKey!);
        users.push({
          userId: entity.partitionKey!,
          displayName: userEntity?.displayName || entity.partitionKey!,
          isLocked: !!entity.lockedAt,
          updatedAt: entity.updatedAt,
        });
      }

      users.sort((a, b) => a.displayName.localeCompare(b.displayName));

      return { status: 200, jsonBody: users };
    } catch (err) {
      if (err instanceof AuthError) {
        return { status: err.statusCode, jsonBody: { error: err.message } };
      }
      return { status: 500, jsonBody: { error: err instanceof Error ? err.message : 'Unknown error' } };
    }
  },
});

// DELETE /api/manage/picks/:userId — delete a user's picks and score
app.http('adminDeletePicks', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'manage/picks/{userId}',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      requireAdmin(request);

      const userId = request.params.userId;
      if (!userId) {
        return { status: 400, jsonBody: { error: 'userId is required' } };
      }

      const deletedPicks = await deleteEntity('Picks', userId, 'picks');
      const deletedScore = await deleteEntity('Scores', 'global', userId);

      return { status: 200, jsonBody: { deletedPicks, deletedScore } };
    } catch (err) {
      if (err instanceof AuthError) {
        return { status: err.statusCode, jsonBody: { error: err.message } };
      }
      return { status: 500, jsonBody: { error: err instanceof Error ? err.message : 'Unknown error' } };
    }
  },
});
