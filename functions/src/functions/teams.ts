import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { listEntitiesByPartition } from '../shared/storage.js';
import { TeamEntity } from '../shared/types.js';

// GET /api/teams — public, returns all 48 teams
app.http('getTeams', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'teams',
  handler: async (_request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    const entities = await listEntitiesByPartition<TeamEntity>('Teams', 'team');

    const teams = entities.map(e => ({
      id: e.rowKey,
      name: e.name,
      group: e.group,
      groupSeed: e.groupSeed,
      flagCode: e.flagCode,
      fifaRanking: e.fifaRanking,
      confirmed: e.confirmed,
    }));

    // Sort by group then seed
    teams.sort((a, b) => {
      if (a.group < b.group) return -1;
      if (a.group > b.group) return 1;
      return a.groupSeed - b.groupSeed;
    });

    return {
      status: 200,
      jsonBody: teams,
      headers: {
        'Cache-Control': 'public, max-age=300',
      },
    };
  },
});
