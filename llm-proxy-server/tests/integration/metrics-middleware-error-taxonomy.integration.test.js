/**
 * @file metrics-middleware-error-taxonomy.integration.test.js
 * @description Validates that the metrics middleware classifies a broad set of HTTP status codes
 *              into the correct Prometheus error taxonomy when wired with the real MetricsService.
 */

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

import { createMetricsMiddleware } from '../../src/middleware/metrics.js';
import MetricsService from '../../src/services/metricsService.js';

/**
 * Constructs a deterministic logger compatible with the ILogger interface.
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
 * Builds an Express app configured with the metrics middleware and a flexible status route.
 * @param {MetricsService} metricsService - Real metrics service instance for the test run.
 * @param {import('../../src/interfaces/coreServices.js').ILogger} logger - Logger used by the middleware.
 * @returns {import('express').Express}
 */
const buildAppWithMetrics = (metricsService, logger) => {
  const app = express();
  app.use(express.json());

  app.use((req, _res, next) => {
    req.correlationId = `taxonomy-${req.method}-${req.path}`;
    next();
  });

  app.use(
    createMetricsMiddleware({
      metricsService,
      logger,
      enabled: true,
    })
  );

  app.all('/status/:code', (req, res) => {
    const statusCode = Number.parseInt(req.params.code, 10);

    if (Number.isNaN(statusCode)) {
      return res.status(400).json({ error: 'invalid-status' });
    }

    const body = {
      error: `status-${statusCode}`,
      details: { source: 'taxonomy-suite' },
    };

    return res.status(statusCode).json(body);
  });

  return app;
};

describe('Metrics middleware extended error taxonomy integration', () => {
  let logger;
  let metricsService;
  let app;

  beforeEach(() => {
    logger = createTestLogger();
    metricsService = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });
    app = buildAppWithMetrics(metricsService, logger);
  });

  afterEach(() => {
    metricsService.clear();
    jest.restoreAllMocks();
  });

  it('classifies uncommon status codes with the appropriate error types and severities', async () => {
    const scenarios = [
      { code: 400, errorType: 'bad_request', severity: 'low' },
      { code: 401, errorType: 'unauthorized', severity: 'medium' },
      { code: 403, errorType: 'forbidden', severity: 'medium' },
      { code: 404, errorType: 'not_found', severity: 'low' },
      { code: 405, errorType: 'method_not_allowed', severity: 'low' },
      { code: 408, errorType: 'request_timeout', severity: 'low' },
      { code: 413, errorType: 'payload_too_large', severity: 'low' },
      { code: 418, errorType: 'client_error', severity: 'low' },
      { code: 429, errorType: 'rate_limit_exceeded', severity: 'medium' },
      { code: 500, errorType: 'internal_server_error', severity: 'high' },
      { code: 501, errorType: 'not_implemented', severity: 'high' },
      { code: 502, errorType: 'bad_gateway', severity: 'high' },
      { code: 503, errorType: 'service_unavailable', severity: 'high' },
      { code: 504, errorType: 'gateway_timeout', severity: 'high' },
      { code: 599, errorType: 'server_error', severity: 'high' },
    ];

    for (const { code } of scenarios) {
      await request(app).get(`/status/${code}`).expect(code);
    }

    await new Promise((resolve) => setImmediate(resolve));

    const metricsSnapshot = await metricsService.getMetrics();

    for (const { code } of scenarios) {
      expect(metricsSnapshot).toContain(
        `llm_proxy_http_requests_total{method="GET",route="/status/:id",status_code="${code}"} 1`
      );
    }

    for (const { errorType, severity } of scenarios) {
      expect(metricsSnapshot).toContain(
        `llm_proxy_errors_total{error_type="${errorType}",component="http_server",severity="${severity}"} 1`
      );
    }

    expect(logger.debug).toHaveBeenCalledWith(
      'HTTP request metrics recorded',
      expect.objectContaining({
        route: '/status/:id',
        statusCode: 400,
      })
    );
  });
});
