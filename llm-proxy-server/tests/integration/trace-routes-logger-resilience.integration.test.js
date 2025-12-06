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
import { randomUUID } from 'node:crypto';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const projectRoot = path.resolve(process.cwd(), '../');

/**
 * Normalises a relative directory path used by the trace routes into an absolute
 * path rooted at the project directory and registers it for cleanup.
 * @param {Set<string>} registry
 * @param {string} relativePath
 * @returns {string}
 */
function trackDirectory(registry, relativePath) {
  const normalised = relativePath.startsWith('./')
    ? relativePath.slice(2)
    : relativePath;
  const fullPath = path.join(projectRoot, normalised);
  registry.add(fullPath);
  return fullPath;
}

/**
 * Builds an express app wired with the trace routes while injecting a custom
 * logger implementation that can simulate failures.
 * @param {object} overrides
 * @returns {Promise<{ app: import('express').Express, logger: object }>}
 */
async function buildAppWithLogger(overrides = {}) {
  const { ConsoleLogger } = await import('../../src/consoleLogger.js');

  const logger = {
    debug: jest.spyOn(ConsoleLogger.prototype, 'debug'),
    info: jest.spyOn(ConsoleLogger.prototype, 'info'),
    warn: jest.spyOn(ConsoleLogger.prototype, 'warn'),
    error: jest.spyOn(ConsoleLogger.prototype, 'error'),
  };

  if (overrides.debug) {
    logger.debug.mockImplementation(overrides.debug);
  }
  if (overrides.info) {
    logger.info.mockImplementation(overrides.info);
  }
  if (overrides.warn) {
    logger.warn.mockImplementation(overrides.warn);
  }
  if (overrides.error) {
    logger.error.mockImplementation(overrides.error);
  }

  const { default: traceRoutes } = await import(
    '../../src/routes/traceRoutes.js'
  );

  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/traces', traceRoutes);

  return { app, logger };
}

describe('traceRoutes logger resilience integration', () => {
  const createdPaths = new Set();

  beforeEach(() => {
    createdPaths.clear();
    jest.resetModules();
  });

  afterEach(async () => {
    for (const directory of createdPaths) {
      try {
        await rm(directory, { recursive: true, force: true });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to remove temporary trace directory', {
          directory,
          error: error.message,
        });
      }
    }
    createdPaths.clear();
    jest.restoreAllMocks();
    jest.resetModules();
  });

  it('maps rejected batch writes when the logger fails during per-trace error reporting', async () => {
    const failureMessage = 'simulated logger failure during trace write';
    const { app, logger } = await buildAppWithLogger({
      error: jest.fn(() => {
        throw new Error(failureMessage);
      }),
    });

    const outputDirectory = `./tmp-traces/${randomUUID()}`;
    const fullDirectory = trackDirectory(createdPaths, outputDirectory);
    await mkdir(fullDirectory, { recursive: true });
    await mkdir(path.join(fullDirectory, 'conflict.json'));

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        outputDirectory,
        traces: [
          { traceData: { id: 1, ok: true }, fileName: 'success.json' },
          { traceData: { id: 2, fail: true }, fileName: 'conflict.json' },
        ],
      });

    expect(logger.error).toHaveBeenCalled();
    expect(response.status).toBe(200);
    expect(response.body.successCount).toBe(1);
    expect(response.body.failureCount).toBe(1);

    const failureEntry = response.body.results.find(
      (entry) => entry.fileName === 'conflict.json'
    );
    expect(failureEntry).toBeDefined();
    expect(failureEntry.success).toBe(false);
    expect(failureEntry.error).toContain(failureMessage);
  });

  it('returns a 500 response when summary logging throws after batch processing', async () => {
    const summaryFailure = 'summary logging failed';
    const { app, logger } = await buildAppWithLogger({
      info: jest.fn(() => {
        throw new Error(summaryFailure);
      }),
    });

    const outputDirectory = `./tmp-traces/${randomUUID()}`;
    trackDirectory(createdPaths, outputDirectory);

    const response = await request(app)
      .post('/api/traces/write-batch')
      .send({
        outputDirectory,
        traces: [{ traceData: { id: 'only' }, fileName: 'only.json' }],
      });

    expect(logger.info).toHaveBeenCalled();
    expect(response.status).toBe(500);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        error: 'Batch write operation failed',
        details: summaryFailure,
      })
    );
  });
});
