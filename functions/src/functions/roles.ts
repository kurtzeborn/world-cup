import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

function parseAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS || '';
  const emails = raw
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean);
  return new Set(emails);
}

function extractEmail(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;

  const record = body as { userDetails?: unknown; claims?: unknown };
  if (typeof record.userDetails === 'string' && record.userDetails.includes('@')) {
    return record.userDetails.toLowerCase();
  }

  if (Array.isArray(record.claims)) {
    for (const claim of record.claims) {
      const entry = claim as { type?: unknown; value?: unknown };
      const value = typeof entry.value === 'string' ? entry.value : '';
      if (value.includes('@')) return value.toLowerCase();
    }
  }

  return null;
}

// POST /api/roles — return roles for the authenticated user
app.http('getRoles', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'roles',
  handler: async (request: HttpRequest, _context: InvocationContext): Promise<HttpResponseInit> => {
    try {
      const body = await request.json().catch(() => null);
      const email = extractEmail(body);
      const adminEmails = parseAdminEmails();

      const roles: string[] = [];
      if (email) roles.push('authenticated');
      if (email && adminEmails.has(email)) roles.push('admin');

      return { status: 200, jsonBody: { roles } };
    } catch {
      return { status: 200, jsonBody: { roles: [] } };
    }
  },
});
