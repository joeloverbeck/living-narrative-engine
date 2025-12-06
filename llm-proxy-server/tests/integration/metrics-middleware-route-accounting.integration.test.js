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
 * Creates a deterministic logger implementation compatible with ILogger.
 * @returns {import('../../src/interfaces/coreServices.js').ILogger}
 */
const createTestLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('metrics middleware route & payload accounting integration', () => {
  let metricsService;
  let logger;

  beforeEach(() => {
    jest.useRealTimers();
    logger = createTestLogger();
    metricsService = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });
  });

  afterEach(() => {
    metricsService.clear();
  });

  it('parameterizes diverse routes while skipping the metrics endpoint when defaults are used', async () => {
    const app = express();

    app.use((req, _res, next) => {
      req.correlationId = `route-${req.method}-${req.path}`;
      next();
    });

    // Intentionally omit logger/routeResolver options to exercise defaults.
    app.use(
      createMetricsMiddleware({
        metricsService,
      })
    );

    app.get('/metrics', (_req, res) => {
      res.status(200).send('metrics-placeholder');
    });

    app.get('/api/orders/12345/v2/abcdef1234567890/details', (_req, res) => {
      res.status(201).json({ orderId: 12345, secretToken: 's3cr3t' });
    });

    app.get('/api/just-one', (_req, res) => {
      res.status(204).end();
    });

    app.get('/legacy', (req, res) => {
      // Simulate environments that only populate req.url to exercise fallbacks.
      delete req.originalUrl;
      req.url = '/legacy?debug=true';
      res.status(202).end('legacy');
    });

    app.get('/', (_req, res) => {
      res.status(200).send('root');
    });

    await request(app).get('/metrics').expect(200);
    await request(app)
      .get('/api/orders/12345/v2/abcdef1234567890/details?query=1')
      .expect(201);
    await request(app).get('/api/just-one').expect(204);
    await request(app).get('/legacy?debug=true').expect(202);
    await request(app).get('/').expect(200);

    await new Promise((resolve) => setImmediate(resolve));

    const metricsSnapshot = await metricsService.getMetrics();

    expect(metricsSnapshot).toContain(
      'llm_proxy_http_requests_total{method="GET",route="/api/orders/:id/v*/:hash/details",status_code="201"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_http_requests_total{method="GET",route="/api/*",status_code="204"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_http_requests_total{method="GET",route="/legacy",status_code="202"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_http_requests_total{method="GET",route="/",status_code="200"} 1'
    );
    expect(metricsSnapshot).not.toContain('route="/metrics"');
  });

  it('captures request and response sizes across string, buffer, and numeric payloads', async () => {
    const app = express();
    app.use(express.text());
    app.use(express.json());

    app.use((req, _res, next) => {
      req.correlationId = `payload-${req.method}-${req.path}`;
      next();
    });

    app.use(
      createMetricsMiddleware({
        metricsService,
      })
    );

    app.get('/no-body', (_req, res) => {
      res.status(204).end();
    });

    app.post('/text-body', (req, res) => {
      // express.text keeps req.body as a string to exercise non-object request paths
      expect(typeof req.body).toBe('string');
      res.status(207).send('text-response');
    });

    app.post('/buffer-response', (req, res) => {
      const payload = Buffer.from('binary-response');
      res.status(206).end(payload);
    });

    await request(app).get('/no-body').expect(204);
    await request(app)
      .post('/text-body')
      .set('content-type', 'text/plain')
      .send('raw-body')
      .expect(207);
    await request(app)
      .post('/buffer-response')
      .set('content-type', 'application/json')
      .send({ example: 'data' })
      .expect(206);

    await new Promise((resolve) => setImmediate(resolve));

    const metricsSnapshot = await metricsService.getMetrics();

    expect(metricsSnapshot).toContain(
      'llm_proxy_http_requests_total{method="GET",route="/no-body",status_code="204"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_http_request_size_bytes_bucket{le="100",method="POST",route="/text-body"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_http_response_size_bytes_bucket{le="100",method="POST",route="/text-body",status_code="207"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_http_request_size_bytes_bucket{le="100",method="POST",route="/buffer-response"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_http_response_size_bytes_bucket{le="100",method="POST",route="/buffer-response",status_code="206"} 1'
    );
  });
});
