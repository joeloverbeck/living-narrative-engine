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
import { readFile, rm } from 'node:fs/promises';

import { ConsoleLogger } from '../../../src/consoleLogger.js';
import { ExpressionLogController } from '../../../src/handlers/expressionLogController.js';
import { ExpressionLogService } from '../../../src/services/expressionLogService.js';
import { createExpressionRoutes } from '../../../src/routes/expressionRoutes.js';

const projectRoot = path.resolve(process.cwd(), '../');

/**
 * Builds an express app configured with the expression log route.
 * @param {string} logDirectory
 * @param {ConsoleLogger} logger
 * @returns {import('express').Express}
 */
function buildApp(logDirectory, logger) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const logService = new ExpressionLogService(logger, '../', logDirectory);
  const logController = new ExpressionLogController(logger, logService);
  const statusController = {
    handleScanStatuses: (_req, res) =>
      res.status(200).json({ success: true, expressions: [] }),
    handleUpdateStatus: (_req, res) =>
      res.status(200).json({ success: true, message: 'ok' }),
  };

  app.use(
    '/api/expressions',
    createExpressionRoutes(statusController, logController)
  );
  return app;
}

describe('Expression log endpoint integration', () => {
  let logDirectory;
  let logger;
  let server;

  beforeEach(() => {
    logDirectory = path.join('logs', 'expressions-test', randomUUID());

    logger = new ConsoleLogger();
    jest.spyOn(logger, 'debug').mockImplementation(() => {});
    jest.spyOn(logger, 'info').mockImplementation(() => {});
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
    jest.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      server = null;
    }
    if (logDirectory) {
      await rm(path.join(projectRoot, logDirectory), {
        recursive: true,
        force: true,
      });
    }
  });

  it('appends a JSONL entry and returns path/bytes written', async () => {
    const app = buildApp(logDirectory, logger);
    server = await new Promise((resolve) => {
      const createdServer = app.listen(0, '127.0.0.1', () =>
        resolve(createdServer)
      );
    });
    const requestAgent = request(server);
    const entry = {
      timestamp: '2025-01-13T20:34:56.123Z',
      actorId: 'actor:abc',
      matches: [],
      selected: null,
      dispatch: { attempted: true, success: true, rateLimited: false },
    };

    const response = await requestAgent
      .post('/api/expressions/log')
      .send({ entry });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.bytesWritten).toBe(
      Buffer.byteLength(`${JSON.stringify(entry)}\n`, 'utf8')
    );

    const normalizedPath = path.normalize(response.body.path);
    const normalizedDirectory = path.normalize(`${logDirectory}${path.sep}`);
    expect(normalizedPath.startsWith(normalizedDirectory)).toBe(true);
    expect(normalizedPath.endsWith('.jsonl')).toBe(true);

    const content = await readFile(
      path.join(projectRoot, response.body.path),
      'utf8'
    );
    const [line] = content.trim().split('\n');
    expect(JSON.parse(line)).toEqual(entry);
  });

  it('returns 400 when entry is missing', async () => {
    const app = buildApp(logDirectory, logger);
    server = await new Promise((resolve) => {
      const createdServer = app.listen(0, '127.0.0.1', () =>
        resolve(createdServer)
      );
    });
    const requestAgent = request(server);

    const response = await requestAgent
      .post('/api/expressions/log')
      .send({});

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: true,
      message: 'Missing required field: entry',
    });
  });
});
