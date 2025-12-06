import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import path from 'node:path';
import { access, readFile, rm } from 'node:fs/promises';

import traceRoutes from '../../src/routes/traceRoutes.js';

const projectRoot = path.resolve(__dirname, '../../../');
const tracesDirectory = path.join(projectRoot, 'traces');

const createdPaths = new Set();

function buildApp(transformer) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  if (typeof transformer === 'function') {
    app.use((req, _res, next) => {
      transformer(req);
      next();
    });
  }

  app.use('/api/traces', traceRoutes);
  return app;
}

function createRejectingTrace(
  originalFileName,
  failureFactory = () => new Error('fileName accessor failure')
) {
  const circularTraceData = {};
  circularTraceData.self = circularTraceData;

  const target = {
    fileName: originalFileName,
    traceData: circularTraceData,
  };

  let fileNameAccessCount = 0;

  return new Proxy(target, {
    get(obj, prop, receiver) {
      if (prop === 'fileName') {
        fileNameAccessCount += 1;
        if (fileNameAccessCount === 3) {
          throw failureFactory();
        }
      }

      return Reflect.get(obj, prop, receiver);
    },
  });
}

async function expectPathMissing(filePath) {
  await expect(access(filePath)).rejects.toBeDefined();
}

beforeEach(() => {
  createdPaths.clear();
});

afterEach(async () => {
  for (const filePath of createdPaths) {
    await rm(filePath, { force: true });
  }
  createdPaths.clear();
});

describe('traceRoutes batch failure integration', () => {
  it('recovers when batch writes produce rejected promises due to metadata access failures', async () => {
    const app = buildApp((req) => {
      if (
        req.method === 'POST' &&
        req.path === '/api/traces/write-batch' &&
        Array.isArray(req.body?.traces) &&
        req.body?.__injectProxy === true &&
        req.body.traces.length > 1
      ) {
        const [, failingTrace] = req.body.traces;
        req.body.traces[1] = createRejectingTrace(failingTrace.fileName);
        delete req.body.__injectProxy;
      }
    });

    const successfulFileName = `trace-success-${Date.now()}.json`;
    const failingFileName = `trace-failure-${Date.now()}.json`;
    const successfulFilePath = path.join(tracesDirectory, successfulFileName);

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        __injectProxy: true,
        traces: [
          { traceData: { ok: true }, fileName: successfulFileName },
          { traceData: { shouldFail: true }, fileName: failingFileName },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.successCount).toBe(1);
    expect(response.body.failureCount).toBe(1);

    const successResult = response.body.results.find(
      (result) => result.fileName === successfulFileName
    );
    const failureResult = response.body.results.find(
      (result) => result.fileName === failingFileName
    );

    expect(successResult).toBeDefined();
    expect(successResult.success).toBe(true);
    expect(successResult.bytesWritten).toBeGreaterThan(0);

    expect(failureResult).toBeDefined();
    expect(failureResult.success).toBe(false);
    expect(failureResult.error).toContain('fileName accessor failure');

    createdPaths.add(successfulFilePath);
    await expect(readFile(successfulFilePath, 'utf8')).resolves.toContain(
      '"ok": true'
    );
  });

  it('falls back to unknown error descriptors when rejection reasons lack messages', async () => {
    const app = buildApp((req) => {
      if (
        req.method === 'POST' &&
        req.path === '/api/traces/write-batch' &&
        Array.isArray(req.body?.traces) &&
        req.body?.__injectProxy === 'unknown-error' &&
        req.body.traces.length > 1
      ) {
        const [, failingTrace] = req.body.traces;
        req.body.traces[1] = createRejectingTrace(
          failingTrace.fileName,
          () => new Error('')
        );
        delete req.body.__injectProxy;
      }
    });

    const successfulFileName = `trace-success-${Date.now()}-unknown.json`;
    const failingFileName = `trace-failure-${Date.now()}-unknown.json`;
    const successfulFilePath = path.join(tracesDirectory, successfulFileName);

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        __injectProxy: 'unknown-error',
        traces: [
          { traceData: { ok: true }, fileName: successfulFileName },
          { traceData: { shouldFail: true }, fileName: failingFileName },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const failureResult = response.body.results.find(
      (result) => result.fileName === failingFileName
    );

    expect(failureResult).toBeDefined();
    expect(failureResult.success).toBe(false);
    expect(failureResult.error).toBe('Unknown error');

    createdPaths.add(successfulFilePath);
    await expect(readFile(successfulFilePath, 'utf8')).resolves.toContain(
      '"ok": true'
    );
  });

  it('responds with server errors when batch validation encounters fatal issues', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({ traces: [null] });

    expect(response.status).toBe(500);
    expect(response.body).toMatchObject({
      success: false,
      error: 'Batch write operation failed',
    });
    expect(response.body.details).toContain('traceData');
  });

  it('reports overall failure when batch writes cannot persist any traces', async () => {
    const app = buildApp((req) => {
      if (
        req.method === 'POST' &&
        req.path === '/api/traces/write-batch' &&
        Array.isArray(req.body?.traces) &&
        req.body?.__injectProxy === 'all-fail'
      ) {
        req.body.traces = req.body.traces.map((trace) =>
          createRejectingTrace(trace.fileName)
        );
        delete req.body.__injectProxy;
      }
    });

    const failingFileName = `trace-failure-${Date.now()}-all.json`;
    const expectedPath = path.join(tracesDirectory, failingFileName);

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        __injectProxy: 'all-fail',
        traces: [
          { traceData: { shouldFail: true }, fileName: failingFileName },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(false);
    expect(response.body.successCount).toBe(0);
    expect(response.body.failureCount).toBe(1);

    await expectPathMissing(expectedPath);
  });
});
