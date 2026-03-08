import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getAuthUser, requireAuth, isAdmin, AuthError } from '../shared/auth.js';
import { getEntity, upsertEntity } from '../shared/storage.js';
import { UserEntity } from '../shared/types.js';

// GET /api/me
app.http('getMe', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'me',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    const user = getAuthUser(request);
    if (!user) {
      return { status: 200, jsonBody: { isAuthenticated: false } };
    }

    const entity = await getEntity<UserEntity>('Users', 'user', user.userId);

    return {
      status: 200,
      jsonBody: {
        isAuthenticated: true,
        userId: user.userId,
        userDetails: user.userDetails,
        identityProvider: user.identityProvider,
        isAdmin: isAdmin(user),
        displayName: entity?.displayName ?? null,
        hasDisplayName: !!entity?.displayName,
      },
    };
  },
});

// PUT /api/me — update display name
app.http('updateMe', {
  methods: ['PUT'],
  authLevel: 'anonymous',
  route: 'me',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const user = requireAuth(request);
      const body = await request.json() as { displayName?: string };
      const displayName = body?.displayName?.trim();

      if (!displayName || displayName.length < 2 || displayName.length > 30) {
        return { status: 400, jsonBody: { error: 'Display name must be 2–30 characters' } };
      }

      const now = new Date().toISOString();
      const existing = await getEntity<UserEntity>('Users', 'user', user.userId);

      await upsertEntity<UserEntity>('Users', 'user', user.userId, {
        displayName,
        authProvider: user.identityProvider,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });

      return { status: 200, jsonBody: { displayName } };
    } catch (err) {
      if (err instanceof Error && 'statusCode' in err) {
        const e = err as { statusCode: number; message: string };
        return { status: e.statusCode, jsonBody: { error: e.message } };
      }
      throw err;
    }
  },
});
