import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';

import traceRoutes from '../../src/routes/traceRoutes.js';

const projectRoot = path.resolve(process.cwd(), '../');

/**
 * Builds an express app configured with the trace routes for integration testing.
 * @returns {import('express').Express}
 */
function buildApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/traces', traceRoutes);
  return app;
}

const createdDirectories = new Set();

const registerDirectoryForCleanup = (relativePath) => {
  const normalized = relativePath.startsWith('./')
    ? relativePath.slice(2)
    : relativePath;
  const fullPath = path.join(projectRoot, normalized);
  createdDirectories.add(fullPath);
  return fullPath;
};

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

describe('traceRoutes batch success statistics integration', () => {
  it('returns accurate aggregate metrics when every trace write succeeds', async () => {
    const app = buildApp();
    const outputDirectory = `./tmp-traces/${randomUUID()}`;
    const expectedDirectory = registerDirectoryForCleanup(outputDirectory);

    await mkdir(expectedDirectory, { recursive: true });

    const traceOne = '{"event":"alpha","success":true}';
    const traceTwo = '{"event":"beta","steps":3}';

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        outputDirectory,
        traces: [
          { traceData: traceOne, fileName: 'alpha.json' },
          { traceData: traceTwo, fileName: 'beta.json' },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      successCount: 2,
      failureCount: 0,
      totalSize: traceOne.length + traceTwo.length,
    });

    const [firstResult, secondResult] = response.body.results;
    expect(firstResult).toMatchObject({
      fileName: 'alpha.json',
      success: true,
      bytesWritten: traceOne.length,
    });
    expect(secondResult).toMatchObject({
      fileName: 'beta.json',
      success: true,
      bytesWritten: traceTwo.length,
    });

    const alphaContent = await readFile(
      path.join(expectedDirectory, 'alpha.json'),
      'utf8'
    );
    const betaContent = await readFile(
      path.join(expectedDirectory, 'beta.json'),
      'utf8'
    );

    expect(alphaContent).toBe(traceOne);
    expect(betaContent).toBe(traceTwo);
  });
});
