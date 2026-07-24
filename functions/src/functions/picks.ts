import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { getEntity } from '../shared/storage.js';
import { PicksEntity, UserEntity, isLocked } from '../shared/types.js';

// GET /api/picks/:userId — view a user's locked picks (public archive)
export async function getPicksForUserHandler(request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> {
  const targetUserId = request.params.userId;
  const entity = await getEntity<PicksEntity>('Picks', targetUserId, 'picks');
  if (!entity || !entity.groupPicks) {
    return { status: 404, jsonBody: { error: 'No picks found for this user' } };
  }

  if (!isLocked() && !entity.lockedAt) {
    return { status: 403, jsonBody: { error: 'Picks are not yet visible before the lock deadline' } };
  }

  // Include score data
  const userEntity = await getEntity<UserEntity>('Users', 'user', targetUserId);
  const score = userEntity?.totalPoints != null
    ? { totalPoints: userEntity.totalPoints, maxPossiblePoints: userEntity.maxPossiblePoints ?? 0 }
    : null;

  return {
    status: 200,
    jsonBody: {
      groupPicks: JSON.parse(entity.groupPicks || '{}'),
      thirdPlaceAdvancing: JSON.parse(entity.thirdPlaceAdvancing || '[]'),
      bracketPicks: JSON.parse(entity.bracketPicks || '{}'),
      lockedAt: entity.lockedAt,
      score,
    },
  };
}

app.http('getPicksForUser', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'picks/{userId}',
  handler: getPicksForUserHandler,
});
