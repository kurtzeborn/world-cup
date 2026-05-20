import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAdmin, AuthError } from '../shared/auth.js';
import { getEntity, deleteEntity, listEntitiesByPartition } from '../shared/storage.js';
import { LeagueEntity, LeagueMemberEntity, UserEntity } from '../shared/types.js';

// GET /api/manage/leagues — list all leagues with member counts (admin only)
app.http('adminGetLeagues', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'manage/leagues',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      requireAdmin(request);

      const allLeagues = await listEntitiesByPartition<LeagueEntity>('Leagues', 'leagues');
      const result = await Promise.all(allLeagues.map(async (league) => {
        const leagueId = league.rowKey!;
        const members = await listEntitiesByPartition<LeagueMemberEntity>('LeagueMembers', leagueId);

        // Look up creator display name and member display names in parallel
        let creatorName: string | undefined;
        const memberDetails = await Promise.all(members.map(async (m) => {
          try {
            const userEntity = await getEntity<UserEntity>('Users', 'user', m.rowKey!);
            if (m.rowKey === league.createdBy) creatorName = userEntity?.displayName;
            return {
              userId: m.rowKey!,
              displayName: userEntity?.displayName,
              email: userEntity?.email,
              authProvider: userEntity?.authProvider,
              joinedAt: m.joinedAt,
            };
          } catch {
            return { userId: m.rowKey!, displayName: undefined, email: undefined, authProvider: undefined, joinedAt: m.joinedAt };
          }
        }));

        // If creator is not a member, look them up separately
        if (!creatorName) {
          try {
            const creator = await getEntity<UserEntity>('Users', 'user', league.createdBy);
            creatorName = creator?.displayName;
          } catch { /* ignore */ }
        }

        return {
          leagueId,
          name: league.name,
          joinCode: league.joinCode,
          createdBy: league.createdBy,
          creatorName,
          createdAt: league.createdAt,
          memberCount: members.length,
          members: memberDetails,
        };
      }));

      // Sort by most recently created first
      result.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));

      return { status: 200, jsonBody: result };
    } catch (err) {
      if (err instanceof AuthError) {
        return { status: err.statusCode, jsonBody: { error: err.message } };
      }
      throw err;
    }
  },
});

// DELETE /api/manage/leagues/:leagueId — delete a league and all its members (admin only)
app.http('adminDeleteLeague', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'manage/leagues/{leagueId}',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      requireAdmin(request);
      const leagueId = request.params.leagueId;

      const league = await getEntity<LeagueEntity>('Leagues', 'leagues', leagueId);
      if (!league) {
        return { status: 404, jsonBody: { error: 'League not found' } };
      }

      // Delete all members first
      const members = await listEntitiesByPartition<LeagueMemberEntity>('LeagueMembers', leagueId);
      await Promise.all(members.map(m => deleteEntity('LeagueMembers', leagueId, m.rowKey!)));

      // Delete the league itself
      await deleteEntity('Leagues', 'leagues', leagueId);

      return { status: 200, jsonBody: { deleted: leagueId } };
    } catch (err) {
      if (err instanceof AuthError) {
        return { status: err.statusCode, jsonBody: { error: err.message } };
      }
      throw err;
    }
  },
});

// DELETE /api/manage/leagues/:leagueId/members/:memberId — remove a member (admin only)
app.http('adminKickLeagueMember', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'manage/leagues/{leagueId}/members/{memberId}',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      requireAdmin(request);
      const leagueId = request.params.leagueId;
      const memberId = request.params.memberId;

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
