import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpRequest } from '@azure/functions';
import type { InvocationContext } from '@azure/functions';
import type { PicksEntity } from '../shared/types.js';

// Mock storage module before importing handlers
vi.mock('../shared/storage.js', () => ({
  getEntity: vi.fn(),
  upsertEntity: vi.fn(),
  listEntitiesByPartition: vi.fn(),
  picksTable: vi.fn(),
}));

// Mock @azure/functions app registration so app.http() is a no-op during import
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

import { getPicksForUserHandler } from '../functions/picks.js';
import { getEntity } from '../shared/storage.js';

const mockGetEntity = vi.mocked(getEntity);

function makeRequest(method: string, url: string, options: {
  headers?: Record<string, string>;
  params?: Record<string, string>;
} = {}): HttpRequest {
  return new HttpRequest({ method, url, ...options });
}

const mockCtx = {} as InvocationContext;

type StoredPicksEntity = PicksEntity & { partitionKey: string; rowKey: string } & Record<string, unknown>;

function makeCompletePicks() {
  const groupPicks: Record<string, string[]> = {};
  for (const g of 'ABCDEFGHIJKL'.split('')) {
    groupPicks[g] = [`T1${g}`, `T2${g}`, `T3${g}`, `T4${g}`];
  }
  const thirdPlaceAdvancing = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  const bracketPicks: Record<string, string> = {};
  for (let i = 73; i <= 88; i++) bracketPicks[`R32_${i}`] = `W${i}`;
  for (let i = 89; i <= 96; i++) bracketPicks[`R16_${i}`] = `W${i}`;
  for (let i = 97; i <= 100; i++) bracketPicks[`QF_${i}`] = `W${i}`;
  bracketPicks['SF_101'] = 'WSF1';
  bracketPicks['SF_102'] = 'WSF2';
  bracketPicks['TPM_103'] = 'WTPM';
  bracketPicks['F_104'] = 'WFINAL';

  return {
    groupPicks: JSON.stringify(groupPicks),
    thirdPlaceAdvancing: JSON.stringify(thirdPlaceAdvancing),
    bracketPicks: JSON.stringify(bracketPicks),
    lockedAt: null,
    updatedAt: '2026-03-01T00:00:00Z',
  };
}

function makeStoredPicksEntity(overrides: Partial<StoredPicksEntity> = {}): StoredPicksEntity {
  return {
    partitionKey: 'user1',
    rowKey: 'picks',
    ...makeCompletePicks(),
    ...overrides,
  } as StoredPicksEntity;
}

// ─── Public archive view tests ──────────────────────────────────────────────

describe('getPicksForUserHandler — public archive', () => {

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 403 when lock deadline has NOT passed and picks are not locked', async () => {
    vi.stubEnv('LOCK_DEADLINE', '2030-01-01T00:00:00Z'); // far future

    mockGetEntity.mockResolvedValueOnce(makeStoredPicksEntity({ lockedAt: null }));

    const req = makeRequest('GET', 'http://localhost/api/picks/targetUser', {
      params: { userId: 'targetUser' },
    });
    const res = await getPicksForUserHandler(req, mockCtx);
    expect(res.status).toBe(403);
    expect((res.jsonBody as { error: string }).error).toContain('not yet visible');
  });

  it('returns 200 with picks when lock deadline HAS passed and picks are locked', async () => {
    vi.stubEnv('LOCK_DEADLINE', '2020-01-01T00:00:00Z'); // past

    const lockedPicks = makeStoredPicksEntity({
      lockedAt: '2026-06-10T12:00:00Z',
    });
    mockGetEntity.mockResolvedValueOnce(lockedPicks);
    mockGetEntity.mockResolvedValueOnce(null); // no user record

    const req = makeRequest('GET', 'http://localhost/api/picks/targetUser', {
      params: { userId: 'targetUser' },
    });
    const res = await getPicksForUserHandler(req, mockCtx);
    expect(res.status).toBe(200);
    const body = res.jsonBody as { lockedAt: string };
    expect(body.lockedAt).toBe('2026-06-10T12:00:00Z');
  });

  it('returns 404 when lock deadline passed but target user has no picks', async () => {
    vi.stubEnv('LOCK_DEADLINE', '2020-01-01T00:00:00Z');

    mockGetEntity.mockResolvedValueOnce(null);

    const req = makeRequest('GET', 'http://localhost/api/picks/unknownUser', {
      params: { userId: 'unknownUser' },
    });
    const res = await getPicksForUserHandler(req, mockCtx);
    expect(res.status).toBe(404);
  });

  it('does not require any authentication header', async () => {
    vi.stubEnv('LOCK_DEADLINE', '2020-01-01T00:00:00Z');

    mockGetEntity.mockResolvedValueOnce(makeStoredPicksEntity({ lockedAt: '2026-06-10T12:00:00Z' }));
    mockGetEntity.mockResolvedValueOnce(null);

    const req = makeRequest('GET', 'http://localhost/api/picks/targetUser', {
      params: { userId: 'targetUser' },
    });
    const res = await getPicksForUserHandler(req, mockCtx);
    expect(res.status).toBe(200);
  });

});
