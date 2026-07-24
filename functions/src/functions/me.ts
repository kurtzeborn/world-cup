import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getEntity } from '../shared/storage.js';
import { UserEntity } from '../shared/types.js';

// GET /api/me/:userId — get a user's display name (public read-only archive)
app.http('getUserInfo', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'me/{userId}',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    const userId = request.params.userId;
    const entity = await getEntity<UserEntity>('Users', 'user', userId);

    return {
      status: 200,
      jsonBody: {
        userId,
        displayName: entity?.displayName ?? userId,
      },
    };
  },
});
