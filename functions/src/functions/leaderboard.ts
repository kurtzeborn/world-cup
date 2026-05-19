import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getEntity, listEntitiesByPartition } from '../shared/storage.js';
import { LeagueMemberEntity, LeagueEntity, UserEntity, PicksEntity } from '../shared/types.js';
import { requireAuth, AuthError } from '../shared/auth.js';

function userToLeaderboardEntry(u: UserEntity & { rowKey?: string }, championPick: string | null, extra?: { joinedAt?: string }) {
  return {
    userId: u.rowKey,
    displayName: u.displayName ?? u.rowKey,
    totalPoints: u.totalPoints ?? 0,
    groupPoints: u.groupPoints ?? 0,
    thirdPlacePoints: u.thirdPlacePoints ?? 0,
    knockoutPoints: u.knockoutPoints ?? 0,
    maxPossiblePoints: u.maxPossiblePoints ?? 0,
    calculatedAt: u.calculatedAt ?? null,
    championPick,
    ...extra,
  };
}

async function getChampionPick(userId: string): Promise<string | null> {
  try {
    const picks = await getEntity<PicksEntity>('Picks', userId, 'picks');
    if (!picks?.bracketPicks) return null;
    const bp = JSON.parse(picks.bracketPicks) as Record<string, string>;
    return bp['F_104'] ?? null;
  } catch {
    return null;
  }
}

// GET /api/leaderboard — global leaderboard
app.http('getLeaderboard', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'leaderboard',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      requireAuth(request);
      const users = await listEntitiesByPartition<UserEntity>('Users', 'user');

      const championPicks = await Promise.all(users.map(u => getChampionPick(u.rowKey!)));

      const leaderboard = users
        .map((u, i) => userToLeaderboardEntry(u, championPicks[i]))
        .sort((a, b) => b.totalPoints - a.totalPoints);

      return {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
        jsonBody: leaderboard,
      };
    } catch (err) {
      if (err instanceof AuthError) {
        return { status: err.statusCode, jsonBody: { error: err.message } };
      }
      throw err;
    }
  },
});

// GET /api/leaderboard/:leagueId — league-specific leaderboard
app.http('getLeagueLeaderboard', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'leaderboard/{leagueId}',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      requireAuth(request);
      const leagueId = request.params.leagueId;

      const members = await listEntitiesByPartition<LeagueMemberEntity>('LeagueMembers', leagueId);
      if (members.length === 0) {
        return { status: 404, jsonBody: { error: 'League not found or has no members' } };
      }

      const [league, userRows, championPicks] = await Promise.all([
        getEntity<LeagueEntity>('Leagues', 'leagues', leagueId),
        Promise.all(members.map((m) => getEntity<UserEntity>('Users', 'user', m.rowKey!))),
        Promise.all(members.map((m) => getChampionPick(m.rowKey!))),
      ]);

      const leaderboard = members
        .map((m, i) => {
          const u = userRows[i];
          return userToLeaderboardEntry(
            u ?? { rowKey: m.rowKey, displayName: m.rowKey! } as any,
            championPicks[i],
            { joinedAt: m.joinedAt },
          );
        })
        .sort((a, b) => b.totalPoints - a.totalPoints);

      return {
        status: 200,
        headers: { 'Cache-Control': 'no-store' },
        jsonBody: { createdBy: league?.createdBy ?? null, leagueName: league?.name ?? 'League', leaderboard },
      };
    } catch (err) {
      if (err instanceof AuthError) {
        return { status: err.statusCode, jsonBody: { error: err.message } };
      }
      throw err;
    }
  },
});
