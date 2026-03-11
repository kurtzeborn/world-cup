import { app, HttpResponseInit } from '@azure/functions';

app.http('adminTest', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'admin/test',
  handler: async (): Promise<HttpResponseInit> => {
    return { status: 200, jsonBody: { ok: true, source: 'admin-test' } };
  },
});
