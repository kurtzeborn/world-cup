import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, AuthError } from '../shared/auth.js';
import { getEntity, upsertEntity } from '../shared/storage.js';
import { PicksEntity, isLocked, getLockDeadline } from '../shared/types.js';

// GET /api/picks — get current user's picks
app.http('getPicks', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'picks',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const user = requireAuth(request);
      const entity = await getEntity<PicksEntity>('Picks', user.userId, 'picks');

      return {
        status: 200,
        jsonBody: entity
          ? {
              groupPicks: JSON.parse(entity.groupPicks || '{}'),
              thirdPlaceAdvancing: JSON.parse(entity.thirdPlaceAdvancing || '[]'),
              bracketPicks: JSON.parse(entity.bracketPicks || '{}'),
              lockedAt: entity.lockedAt ?? null,
              updatedAt: entity.updatedAt,
              isLocked: !!entity.lockedAt || isLocked(),
            }
          : {
              groupPicks: {},
              thirdPlaceAdvancing: [],
              bracketPicks: {},
              lockedAt: null,
              updatedAt: null,
              isLocked: isLocked(),
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
app.http('lockPicks', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'picks/lock',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
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

      // Validate completeness
      const groupPicks = JSON.parse(existing.groupPicks || '{}');
      const thirdPlace = JSON.parse(existing.thirdPlaceAdvancing || '[]');
      const bracket = JSON.parse(existing.bracketPicks || '{}');

      const groupCount = Object.keys(groupPicks).length;
      const thirdPlaceCount = thirdPlace.length;
      const bracketCount = Object.keys(bracket).length;

      if (groupCount < 12) {
        return { status: 400, jsonBody: { error: `Must rank all 12 groups (${groupCount}/12 done)` } };
      }
      if (thirdPlaceCount !== 8) {
        return { status: 400, jsonBody: { error: `Must select exactly 8 third-place teams (${thirdPlaceCount}/8 done)` } };
      }
      if (bracketCount < 32) {
        return { status: 400, jsonBody: { error: `Must complete the knockout bracket (${bracketCount}/32 picks done)` } };
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
  },
});

// GET /api/picks/:userId — view another user's picks (post-lock only)
app.http('getPicksForUser', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'picks/{userId}',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
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

      return {
        status: 200,
        jsonBody: {
          groupPicks: JSON.parse(entity.groupPicks || '{}'),
          thirdPlaceAdvancing: JSON.parse(entity.thirdPlaceAdvancing || '[]'),
          bracketPicks: JSON.parse(entity.bracketPicks || '{}'),
          lockedAt: entity.lockedAt,
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
