import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { upsertEntity } from '../shared/storage.js';
import { PicksEntity, isLocked, getLockDeadline } from '../shared/types.js';

// POST /api/auto-lock — automatically lock all unlocked picks after the deadline
// Protected by a bearer token (AUTO_LOCK_TOKEN env var) instead of SWA auth,
// so it can be called from GitHub Actions scheduled workflows.
app.http('autoLock', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'auto-lock',
  handler: async (request: HttpRequest, context: InvocationContext): Promise<HttpResponseInit> => {
    // Validate bearer token
    const authHeader = request.headers.get('authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const expected = process.env.AUTO_LOCK_TOKEN;

    if (!expected || !token || token !== expected) {
      return { status: 401, jsonBody: { error: 'Unauthorized' } };
    }

    // Only lock if the deadline has actually passed
    if (!isLocked()) {
      const deadline = getLockDeadline();
      return { status: 200, jsonBody: { locked: 0, skipped: 0, message: `Deadline has not passed yet (${deadline.toISOString()})` } };
    }

    const table = await import('../shared/storage.js').then((m) => m.picksTable());
    const deadlineTime = getLockDeadline().toISOString();
    let locked = 0;
    let skipped = 0;

    for await (const entity of table.listEntities<PicksEntity>()) {
      if (entity.rowKey !== 'picks') continue;
      if (entity.lockedAt) {
        skipped++;
        continue;
      }

      await upsertEntity<PicksEntity>('Picks', entity.partitionKey!, 'picks', {
        groupPicks: entity.groupPicks,
        thirdPlaceAdvancing: entity.thirdPlaceAdvancing,
        bracketPicks: entity.bracketPicks,
        lockedAt: deadlineTime,
        updatedAt: deadlineTime,
      });
      locked++;
    }

    context.log(`Auto-lock complete: ${locked} locked, ${skipped} already locked`);
    return { status: 200, jsonBody: { locked, skipped, lockedAt: deadlineTime } };
  },
});
