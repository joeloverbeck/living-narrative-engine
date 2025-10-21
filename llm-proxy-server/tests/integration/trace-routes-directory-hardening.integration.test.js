import { describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import path from 'node:path';

import traceRoutes from '../../src/routes/traceRoutes.js';

function buildApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/traces', traceRoutes);
  return app;
}

describe('traceRoutes directory safety integration', () => {
  it('rejects list requests that attempt to traverse outside the project root', async () => {
    const app = buildApp();

    const response = await request(app)
      .get('/api/traces/list')
      .query({ directory: '../../outside-project' });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      error: 'Invalid directory path',
    });
  });

  it('surfaces filesystem errors when the requested directory is actually a file', async () => {
    const app = buildApp();

    const response = await request(app)
      .get('/api/traces/list')
      .query({ directory: path.join('.', 'package.json') });

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      success: false,
      error: 'Failed to list trace files',
    });
    expect(response.body.details).toEqual(
      expect.stringContaining('not a directory')
    );
  });
});
