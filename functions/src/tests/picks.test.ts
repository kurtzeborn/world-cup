import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HttpRequest } from '@azure/functions';
import type { InvocationContext } from '@azure/functions';

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

import { lockPicksHandler, getPicksForUserHandler } from '../functions/picks.js';
import { getEntity, upsertEntity } from '../shared/storage.js';

const mockGetEntity = vi.mocked(getEntity);
const mockUpsertEntity = vi.mocked(upsertEntity);

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeAuthHeader(userId: string, roles: string[] = ['authenticated']): string {
  const principal = { userId, userDetails: `${userId}@test.com`, identityProvider: 'aad', userRoles: roles };
  return Buffer.from(JSON.stringify(principal)).toString('base64');
}

function makeRequest(method: string, url: string, options: {
  headers?: Record<string, string>;
  params?: Record<string, string>;
} = {}): HttpRequest {
  return new HttpRequest({ method, url, ...options });
}

const mockCtx = {} as InvocationContext;

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

// ─── Lock Handler Tests ──────────────────────────────────────────────────────

describe('lockPicksHandler', () => {

  beforeEach(() => {
    vi.resetAllMocks();
    // Default: time is before lock deadline (not locked)
    vi.stubEnv('LOCK_DEADLINE', '2030-01-01T00:00:00Z');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 401 when not authenticated', async () => {
    const req = makeRequest('POST', 'http://localhost/api/picks/lock');
    const res = await lockPicksHandler(req, mockCtx);
    expect(res.status).toBe(401);
  });

  it('returns 400 when user has no picks saved', async () => {
    mockGetEntity.mockResolvedValueOnce(null);

    const req = makeRequest('POST', 'http://localhost/api/picks/lock', {
      headers: { 'x-ms-client-principal': makeAuthHeader('user1') },
    });
    const res = await lockPicksHandler(req, mockCtx);
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toContain('No picks to lock');
  });

  it('returns 200 idempotently when picks already locked', async () => {
    const alreadyLocked = { ...makeCompletePicks(), lockedAt: '2026-03-05T00:00:00Z' };
    mockGetEntity.mockResolvedValueOnce(alreadyLocked);

    const req = makeRequest('POST', 'http://localhost/api/picks/lock', {
      headers: { 'x-ms-client-principal': makeAuthHeader('user1') },
    });
    const res = await lockPicksHandler(req, mockCtx);
    expect(res.status).toBe(200);
    expect((res.jsonBody as { lockedAt: string }).lockedAt).toBe('2026-03-05T00:00:00Z');
    expect(mockUpsertEntity).not.toHaveBeenCalled();
  });

  it('returns 400 when groups are incomplete (< 12)', async () => {
    const incomplete = {
      groupPicks: JSON.stringify({ A: ['T1', 'T2', 'T3', 'T4'] }), // only 1 group
      thirdPlaceAdvancing: JSON.stringify(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']),
      bracketPicks: JSON.stringify(makeCompletePicks().bracketPicks ? JSON.parse(makeCompletePicks().bracketPicks) : {}),
      lockedAt: null,
      updatedAt: '2026-03-01T00:00:00Z',
    };
    mockGetEntity.mockResolvedValueOnce(incomplete);

    const req = makeRequest('POST', 'http://localhost/api/picks/lock', {
      headers: { 'x-ms-client-principal': makeAuthHeader('user1') },
    });
    const res = await lockPicksHandler(req, mockCtx);
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toMatch(/groups.*1\/12/);
  });

  it('returns 400 when third-place selection is not exactly 8', async () => {
    const complete = makeCompletePicks();
    const incomplete = {
      ...complete,
      thirdPlaceAdvancing: JSON.stringify(['A', 'B', 'C']), // only 3 instead of 8
    };
    mockGetEntity.mockResolvedValueOnce(incomplete);

    const req = makeRequest('POST', 'http://localhost/api/picks/lock', {
      headers: { 'x-ms-client-principal': makeAuthHeader('user1') },
    });
    const res = await lockPicksHandler(req, mockCtx);
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toMatch(/third-place.*3\/8/);
  });

  it('returns 400 when bracket is incomplete (< 32)', async () => {
    const complete = makeCompletePicks();
    const incomplete = {
      ...complete,
      bracketPicks: JSON.stringify({ R32_73: 'W73' }), // only 1 bracket pick
    };
    mockGetEntity.mockResolvedValueOnce(incomplete);

    const req = makeRequest('POST', 'http://localhost/api/picks/lock', {
      headers: { 'x-ms-client-principal': makeAuthHeader('user1') },
    });
    const res = await lockPicksHandler(req, mockCtx);
    expect(res.status).toBe(400);
    expect((res.jsonBody as { error: string }).error).toMatch(/bracket.*1\/32/);
  });

  it('returns 200 and calls upsert when picks are complete', async () => {
    const complete = makeCompletePicks();
    mockGetEntity.mockResolvedValueOnce(complete);
    mockUpsertEntity.mockResolvedValueOnce(undefined as never);

    const req = makeRequest('POST', 'http://localhost/api/picks/lock', {
      headers: { 'x-ms-client-principal': makeAuthHeader('user1') },
    });
    const res = await lockPicksHandler(req, mockCtx);
    expect(res.status).toBe(200);
    const body = res.jsonBody as { lockedAt: string };
    expect(body.lockedAt).toBeTruthy();
    expect(mockUpsertEntity).toHaveBeenCalledOnce();
    // Verify lockedAt was written
    const upsertArgs = mockUpsertEntity.mock.calls[0][3] as { lockedAt: string };
    expect(upsertArgs.lockedAt).toBeTruthy();
  });

});

// ─── Visibility Gate Tests (T12) ─────────────────────────────────────────────

describe('getPicksForUserHandler — visibility gate', () => {

  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('T12a — returns 403 when lock deadline has NOT passed', async () => {
    vi.stubEnv('LOCK_DEADLINE', '2030-01-01T00:00:00Z'); // far future

    const req = makeRequest('GET', 'http://localhost/api/picks/targetUser', {
      headers: { 'x-ms-client-principal': makeAuthHeader('viewer1') },
      params: { userId: 'targetUser' },
    });
    const res = await getPicksForUserHandler(req, mockCtx);
    expect(res.status).toBe(403);
    expect((res.jsonBody as { error: string }).error).toContain('not yet visible');
  });

  it('T12b — returns 200 with picks when lock deadline HAS passed and picks are locked', async () => {
    vi.stubEnv('LOCK_DEADLINE', '2020-01-01T00:00:00Z'); // past

    const lockedPicks = {
      ...makeCompletePicks(),
      lockedAt: '2026-06-10T12:00:00Z',
    };
    mockGetEntity.mockResolvedValueOnce(lockedPicks);

    const req = makeRequest('GET', 'http://localhost/api/picks/targetUser', {
      headers: { 'x-ms-client-principal': makeAuthHeader('viewer1') },
      params: { userId: 'targetUser' },
    });
    const res = await getPicksForUserHandler(req, mockCtx);
    expect(res.status).toBe(200);
    const body = res.jsonBody as { lockedAt: string };
    expect(body.lockedAt).toBe('2026-06-10T12:00:00Z');
  });

  it('returns 404 when lock deadline passed but target user has no locked picks', async () => {
    vi.stubEnv('LOCK_DEADLINE', '2020-01-01T00:00:00Z'); // past

    mockGetEntity.mockResolvedValueOnce(null); // no picks for target user

    const req = makeRequest('GET', 'http://localhost/api/picks/unknownUser', {
      headers: { 'x-ms-client-principal': makeAuthHeader('viewer1') },
      params: { userId: 'unknownUser' },
    });
    const res = await getPicksForUserHandler(req, mockCtx);
    expect(res.status).toBe(404);
  });

  it('returns 401 when viewer is not authenticated', async () => {
    vi.stubEnv('LOCK_DEADLINE', '2020-01-01T00:00:00Z'); // past

    const req = makeRequest('GET', 'http://localhost/api/picks/targetUser', {
      params: { userId: 'targetUser' },
    });
    const res = await getPicksForUserHandler(req, mockCtx);
    expect(res.status).toBe(401);
  });

});
