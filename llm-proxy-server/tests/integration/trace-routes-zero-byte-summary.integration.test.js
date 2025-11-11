import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import path from 'node:path';
import { readFile, rm, stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

import traceRoutes from '../../src/routes/traceRoutes.js';

const projectRoot = path.resolve(__dirname, '../../../');
const createdDirectories = new Set();

const trackDirectory = (relativePath) => {
  const normalized = relativePath.startsWith('./')
    ? relativePath.slice(2)
    : relativePath;
  const absolutePath = path.join(projectRoot, normalized);
  createdDirectories.add(absolutePath);
  return absolutePath;
};

/**
 * Clean up leftover test directories from previous test runs.
 * This ensures a clean state even if previous tests were interrupted.
 */
async function cleanupLeftoverDirectories() {
  const dirsToClean = [
    path.join(projectRoot, 'tmp-traces-zero'),
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

function buildApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/traces', traceRoutes);
  return app;
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
      console.error('trace route zero-byte cleanup failed', {
        directory,
        error: error.message,
      });
    }
  }
  createdDirectories.clear();

  // Also clean up parent directories if empty
  await cleanupLeftoverDirectories();
});

describe('traceRoutes zero-byte summary integration', () => {
  it('tallies zero-byte success writes without losing batch totals', async () => {
    const app = buildApp();
    const outputDirectory = `./tmp-traces-zero/${randomUUID()}`;
    const absoluteDirectory = trackDirectory(outputDirectory);

    const originalStringify = JSON.stringify;
    let response;

    try {
      JSON.stringify = (value, replacer, space) => {
        if (value && value.__forceEmpty === true) {
          return '';
        }
        return originalStringify(value, replacer, space);
      };

      response = await request(app)
        .post('/api/traces/write-batch')
        .send({
          outputDirectory,
          traces: [
            { traceData: { __forceEmpty: true }, fileName: 'empty.txt' },
            {
              traceData: { id: 1, message: 'non-empty' },
              fileName: 'payload.json',
            },
          ],
        });
    } finally {
      JSON.stringify = originalStringify;
    }

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      successCount: 2,
      failureCount: 0,
    });

    const emptyFilePath = path.join(absoluteDirectory, 'empty.txt');
    const payloadFilePath = path.join(absoluteDirectory, 'payload.json');

    const emptyStats = await stat(emptyFilePath);
    const payloadStats = await stat(payloadFilePath);

    expect(emptyStats.size).toBe(0);
    expect(payloadStats.size).toBeGreaterThan(0);

    const payloadContent = await readFile(payloadFilePath, 'utf8');
    expect(JSON.parse(payloadContent)).toEqual({ id: 1, message: 'non-empty' });

    const zeroByteResult = response.body.results.find(
      (result) => result.fileName === 'empty.txt'
    );
    expect(zeroByteResult).toBeDefined();
    expect(zeroByteResult.success).toBe(true);
    expect(zeroByteResult.bytesWritten).toBe(0);

    const payloadResult = response.body.results.find(
      (result) => result.fileName === 'payload.json'
    );
    expect(payloadResult).toBeDefined();
    expect(payloadResult.bytesWritten).toBeGreaterThan(0);

    expect(response.body.totalSize).toBe(payloadResult.bytesWritten);
    expect(response.body.totalSize).toBe(payloadStats.size);
  });
});
