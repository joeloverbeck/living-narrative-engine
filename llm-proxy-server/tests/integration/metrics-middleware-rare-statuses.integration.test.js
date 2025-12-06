import {
  describe,
  beforeEach,
  afterEach,
  it,
  expect,
  jest,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createMetricsMiddleware } from '../../src/middleware/metrics.js';
import MetricsService from '../../src/services/metricsService.js';

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

describe('metrics middleware rare status taxonomy integration', () => {
  let app;
  let metricsService;
  let logger;

  beforeEach(() => {
    logger = createTestLogger();
    metricsService = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });

    app = express();
    app.use(express.json());

    app.use((req, _res, next) => {
      req.correlationId = `metrics-${req.method}-${req.path}`;
      next();
    });

    app.use(
      createMetricsMiddleware({
        metricsService,
        logger,
      })
    );

    app.get('/api/legal/12345/v2/items/abcdef123456', (_req, res) => {
      res.status(451).json({
        message: 'blocked-for-legal-reasons',
      });
    });

    app.get('/api/system/legacy', (_req, res) => {
      const payload = Buffer.from('legacy-outage');
      res.status(505).end(payload);
    });

    app.get('/metrics', async (_req, res) => {
      const snapshot = await metricsService.getMetrics();
      res.type('text/plain').send(snapshot);
    });
  });

  afterEach(() => {
    metricsService.clear();
    jest.restoreAllMocks();
  });

  it('maps uncommon HTTP error codes to taxonomy-aware metrics without recursion', async () => {
    await request(app)
      .get('/api/legal/12345/v2/items/abcdef123456')
      .set('X-Test-Scenario', 'client-error-default')
      .expect(451);

    await request(app)
      .get('/api/system/legacy')
      .set('X-Test-Scenario', 'server-error-default')
      .expect(505);

    // Allow async observers to flush before inspecting the registry.
    await new Promise((resolve) => setImmediate(resolve));

    const metricsSnapshot = await metricsService.getMetrics();

    expect(metricsSnapshot).toContain(
      'llm_proxy_http_requests_total{method="GET",route="/api/legal/:id/v*/items/:hash",status_code="451"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_errors_total{error_type="client_error",component="http_server",severity="low"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_http_requests_total{method="GET",route="/api/system/legacy",status_code="505"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_errors_total{error_type="server_error",component="http_server",severity="high"} 1'
    );

    const legacyDebugCall = logger.debug.mock.calls.find(
      (call) =>
        call[0] === 'HTTP request metrics recorded' &&
        call[1]?.route === '/api/system/legacy' &&
        call[1]?.statusCode === 505
    );
    expect(legacyDebugCall).toBeDefined();

    await request(app).get('/metrics').expect(200);

    const postMetricsSnapshot = await metricsService.getMetrics();
    expect(postMetricsSnapshot).not.toContain('route="/metrics"');

    const metricsRouteDebugCall = logger.debug.mock.calls.find(
      (call) => call[1]?.route === '/metrics'
    );
    expect(metricsRouteDebugCall).toBeUndefined();
  });
});
