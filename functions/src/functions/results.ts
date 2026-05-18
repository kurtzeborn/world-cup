import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getEntity } from '../shared/storage.js';
import { ResultEntity, Results } from '../shared/types.js';
import { requireAuth, AuthError } from '../shared/auth.js';

// GET /api/results — get current match results (authenticated)
app.http('getResults', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'results',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      requireAuth(request);
    } catch (err) {
      if (err instanceof AuthError) {
        return { status: err.statusCode, jsonBody: { error: err.message } };
      }
      throw err;
    }
    const entity = await getEntity<ResultEntity>('Results', 'results', 'current');
    const results: Results | { groupStandings: Record<string, never>; advancing3rdPlace: never[]; matchResults: Record<string, never>; updatedAt: null } = entity
      ? JSON.parse(entity.data)
      : { groupStandings: {}, advancing3rdPlace: [], matchResults: {}, updatedAt: null };

    return {
      status: 200,
      headers: { 'Cache-Control': 'public, max-age=30' },
      jsonBody: results,
    };
  },
});
