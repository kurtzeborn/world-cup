import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, AuthError } from '../shared/auth.js';
import { getEntity, upsertEntity } from '../shared/storage.js';
import { PicksEntity, UserEntity, isLocked, getLockDeadline } from '../shared/types.js';

// GET /api/picks — get current user's picks
app.http('getPicks', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'picks',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const user = requireAuth(request);
      const entity = await getEntity<PicksEntity>('Picks', user.userId, 'picks');
      const locked = !!entity?.lockedAt || isLocked();

      // Include score data when picks are locked
      let score: { totalPoints: number; maxPossiblePoints: number } | null = null;
      if (locked) {
        const userEntity = await getEntity<UserEntity>('Users', 'user', user.userId);
        if (userEntity?.totalPoints != null) {
          score = {
            totalPoints: userEntity.totalPoints,
            maxPossiblePoints: userEntity.maxPossiblePoints ?? 0,
          };
        }
      }

      return {
        status: 200,
        jsonBody: entity
          ? {
              groupPicks: JSON.parse(entity.groupPicks || '{}'),
              thirdPlaceAdvancing: JSON.parse(entity.thirdPlaceAdvancing || '[]'),
              bracketPicks: JSON.parse(entity.bracketPicks || '{}'),
              lockedAt: entity.lockedAt ?? null,
              updatedAt: entity.updatedAt,
              isLocked: locked,
              score,
            }
          : {
              groupPicks: {},
              thirdPlaceAdvancing: [],
              bracketPicks: {},
              lockedAt: null,
              updatedAt: null,
              isLocked: isLocked(),
              score: null,
            },
      };
    } catch (err) {
      if (err instanceof AuthError) {
        return { status: err.statusCode, jsonBody: { error: err.message } };
      }
      throw err;
    }
  },
});

// PUT /api/picks — auto-save draft picks
app.http('savePicks', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'picks',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const user = requireAuth(request);

      // Check if deadline has passed
      if (isLocked()) {
        return { status: 403, jsonBody: { error: 'Lock deadline has passed — picks can no longer be modified' } };
      }

      // Check if already locked by user
      const existing = await getEntity<PicksEntity>('Picks', user.userId, 'picks');
      if (existing?.lockedAt) {
        return { status: 409, jsonBody: { error: 'Picks are locked and cannot be modified' } };
      }

      const body = await request.json() as {
        groupPicks?: Record<string, string[]>;
        thirdPlaceAdvancing?: string[];
        bracketPicks?: Record<string, string>;
      };

      const now = new Date().toISOString();
      await upsertEntity<PicksEntity>('Picks', user.userId, 'picks', {
        groupPicks: JSON.stringify(body.groupPicks ?? {}),
        thirdPlaceAdvancing: JSON.stringify(body.thirdPlaceAdvancing ?? []),
        bracketPicks: JSON.stringify(body.bracketPicks ?? {}),
        lockedAt: null,
        updatedAt: now,
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

// POST /api/picks/lock — lock picks (one-way)
export async function lockPicksHandler(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  try {
    const user = requireAuth(request);

    // Already past lock deadline — system locks picks automatically
    const deadline = getLockDeadline();

    const existing = await getEntity<PicksEntity>('Picks', user.userId, 'picks');
    if (!existing) {
      return { status: 400, jsonBody: { error: 'No picks to lock' } };
    }
    if (existing.lockedAt) {
      return { status: 200, jsonBody: { lockedAt: existing.lockedAt } };
    }

    const now = new Date().toISOString();
    await upsertEntity<PicksEntity>('Picks', user.userId, 'picks', {
      groupPicks: existing.groupPicks,
      thirdPlaceAdvancing: existing.thirdPlaceAdvancing,
      bracketPicks: existing.bracketPicks,
      lockedAt: now,
      updatedAt: now,
    });

    return { status: 200, jsonBody: { lockedAt: now, deadline: deadline.toISOString() } };
  } catch (err) {
    if (err instanceof AuthError) {
      return { status: err.statusCode, jsonBody: { error: err.message } };
    }
    throw err;
  }
}

app.http('lockPicks', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'picks/lock',
  handler: lockPicksHandler,
});

// GET /api/picks/:userId — view another user's picks (post-lock only)
export async function getPicksForUserHandler(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  try {
    requireAuth(request);

    if (!isLocked()) {
      return { status: 403, jsonBody: { error: 'Picks are not yet visible before the lock deadline' } };
    }

    const targetUserId = request.params.userId;
    const entity = await getEntity<PicksEntity>('Picks', targetUserId, 'picks');
    if (!entity || !entity.lockedAt) {
      return { status: 404, jsonBody: { error: 'No locked picks found for this user' } };
    }

    // Include score data
    const userEntity = await getEntity<UserEntity>('Users', 'user', targetUserId);
    const score = userEntity?.totalPoints != null
      ? { totalPoints: userEntity.totalPoints, maxPossiblePoints: userEntity.maxPossiblePoints ?? 0 }
      : null;

    return {
      status: 200,
      jsonBody: {
        groupPicks: JSON.parse(entity.groupPicks || '{}'),
        thirdPlaceAdvancing: JSON.parse(entity.thirdPlaceAdvancing || '[]'),
        bracketPicks: JSON.parse(entity.bracketPicks || '{}'),
        lockedAt: entity.lockedAt,
        score,
      },
    };
  } catch (err) {
    if (err instanceof AuthError) {
      return { status: err.statusCode, jsonBody: { error: err.message } };
    }
    throw err;
  }
}

app.http('getPicksForUser', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'picks/{userId}',
  handler: getPicksForUserHandler,
});
