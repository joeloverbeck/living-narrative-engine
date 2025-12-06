/**
 * @file metrics-middleware-error-classification.integration.test.js
 * @description Integration tests extending coverage for metrics middleware error classification and
 *              resilience scenarios using real Express flows and MetricsService instances.
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

/**
 * Builds a deterministic logger mock compatible with the ILogger interface.
 * @returns {import('../../src/interfaces/coreServices.js').ILogger}
 */
const createTestLogger = () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  logger.isDebugEnabled = true;
  return logger;
};

/**
 * Creates an Express application wired with the metrics middleware.
 * @param {(app: import('express').Express) => void} configure - Allows routes to be configured for each test.
 * @param {MetricsService} metricsService - Metrics service instance under test.
 * @param {import('../../src/interfaces/coreServices.js').ILogger} logger - Logger instance for observability.
 * @returns {import('express').Express}
 */
const buildMetricsApp = (configure, metricsService, logger) => {
  const app = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    req.correlationId = 'metrics-error-classification';
    next();
  });

  app.use(
    createMetricsMiddleware({
      metricsService,
      logger,
      enabled: true,
    })
  );

  configure(app);

  return app;
};

describe('Metrics middleware error classification hardening', () => {
  let logger;
  let metricsService;

  beforeEach(() => {
    logger = createTestLogger();
    metricsService = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    metricsService.clear();
  });

  it('classifies 409 responses as conflict client errors with low severity while tolerating header lookups that throw', async () => {
    const recordHttpRequestSpy = jest.spyOn(
      metricsService,
      'recordHttpRequest'
    );
    const recordErrorSpy = jest.spyOn(metricsService, 'recordError');

    const app = buildMetricsApp(
      (expressApp) => {
        expressApp.get('/conflict-resource', (req, res) => {
          const originalGet = res.get.bind(res);
          res.get = (header) => {
            if (header && header.toLowerCase() === 'content-length') {
              throw new Error('content length unavailable');
            }
            return originalGet(header);
          };

          res.status(409).json({ error: 'conflict' });
        });
      },
      metricsService,
      logger
    );

    await request(app).get('/conflict-resource').expect(409);

    await new Promise((resolve) => setImmediate(resolve));

    expect(recordHttpRequestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        route: '/conflict-resource',
        statusCode: 409,
        responseSize: 0,
      })
    );

    expect(recordErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        errorType: 'conflict',
        component: 'http_server',
        severity: 'low',
      })
    );

    expect(logger.error).not.toHaveBeenCalledWith(
      'Error recording HTTP request metrics',
      expect.any(Error)
    );
  });

  it('treats non-standard 599 responses as server errors with high severity for observability', async () => {
    const recordErrorSpy = jest.spyOn(metricsService, 'recordError');

    const app = buildMetricsApp(
      (expressApp) => {
        expressApp.get('/upstream-proxy', (_req, res) => {
          res.status(599).json({ error: 'network timeout' });
        });
      },
      metricsService,
      logger
    );

    await request(app).get('/upstream-proxy').expect(599);

    await new Promise((resolve) => setImmediate(resolve));

    expect(recordErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        errorType: 'server_error',
        severity: 'high',
      })
    );
  });

  it('continues recording metrics when responses reuse the same socket and finish without explicit res.end payloads', async () => {
    const recordHttpRequestSpy = jest.spyOn(
      metricsService,
      'recordHttpRequest'
    );

    const app = buildMetricsApp(
      (expressApp) => {
        expressApp.get('/streamed', (req, res) => {
          res.status(502);
          res.setHeader('transfer-encoding', 'chunked');
          res.write('partial-data');
          res.end();
        });
      },
      metricsService,
      logger
    );

    await request(app).get('/streamed').expect(502);

    await new Promise((resolve) => setImmediate(resolve));

    expect(recordHttpRequestSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/streamed',
        statusCode: 502,
        requestSize: 0,
      })
    );

    const metricsOutput = await metricsService.getMetrics();

    expect(metricsOutput).toContain(
      'llm_proxy_http_requests_total{method="GET",route="/streamed",status_code="502"} 1'
    );
  });
});
