/**
 * @file expression-routes-cors.integration.test.js
 * @description Integration tests for expression routes CORS behavior
 */

import {
  describe,
  test,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import express from 'express';
import cors from 'cors';
import request from 'supertest';
import { getAppConfigService } from '../../src/config/appConfig.js';
import {
  HTTP_HEADER_CONTENT_TYPE,
  HTTP_METHOD_OPTIONS,
  HTTP_METHOD_POST,
} from '../../src/config/constants.js';
import { ConsoleLogger } from '../../src/consoleLogger.js';
import { createExpressionRoutes } from '../../src/routes/expressionRoutes.js';

describe('Expression routes CORS integration tests', () => {
  let app;
  let server;
  let requestAgent;
  let originalEnv;
  let mockLogger;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    process.env.PROXY_ALLOWED_ORIGIN = 'http://localhost:8080';

    mockLogger = new ConsoleLogger();
    jest.spyOn(mockLogger, 'debug').mockImplementation(() => {});
    jest.spyOn(mockLogger, 'info').mockImplementation(() => {});
    jest.spyOn(mockLogger, 'warn').mockImplementation(() => {});
    jest.spyOn(mockLogger, 'error').mockImplementation(() => {});

    const appConfigService = getAppConfigService(mockLogger);
    const allowedOriginsArray = appConfigService.getAllowedOriginsArray();

    app = express();

    if (allowedOriginsArray.length > 0) {
      app.use(
        cors({
          origin: allowedOriginsArray,
          methods: ['GET', HTTP_METHOD_POST, HTTP_METHOD_OPTIONS],
          allowedHeaders: [HTTP_HEADER_CONTENT_TYPE, 'X-Title', 'HTTP-Referer'],
        })
      );
    }

    app.use(express.json());

    const mockController = {
      handleScanStatuses: jest.fn((_req, res) =>
        res.status(200).json({ success: true, expressions: [] })
      ),
      handleUpdateStatus: jest.fn((_req, res) =>
        res.status(200).json({ success: true, message: 'ok' })
      ),
    };

    app.use('/api/expressions', createExpressionRoutes(mockController));

    server = await new Promise((resolve) => {
      const createdServer = app.listen(0, '127.0.0.1', () =>
        resolve(createdServer)
      );
    });
    requestAgent = request(server);
  });

  afterEach(async () => {
    process.env = originalEnv;
    jest.restoreAllMocks();
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('OPTIONS preflight for scan-statuses includes expected CORS headers', async () => {
    const response = await requestAgent
      .options('/api/expressions/scan-statuses')
      .set('Origin', 'http://localhost:8080')
      .set('Access-Control-Request-Method', 'GET')
      .set('Access-Control-Request-Headers', HTTP_HEADER_CONTENT_TYPE);

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:8080'
    );
    expect(response.headers['access-control-allow-methods']).toContain('GET');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    expect(response.headers['access-control-allow-methods']).toContain('OPTIONS');
  });

  test('OPTIONS preflight for update-status includes expected CORS headers', async () => {
    const response = await requestAgent
      .options('/api/expressions/update-status')
      .set('Origin', 'http://localhost:8080')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', HTTP_HEADER_CONTENT_TYPE);

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:8080'
    );
    expect(response.headers['access-control-allow-methods']).toContain('GET');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
    expect(response.headers['access-control-allow-methods']).toContain('OPTIONS');
  });

  test('GET scan-statuses includes Access-Control-Allow-Origin', async () => {
    const response = await requestAgent
      .get('/api/expressions/scan-statuses')
      .set('Origin', 'http://localhost:8080');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:8080'
    );
  });

  test('POST update-status includes Access-Control-Allow-Origin', async () => {
    const response = await requestAgent
      .post('/api/expressions/update-status')
      .set('Origin', 'http://localhost:8080')
      .set(HTTP_HEADER_CONTENT_TYPE, 'application/json')
      .send({ filePath: 'test.expression.json', status: 'normal' });

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:8080'
    );
  });
});
