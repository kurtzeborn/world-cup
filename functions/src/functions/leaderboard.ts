import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getEntity, listEntitiesByPartition } from '../shared/storage.js';
import { ScoreEntity, LeagueMemberEntity } from '../shared/types.js';
import { requireAuth, AuthError } from '../shared/auth.js';

// GET /api/leaderboard — global leaderboard
app.http('getLeaderboard', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'leaderboard',
  handler: async (_request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    // List all scores from the Scores table (partitioned by 'global')
    const scores = await listEntitiesByPartition<ScoreEntity>('Scores', 'global');

    const leaderboard = scores
      .map((s) => ({
        userId: s.rowKey,
        displayName: s.rowKey, // will be enriched below if needed
        totalPoints: s.totalPoints,
        groupPoints: s.groupPoints,
        thirdPlacePoints: s.thirdPlacePoints,
        knockoutPoints: s.knockoutPoints,
        calculatedAt: s.calculatedAt,
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    return {
      status: 200,
      headers: { 'Cache-Control': 'public, max-age=60' },
      jsonBody: leaderboard,
    };
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

      // Get all members of this league
      const members = await listEntitiesByPartition<LeagueMemberEntity>('LeagueMembers', leagueId);
      if (members.length === 0) {
        return { status: 404, jsonBody: { error: 'League not found or has no members' } };
      }

      // Fetch scores for each member
      const scoreRows = await Promise.all(
        members.map((m) => getEntity<ScoreEntity>('Scores', 'global', m.rowKey!))
      );

      const leaderboard = members
        .map((m, i) => {
          const s = scoreRows[i];
          return {
            userId: m.rowKey,
            displayName: m.displayName,
            joinedAt: m.joinedAt,
            totalPoints: s?.totalPoints ?? 0,
            groupPoints: s?.groupPoints ?? 0,
            thirdPlacePoints: s?.thirdPlacePoints ?? 0,
            knockoutPoints: s?.knockoutPoints ?? 0,
            calculatedAt: s?.calculatedAt ?? null,
          };
        })
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
