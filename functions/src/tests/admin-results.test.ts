import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpRequest } from '@azure/functions';
import type { InvocationContext } from '@azure/functions';
import type { PicksEntity } from '../shared/types.js';

const { mockGetEntity, mockUpsertEntity, mockListEntities, mockPicksTable } = vi.hoisted(() => ({
  mockGetEntity: vi.fn(),
  mockUpsertEntity: vi.fn(),
  mockListEntities: vi.fn(),
  mockPicksTable: vi.fn(),
}));

vi.mock('../shared/storage.js', () => ({
  getEntity: mockGetEntity,
  upsertEntity: mockUpsertEntity,
  listEntitiesByPartition: vi.fn(),
  picksTable: mockPicksTable,
}));

vi.mock('@azure/functions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@azure/functions')>();
  return {
    ...actual,
    app: {
      http: vi.fn(),
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
    },
  };
});

import { adminLockAllHandler } from '../functions/admin-results.js';

type StoredPicksEntity = PicksEntity & { partitionKey: string; rowKey: string };

const mockCtx = {} as InvocationContext;

function makeAuthHeader(userId: string, roles: string[] = ['authenticated']): string {
  const principal = { userId, userDetails: `${userId}@test.com`, identityProvider: 'aad', userRoles: roles };
  return Buffer.from(JSON.stringify(principal)).toString('base64');
}

function makeRequest(method: string, url: string, options: {
  headers?: Record<string, string>;
} = {}): HttpRequest {
  return new HttpRequest({ method, url, ...options });
}

function makeStoredPicksEntity(partitionKey: string, overrides: Partial<StoredPicksEntity> = {}): StoredPicksEntity {
  return {
    partitionKey,
    rowKey: 'picks',
    groupPicks: '{}',
    thirdPlaceAdvancing: '[]',
    bracketPicks: '{}',
    lockedAt: null,
    updatedAt: '2026-03-10T00:00:00Z',
    ...overrides,
  };
}

async function* makeAsyncIterable<T>(items: T[]): AsyncGenerator<T> {
  for (const item of items) {
    yield item;
  }
}

describe('adminLockAllHandler', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockPicksTable.mockResolvedValue({
      listEntities: mockListEntities,
    });
  });

  it('returns 401 when not authenticated', async () => {
    const req = makeRequest('POST', 'http://localhost/api/admin/lock-all');
    const res = await adminLockAllHandler(req, mockCtx);
    expect(res.status).toBe(401);
  });

  it('returns 403 when user is not an admin', async () => {
    const req = makeRequest('POST', 'http://localhost/api/admin/lock-all', {
      headers: { 'x-ms-client-principal': makeAuthHeader('user1') },
    });
    const res = await adminLockAllHandler(req, mockCtx);
    expect(res.status).toBe(403);
  });

  it('locks only unlocked picks rows and reports locked/skipped counts', async () => {
    const unlocked = makeStoredPicksEntity('user1');
    const alreadyLocked = makeStoredPicksEntity('user2', { lockedAt: '2026-03-09T00:00:00Z' });
    const nonPicksRow = { ...makeStoredPicksEntity('user3'), rowKey: 'draft' };

    mockListEntities.mockReturnValue(makeAsyncIterable([unlocked, alreadyLocked, nonPicksRow]));
    mockUpsertEntity.mockResolvedValue(undefined as never);

    const req = makeRequest('POST', 'http://localhost/api/admin/lock-all', {
      headers: { 'x-ms-client-principal': makeAuthHeader('admin1', ['authenticated', 'admin']) },
    });
    const res = await adminLockAllHandler(req, mockCtx);

    expect(res.status).toBe(200);
    expect(res.jsonBody).toMatchObject({ locked: 1, skipped: 1 });
    expect(mockUpsertEntity).toHaveBeenCalledOnce();
    expect(mockUpsertEntity).toHaveBeenCalledWith('Picks', 'user1', 'picks', expect.objectContaining({
      groupPicks: unlocked.groupPicks,
      thirdPlaceAdvancing: unlocked.thirdPlaceAdvancing,
      bracketPicks: unlocked.bracketPicks,
      lockedAt: expect.any(String),
      updatedAt: expect.any(String),
    }));
  });
});