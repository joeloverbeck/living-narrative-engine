import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { access, mkdir, readFile, rm } from 'node:fs/promises';

import traceRoutes from '../../src/routes/traceRoutes.js';

const projectRoot = path.resolve(process.cwd(), '../');
const defaultTracesDir = path.join(projectRoot, 'traces');

/**
 * Builds an Express application wired with the trace routes for exercising the
 * concrete middleware stack in a black-box fashion.
 * @returns {import('express').Express}
 */
function buildApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/traces', traceRoutes);
  return app;
}

const createdTraceFiles = new Set();

beforeEach(() => {
  createdTraceFiles.clear();
});

afterEach(async () => {
  for (const filePath of createdTraceFiles) {
    await rm(filePath, { force: true });
  }
  createdTraceFiles.clear();
});

describe('traceRoutes default path integration coverage', () => {
  it('writes raw string traces to the default directory when none is provided', async () => {
    const app = buildApp();
    const uniqueName = `default-trace-${randomUUID()}.log`;
    const expectedPath = path.join(defaultTracesDir, uniqueName);

    const response = await request(app).post('/api/traces/write').send({
      traceData: 'raw-trace-payload',
      fileName: uniqueName,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      fileName: uniqueName,
      path: path.join('traces', uniqueName),
    });

    const stored = await readFile(expectedPath, 'utf8');
    expect(stored).toBe('raw-trace-payload');

    createdTraceFiles.add(expectedPath);
  });

  it('performs batch writes into the default directory and reports aggregate sizes', async () => {
    const app = buildApp();
    const traceAlpha = `batch-alpha-${randomUUID()}.json`;
    const traceBeta = `batch-beta-${randomUUID()}.txt`;
    const alphaPath = path.join(defaultTracesDir, traceAlpha);
    const betaPath = path.join(defaultTracesDir, traceBeta);

    const alphaPayload = '{"source":"alpha","count":1}';
    const betaPayloadObject = { from: 'beta', ok: true };

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        traces: [
          { traceData: alphaPayload, fileName: traceAlpha },
          { traceData: betaPayloadObject, fileName: traceBeta },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      successCount: 2,
      failureCount: 0,
    });

    // Ensure the byte counts reported include the raw string payload and the
    // pretty-printed JSON representation respectively.
    const expectedAlphaBytes = Buffer.byteLength(alphaPayload, 'utf8');
    const expectedBetaBytes = Buffer.byteLength(
      JSON.stringify(betaPayloadObject, null, 2),
      'utf8'
    );
    expect(response.body.totalSize).toBe(
      expectedAlphaBytes + expectedBetaBytes
    );

    const resultsByFile = Object.fromEntries(
      response.body.results.map((result) => [result.fileName, result])
    );

    expect(resultsByFile[traceAlpha]).toMatchObject({
      success: true,
      bytesWritten: expectedAlphaBytes,
    });
    expect(resultsByFile[traceBeta]).toMatchObject({
      success: true,
      bytesWritten: expectedBetaBytes,
    });

    expect(await readFile(alphaPath, 'utf8')).toBe(alphaPayload);
    expect(await readFile(betaPath, 'utf8')).toBe(
      JSON.stringify(betaPayloadObject, null, 2)
    );

    createdTraceFiles.add(alphaPath);
    createdTraceFiles.add(betaPath);
  });

  it('lists trace files from the default directory when no query is provided', async () => {
    const app = buildApp();
    const listedName = `listed-trace-${randomUUID()}.json`;
    const listedPath = path.join(defaultTracesDir, listedName);

    await mkdir(defaultTracesDir, { recursive: true });
    await access(defaultTracesDir);
    await rm(listedPath, { force: true });

    await request(app)
      .post('/api/traces/write')
      .send({ traceData: { seeded: true }, fileName: listedName });

    const response = await request(app).get('/api/traces/list');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.directory).toBe('./traces');
    expect(response.body.files.some((file) => file.name === listedName)).toBe(
      true
    );

    createdTraceFiles.add(listedPath);
  });
});
