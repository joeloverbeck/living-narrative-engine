import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { readFile, rm } from 'node:fs/promises';

import traceRoutes from '../../src/routes/traceRoutes.js';

const projectRoot = path.resolve(process.cwd(), '../');

/**
 * Builds an Express application wired with the trace routes.
 * @returns {import('express').Express}
 */
function buildApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/traces', traceRoutes);
  return app;
}

const createdDirectories = new Set();

/**
 * Tracks temporary directories for reliable cleanup.
 * @param {string} relativePath
 * @returns {string}
 */
function registerDirectoryForCleanup(relativePath) {
  const normalized = relativePath.startsWith('./')
    ? relativePath.slice(2)
    : relativePath;
  const fullPath = path.join(projectRoot, normalized);
  createdDirectories.add(fullPath);
  return fullPath;
}

beforeEach(() => {
  createdDirectories.clear();
});

afterEach(async () => {
  const paths = Array.from(createdDirectories).sort(
    (a, b) => b.length - a.length
  );
  for (const directory of paths) {
    try {
      await rm(directory, { recursive: true, force: true });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(
        'Failed to remove temporary trace directory during cleanup',
        {
          directory,
          error: error.message,
        }
      );
    }
  }
  createdDirectories.clear();
});

describe('traceRoutes batch hardening integration coverage', () => {
  it('rejects batch writes that attempt to escape the project root', async () => {
    const app = buildApp();
    const outsideDirectory = `../../tmp/outside-batch-${randomUUID()}`;

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        outputDirectory: outsideDirectory,
        traces: [{ traceData: { should: 'fail' }, fileName: 'escape.json' }],
      });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      success: false,
      error: 'Invalid output path',
    });
  });

  it('surfaces failures when Promise.allSettled cannot evaluate batch results', async () => {
    const app = buildApp();
    const outputDirectory = `./tmp-traces/${randomUUID()}`;
    registerDirectoryForCleanup(outputDirectory);

    const restoreAllSettled = Promise.allSettled;
    Promise.allSettled = async () => {
      throw new Error('Simulated settlement failure');
    };

    try {
      const response = await request(app)
        .post('/api/traces/write-batch')
        .send({
          outputDirectory,
          traces: [{ traceData: { index: 0 }, fileName: 'one.json' }],
        });

      expect(response.status).toBe(500);
      expect(response.body).toMatchObject({
        success: false,
        error: 'Batch write operation failed',
        details: 'Simulated settlement failure',
      });
    } finally {
      Promise.allSettled = restoreAllSettled;
    }
  });

  it('records rejected settlement entries while preserving successful writes', async () => {
    const app = buildApp();
    const outputDirectory = `./tmp-traces/${randomUUID()}`;
    const expectedDirectory = registerDirectoryForCleanup(outputDirectory);

    const restoreAllSettled = Promise.allSettled;
    const originalAllSettled = Promise.allSettled.bind(Promise);
    Promise.allSettled = async (iterable) => {
      const results = await originalAllSettled(iterable);
      if (results.length === 0) {
        return results;
      }

      const rejectionError = new Error('Injected post-settlement rejection');
      const mutated = results.slice();
      if (mutated.length >= 2) {
        mutated[1] = { status: 'rejected', reason: rejectionError };
      } else {
        mutated[0] = { status: 'rejected', reason: rejectionError };
      }
      return mutated;
    };

    try {
      const response = await request(app)
        .post('/api/traces/write-batch')
        .send({
          outputDirectory,
          traces: [
            { traceData: { id: 1 }, fileName: 'success.json' },
            { traceData: { id: 2 }, fileName: 'rejection.json' },
          ],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.successCount).toBe(1);
      expect(response.body.failureCount).toBe(1);
      expect(response.body.results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fileName: 'success.json',
            success: true,
          }),
          expect.objectContaining({
            fileName: 'rejection.json',
            success: false,
            error: 'Injected post-settlement rejection',
          }),
        ])
      );

      const writtenContent = await readFile(
        path.join(expectedDirectory, 'success.json'),
        'utf8'
      );
      expect(JSON.parse(writtenContent)).toEqual({ id: 1 });
    } finally {
      Promise.allSettled = restoreAllSettled;
    }
  });
});
