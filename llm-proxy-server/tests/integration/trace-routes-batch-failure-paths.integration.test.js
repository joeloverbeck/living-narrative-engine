import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';

import traceRoutes from '../../src/routes/traceRoutes.js';

/**
 * Builds an Express app with the trace routes mounted for integration testing.
 * @returns {import('express').Express}
 */
function buildApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/traces', traceRoutes);
  return app;
}

const projectRoot = path.resolve(process.cwd(), '../');
const createdDirectories = new Set();

/**
 * Registers a relative directory for cleanup after a test completes.
 * @param {string} relativePath
 * @returns {string} absolute path registered for cleanup
 */
function trackDirectory(relativePath) {
  const normalized = relativePath.startsWith('./')
    ? relativePath.slice(2)
    : relativePath;
  const absolutePath = path.join(projectRoot, normalized);
  createdDirectories.add(absolutePath);
  return absolutePath;
}

/**
 * Clean up leftover test directories from previous test runs.
 * This ensures a clean state even if previous tests were interrupted.
 */
async function cleanupLeftoverDirectories() {
  const dirsToClean = [
    path.join(projectRoot, 'tmp-trace-batch'),
    path.join(projectRoot, 'tmp-traces'),
    path.join(projectRoot, 'tmp'),
    path.join(projectRoot, 'test-traces'),
  ];

  for (const dir of dirsToClean) {
    try {
      await rm(dir, { recursive: true, force: true });
    } catch (error) {
      // Ignore errors - directory might not exist
    }
  }
}

beforeEach(() => {
  createdDirectories.clear();
});

afterEach(async () => {
  jest.restoreAllMocks();

  const directories = Array.from(createdDirectories).sort(
    (a, b) => b.length - a.length
  );

  for (const directory of directories) {
    try {
      await rm(directory, { recursive: true, force: true });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('failed to clean trace directory after test', {
        directory,
        error: error.message,
      });
    }
  }

  createdDirectories.clear();

  // Also clean up parent directories if empty
  await cleanupLeftoverDirectories();
});

describe('traceRoutes batch failure mode integration coverage', () => {
  it('rejects batch writes that attempt to escape the project directory', async () => {
    const app = buildApp();

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        outputDirectory: '../../outside-of-project',
        traces: [
          { traceData: { alpha: true }, fileName: 'alpha.json' },
        ],
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      error: 'Invalid output path',
    });
  });

  it('converts rejected Promise.allSettled entries into structured failure results', async () => {
    const app = buildApp();
    const outputDirectory = `./tmp-trace-batch/${randomUUID()}`;
    const absoluteDirectory = trackDirectory(outputDirectory);

    await mkdir(absoluteDirectory, { recursive: true });

    const originalAllSettled = Promise.allSettled.bind(Promise);
    const rejection = new Error('synthetic aggregator rejection');
    const allSettledSpy = jest
      .spyOn(Promise, 'allSettled')
      .mockImplementation(async (iterable) => {
        const results = await originalAllSettled(iterable);
        return results.map((result, index) =>
          index === 0 ? { status: 'rejected', reason: rejection } : result
        );
      });

    const traceOne = { id: 1, sequence: ['alpha'] };
    const traceTwo = { id: 2, sequence: ['beta'] };

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        outputDirectory,
        traces: [
          { traceData: traceOne, fileName: 'first.json' },
          { traceData: traceTwo, fileName: 'second.json' },
        ],
      });

    expect(allSettledSpy).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      successCount: 1,
      failureCount: 1,
    });

    const [firstResult, secondResult] = response.body.results;
    expect(firstResult).toMatchObject({
      index: 0,
      fileName: 'first.json',
      success: false,
      error: 'synthetic aggregator rejection',
    });
    expect(secondResult).toMatchObject({
      index: 1,
      fileName: 'second.json',
      success: true,
    });

    const secondPath = path.join(absoluteDirectory, 'second.json');
    const secondContents = await readFile(secondPath, 'utf8');
    expect(JSON.parse(secondContents)).toEqual(traceTwo);
  });

  it('surfaces unexpected allSettled failures through the 500 error path', async () => {
    const app = buildApp();
    const outputDirectory = `./tmp-trace-batch/${randomUUID()}`;
    trackDirectory(outputDirectory);

    const failure = new Error('allSettled meltdown');
    jest.spyOn(Promise, 'allSettled').mockImplementation(async () => {
      throw failure;
    });

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        outputDirectory,
        traces: [{ traceData: { payload: true }, fileName: 'boom.json' }],
      });

    expect(response.status).toBe(500);
    expect(response.body).toEqual({
      success: false,
      error: 'Batch write operation failed',
      details: 'allSettled meltdown',
    });
  });
});
