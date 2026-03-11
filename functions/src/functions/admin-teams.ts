import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { requireAdmin, AuthError } from '../shared/auth.js';
import { upsertEntity } from '../shared/storage.js';
import { TeamEntity } from '../shared/types.js';

// PUT /api/manage/teams/:id — update a team (e.g. confirm a TBD team's identity)
app.http('adminUpdateTeam', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'manage/teams/{teamId}',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      requireAdmin(request);

      const teamId = request.params.teamId;
      if (!teamId) {
        return { status: 400, jsonBody: { error: 'teamId is required' } };
      }

      const body = await request.json() as Partial<TeamEntity>;

      // Only allow updating specific fields
      const allowed: (keyof TeamEntity)[] = ['name', 'flagCode', 'fifaRanking', 'confirmed'];
      const updates: Partial<TeamEntity> = {};
      for (const field of allowed) {
        if (body[field] !== undefined) {
          (updates as Record<string, unknown>)[field] = body[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        return { status: 400, jsonBody: { error: 'No updatable fields provided' } };
      }

      await upsertEntity<Partial<TeamEntity>>('Teams', 'teams', teamId, updates);

      return { status: 200, jsonBody: { teamId, ...updates } };
    } catch (err) {
      if (err instanceof AuthError) {
        return { status: err.statusCode, jsonBody: { error: err.message } };
      }
      throw err;
    }
  },
});
