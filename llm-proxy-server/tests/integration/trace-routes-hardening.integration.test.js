import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import path from 'node:path';
import { access, readFile, rm } from 'node:fs/promises';

import traceRoutes from '../../src/routes/traceRoutes.js';

const projectRoot = path.resolve(process.cwd(), '../');
const defaultTraceDir = path.join(projectRoot, 'traces');

function buildApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/traces', traceRoutes);
  return app;
}

const createdPaths = new Set();

beforeEach(() => {
  createdPaths.clear();
});

afterEach(async () => {
  for (const filePath of createdPaths) {
    await rm(filePath, { force: true });
  }
  createdPaths.clear();
});

describe('traceRoutes security and error handling integration', () => {
  it('rejects write attempts that try to escape the project directory', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/api/traces/write')
      .send({
        traceData: { attempt: 'escape' },
        fileName: 'intrusion.log',
        outputDirectory: '../../etc',
      });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      error: 'Invalid output path',
    });

    const unexpectedRepoPath = path.join(defaultTraceDir, 'intrusion.log');
    await expect(access(unexpectedRepoPath)).rejects.toBeDefined();
  });

  it('surfaces descriptive failures when filenames contain null bytes', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/api/traces/write')
      .send({
        traceData: { unsafe: true },
        fileName: 'bad\u0000name.json',
      });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBe('Failed to write trace file');
    expect(response.body.details).toContain('null bytes');
  });

  it('reports mixed outcomes when batch writes contain unserializable entries', async () => {
    const app = buildApp();
    const goodFileName = `good-trace-${Date.now()}.json`;
    const badFileName = `bad-trace-\u0000-${Date.now()}.json`;
    const goodFilePath = path.join(defaultTraceDir, goodFileName);

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        traces: [
          { traceData: { ok: true }, fileName: goodFileName },
          { traceData: { suspicious: true }, fileName: badFileName },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.successCount).toBe(1);
    expect(response.body.failureCount).toBe(1);

    const successResult = response.body.results.find(
      (result) => result.fileName === goodFileName
    );
    const failureResult = response.body.results.find(
      (result) => result.fileName === badFileName
    );

    expect(successResult).toBeDefined();
    expect(successResult).toMatchObject({
      success: true,
      bytesWritten: expect.any(Number),
    });
    expect(failureResult).toBeDefined();
    expect(failureResult.success).toBe(false);
    expect(failureResult.error).toContain('null bytes');

    createdPaths.add(goodFilePath);
    expect(await readFile(goodFilePath, 'utf8')).toContain('"ok": true');
  });

  it('blocks directory traversal attempts on the list endpoint', async () => {
    const app = buildApp();

    const response = await request(app)
      .get('/api/traces/list')
      .query({ directory: '../../etc' });

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      error: 'Invalid directory path',
    });
  });
});
