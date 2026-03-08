import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getEntity } from '../shared/storage.js';
import { ResultEntity } from '../shared/types.js';

// GET /api/results — get current match results (public)
app.http('getResults', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'results',
  handler: async (_request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    const entity = await getEntity<ResultEntity>('Results', 'results', 'current');
    return {
      status: 200,
      headers: { 'Cache-Control': 'public, max-age=30' },
      jsonBody: entity
        ? JSON.parse(entity.data)
        : { matchResults: {}, updatedAt: null },
    };
  },
});
