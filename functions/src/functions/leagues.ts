import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, AuthError } from '../shared/auth.js';
import { getEntity, upsertEntity, listEntitiesByPartition, deleteEntity } from '../shared/storage.js';
import { LeagueEntity, LeagueMemberEntity } from '../shared/types.js';
import { randomBytes } from 'crypto';

const MAX_LEAGUES_PER_USER = 5;

function generateJoinCode(): string {
  // 6-character alphanumeric join code
  return randomBytes(4).toString('base64url').toUpperCase().slice(0, 6);
}

// POST /api/leagues — create a new league
app.http('createLeague', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'leagues',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const user = requireAuth(request);
      const body = await request.json() as { name?: string };

      if (!body.name?.trim()) {
        return { status: 400, jsonBody: { error: 'League name is required' } };
      }

      // Enforce creation limit
      const allLeagues = await listEntitiesByPartition<LeagueEntity>('Leagues', 'leagues');
      const userLeagueCount = allLeagues.filter(l => l.createdBy === user.userId).length;
      if (userLeagueCount >= MAX_LEAGUES_PER_USER) {
        return { status: 400, jsonBody: { error: `You can create a maximum of ${MAX_LEAGUES_PER_USER} leagues` } };
      }

      const leagueId = randomBytes(8).toString('hex');
      const joinCode = generateJoinCode();
      const now = new Date().toISOString();

      await upsertEntity<LeagueEntity>('Leagues', 'leagues', leagueId, {
        name: body.name.trim(),
        joinCode,
        createdBy: user.userId,
        createdAt: now,
      });

      // Auto-join the creator
      await upsertEntity<LeagueMemberEntity>('LeagueMembers', leagueId, user.userId, {
        joinedAt: now,
      });

      return {
        status: 201,
        jsonBody: { leagueId, joinCode, name: body.name.trim(), createdAt: now },
      };
    } catch (err) {
      if (err instanceof AuthError) {
        return { status: err.statusCode, jsonBody: { error: err.message } };
      }
      throw err;
    }
  },
});

// POST /api/leagues/join — join a league by code
app.http('joinLeague', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'leagues/join',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const user = requireAuth(request);
      const body = await request.json() as { joinCode?: string };

      if (!body.joinCode?.trim()) {
        return { status: 400, jsonBody: { error: 'Join code is required' } };
      }

      const code = body.joinCode.trim().toUpperCase();

      // Find league by join code — scan leagues partition
      const allLeagues = await listEntitiesByPartition<LeagueEntity>('Leagues', 'leagues');
      const league = allLeagues.find((l) => l.joinCode === code);

      if (!league) {
        return { status: 404, jsonBody: { error: 'Invalid join code' } };
      }

      const leagueId = league.rowKey!;

      // Check if already a member
      const existing = await getEntity<LeagueMemberEntity>('LeagueMembers', leagueId, user.userId);
      if (existing) {
        return { status: 409, jsonBody: { error: 'Already a member of this league' } };
      }

      const now = new Date().toISOString();

      await upsertEntity<LeagueMemberEntity>('LeagueMembers', leagueId, user.userId, {
        joinedAt: now,
      });

      return {
        status: 200,
        jsonBody: { leagueId, name: league.name, joinedAt: now },
      };
    } catch (err) {
      if (err instanceof AuthError) {
        return { status: err.statusCode, jsonBody: { error: err.message } };
      }
      throw err;
    }
  },
});

// GET /api/leagues — list leagues the current user is in
app.http('getLeagues', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'leagues',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const user = requireAuth(request);

      // Find all leagues this user is a member of by scanning LeagueMembers
      // We use a cross-partition query by filtering on RowKey
      const allLeagues = await listEntitiesByPartition<LeagueEntity>('Leagues', 'leagues');
      const joined: { leagueId: string; name: string; joinCode: string; createdBy: string; joinedAt?: string }[] = [];

      for (const league of allLeagues) {
        const membership = await getEntity<LeagueMemberEntity>('LeagueMembers', league.rowKey!, user.userId);
        if (membership) {
          joined.push({
            leagueId: league.rowKey!,
            name: league.name,
            joinCode: league.joinCode,
            createdBy: league.createdBy,
            joinedAt: membership.joinedAt,
          });
        }
      }

      return { status: 200, jsonBody: joined };
    } catch (err) {
      if (err instanceof AuthError) {
        return { status: err.statusCode, jsonBody: { error: err.message } };
      }
      throw err;
    }
  },
});

// PUT /api/leagues/:leagueId — rename a league (creator only)
app.http('renameLeague', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'leagues/{leagueId}',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const user = requireAuth(request);
      const leagueId = request.params.leagueId;
      const body = await request.json() as { name?: string };

      const name = body.name?.trim();
      if (!name) {
        return { status: 400, jsonBody: { error: 'League name is required' } };
      }

      const league = await getEntity<LeagueEntity>('Leagues', 'leagues', leagueId);
      if (!league) {
        return { status: 404, jsonBody: { error: 'League not found' } };
      }
      if (league.createdBy !== user.userId) {
        return { status: 403, jsonBody: { error: 'Only the league creator can rename it' } };
      }

      await upsertEntity<LeagueEntity>('Leagues', 'leagues', leagueId, {
        name,
        joinCode: league.joinCode,
        createdBy: league.createdBy,
        createdAt: league.createdAt,
      });

      return { status: 200, jsonBody: { name } };
    } catch (err) {
      if (err instanceof AuthError) {
        return { status: err.statusCode, jsonBody: { error: err.message } };
      }
      throw err;
    }
  },
});

// DELETE /api/leagues/:leagueId/members/:userId — kick a member (creator only)
app.http('kickLeagueMember', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'leagues/{leagueId}/members/{memberId}',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const user = requireAuth(request);
      const leagueId = request.params.leagueId;
      const memberId = request.params.memberId;

      const league = await getEntity<LeagueEntity>('Leagues', 'leagues', leagueId);
      if (!league) {
        return { status: 404, jsonBody: { error: 'League not found' } };
      }
      if (league.createdBy !== user.userId) {
        return { status: 403, jsonBody: { error: 'Only the league creator can remove members' } };
      }
      if (memberId === user.userId) {
        return { status: 400, jsonBody: { error: 'Cannot remove yourself from the league' } };
      }

      const deleted = await deleteEntity('LeagueMembers', leagueId, memberId);
      if (!deleted) {
        return { status: 404, jsonBody: { error: 'Member not found' } };
      }

      return { status: 200, jsonBody: { removed: memberId } };
    } catch (err) {
      if (err instanceof AuthError) {
        return { status: err.statusCode, jsonBody: { error: err.message } };
      }
      throw err;
    }
  },
});
