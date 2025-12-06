/**
 * @file metrics-middleware-serialization-resilience.integration.test.js
 * @description Integration coverage focusing on metrics middleware resilience when
 *              serialization fails and when the metrics backend throws unexpectedly.
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';

import MetricsService from '../../src/services/metricsService.js';
import { createMetricsMiddleware } from '../../src/middleware/metrics.js';

const createTestLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const buildApp = ({ metricsService, logger, configure }) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.correlationId = 'metrics-serialization-suite';
    next();
  });
  app.use(
    createMetricsMiddleware({
      metricsService,
      logger,
    })
  );
  configure(app);
  return app;
};

describe('Metrics middleware serialization resilience integration', () => {
  let logger;

  beforeEach(() => {
    logger = createTestLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records fallback response size when JSON serialization fails mid-flight', async () => {
    const metricsService = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });

    const app = buildApp({
      metricsService,
      logger,
      configure: (expressApp) => {
        expressApp.get('/circular-response', (_req, res) => {
          res.status(200);
          res.set('Content-Type', 'application/json');

          const circular = {};
          circular.self = circular;

          try {
            res.end(circular);
          } catch (_error) {
            res.end('{"status":"fallback"}');
          }
        });
      },
    });

    const response = await request(app).get('/circular-response');

    expect(response.status).toBe(200);
    expect(response.text).toBe('{"status":"fallback"}');

    await new Promise((resolve) => setImmediate(resolve));

    const metricsOutput = await metricsService.getMetrics();

    expect(metricsOutput).toContain('route="/circular-response"');
    expect(metricsOutput).toContain(
      'llm_proxy_http_response_size_bytes_sum{method="GET",route="/circular-response",status_code="200"} 1000'
    );

    metricsService.clear();
  });

  it('logs metrics backend failures without disrupting responses', async () => {
    const metricsService = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });

    const errorSpy = jest.spyOn(logger, 'error');
    jest.spyOn(metricsService, 'recordHttpRequest').mockImplementation(() => {
      throw new Error('intentional metrics failure');
    });

    const app = buildApp({
      metricsService,
      logger,
      configure: (expressApp) => {
        expressApp.get('/metrics-failure', (_req, res) => {
          res.status(503).json({ ok: false });
        });
      },
    });

    const response = await request(app).get('/metrics-failure');

    expect(response.status).toBe(503);
    expect(response.body).toEqual({ ok: false });

    await new Promise((resolve) => setImmediate(resolve));

    expect(errorSpy).toHaveBeenCalledWith(
      'Error recording HTTP request metrics',
      expect.objectContaining({ message: 'intentional metrics failure' })
    );

    metricsService.clear();
  });
});
