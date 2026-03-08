import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAuth, AuthError } from '../shared/auth.js';
import { getEntity, upsertEntity, listEntitiesByPartition } from '../shared/storage.js';
import { LeagueEntity, LeagueMemberEntity, UserEntity } from '../shared/types.js';
import { randomBytes } from 'crypto';

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
      const userEntity = await getEntity<UserEntity>('Users', user.userId, 'profile');
      await upsertEntity<LeagueMemberEntity>('LeagueMembers', leagueId, user.userId, {
        joinedAt: now,
        displayName: userEntity?.displayName ?? user.userId,
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

      const userEntity = await getEntity<UserEntity>('Users', user.userId, 'profile');
      const now = new Date().toISOString();

      await upsertEntity<LeagueMemberEntity>('LeagueMembers', leagueId, user.userId, {
        joinedAt: now,
        displayName: userEntity?.displayName ?? user.userId,
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
