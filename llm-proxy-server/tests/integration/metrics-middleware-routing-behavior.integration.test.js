/**
 * @file metrics-middleware-routing-behavior.integration.test.js
 * @description Integration tests that exercise the default route resolver
 *              and error classification paths within the metrics middleware
 *              using a fully wired Express application.
 */

import {
  beforeEach,
  afterEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';

import MetricsService from '../../src/services/metricsService.js';
import { createMetricsMiddleware } from '../../src/middleware/metrics.js';

const HTTP_REQUESTS_TOTAL = 'llm_proxy_http_requests_total';
const ERRORS_TOTAL = 'llm_proxy_errors_total';

/**
 * Utility that finds a Prometheus metric payload by name.
 * @param {Array<import('prom-client').Metric>} metrics
 * @param {string} name
 * @returns {import('prom-client').Metric | undefined}
 */
function findMetric(metrics, name) {
  return metrics.find((metric) => metric.name === name);
}

describe('metrics middleware default route resolver integration', () => {
  /** @type {MetricsService} */
  let metricsService;
  let logger;

  beforeEach(() => {
    jest.useRealTimers();
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    metricsService = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });
  });

  afterEach(() => {
    if (metricsService) {
      metricsService.reset();
      metricsService.clear();
    }
    jest.restoreAllMocks();
  });

  it('normalizes real HTTP routes and skips instrumentation for the /metrics endpoint', async () => {
    const app = express();
    app.use(express.json());

    // Provide a correlation id so debug logging captures the request context.
    app.use((req, _res, next) => {
      req.correlationId = 'route-normalization';
      next();
    });

    app.use(createMetricsMiddleware({ metricsService, logger }));

    app.get('/health/ready', (req, res) => {
      res.status(200).send('ready');
    });

    app.get('/api/users/:userId', (req, res) => {
      res.status(404).json({ missing: req.params.userId });
    });

    app.get('/files/:hash', (req, res) => {
      res.status(503).json({ hash: req.params.hash });
    });

    app.get('/', (_req, res) => {
      res.status(204).send();
    });

    app.get('/metrics', (_req, res) => {
      res.status(200).type('text/plain').send('prometheus-ready');
    });

    await request(app).get('/health/ready?debug=true');
    await request(app).get('/api/users/42');
    await request(app).get('/files/abcdef1234567890');
    await request(app).get('/');
    await request(app).get('/metrics');

    const metrics = await metricsService.getRegistry().getMetricsAsJSON();
    const httpMetric = findMetric(metrics, HTTP_REQUESTS_TOTAL);
    expect(httpMetric).toBeDefined();

    const recordedRoutes = (httpMetric?.values || []).map(
      (entry) => entry.labels.route
    );
    expect(recordedRoutes).toEqual(
      expect.arrayContaining([
        '/health/ready',
        '/api/users/:id',
        '/files/:hash',
        '/',
      ])
    );
    expect(recordedRoutes).not.toContain('/metrics');

    expect(logger.debug).toHaveBeenCalledWith(
      'HTTP request metrics recorded',
      expect.objectContaining({ route: '/api/users/:id', statusCode: 404 })
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'HTTP request metrics recorded',
      expect.objectContaining({ route: '/files/:hash', statusCode: 503 })
    );
  });

  it('classifies error severities for rate limiting and service failures while honoring disabled mode', async () => {
    const errorSpy = jest.spyOn(metricsService, 'recordError');

    const app = express();
    app.use(express.json());

    app.use((req, _res, next) => {
      req.correlationId = 'error-severity';
      next();
    });

    app.use(createMetricsMiddleware({ metricsService, logger }));

    app.post('/limited/:clientId', (_req, res) => {
      res.status(429).json({ error: 'rate limited' });
    });

    app.get('/service-outage', (_req, res) => {
      res.status(503).send('temporarily unavailable');
    });

    await request(app).post('/limited/alpha').send({ payload: 'test' });
    await request(app).get('/service-outage');

    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        errorType: 'rate_limit_exceeded',
        component: 'http_server',
        severity: 'medium',
      })
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        errorType: 'service_unavailable',
        component: 'http_server',
        severity: 'high',
      })
    );

    const errorMetric = findMetric(
      await metricsService.getRegistry().getMetricsAsJSON(),
      ERRORS_TOTAL
    );
    expect(errorMetric?.values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          labels: expect.objectContaining({
            error_type: 'rate_limit_exceeded',
            severity: 'medium',
          }),
        }),
        expect.objectContaining({
          labels: expect.objectContaining({
            error_type: 'service_unavailable',
            severity: 'high',
          }),
        }),
      ])
    );

    metricsService.reset();

    const disabledApp = express();
    disabledApp.use(
      createMetricsMiddleware({ metricsService, logger, enabled: false })
    );
    disabledApp.get('/disabled', (_req, res) => {
      res.status(200).send('ok');
    });

    await request(disabledApp).get('/disabled');

    const disabledMetrics = await metricsService
      .getRegistry()
      .getMetricsAsJSON();
    const disabledHttpMetric = findMetric(disabledMetrics, HTTP_REQUESTS_TOTAL);
    expect(disabledHttpMetric?.values || []).toHaveLength(0);
  });
});
