/**
 * @file metrics-observability.integration.test.js
 * @description Integration tests ensuring MetricsService works end-to-end with middleware and routes
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
import {
  createMetricsMiddleware,
  createLlmMetricsMiddleware,
  createCacheMetricsRecorder,
} from '../../src/middleware/metrics.js';

const createTestLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('Metrics observability integration', () => {
  let app;
  let metricsService;
  let logger;

  const initializeApp = (service) => {
    const expressApp = express();
    expressApp.use(express.json());
    expressApp.use((req, _res, next) => {
      req.correlationId = 'integration-test';
      next();
    });

    expressApp.use(
      createMetricsMiddleware({
        metricsService: service,
        logger,
        enabled: service.isEnabled(),
      })
    );

    const cacheMetricsRecorder = createCacheMetricsRecorder({
      metricsService: service,
      cacheType: 'llm-cache',
    });

    expressApp.get('/sample', (_req, res) => {
      res.status(200).json({ ok: true });
    });

    expressApp.get('/error', (_req, res) => {
      res.status(500).json({ error: 'boom' });
    });

    expressApp.post(
      '/api/llm-request',
      createLlmMetricsMiddleware({ metricsService: service, logger }),
      (req, res) => {
        // Simulate downstream controller sending token usage information
        res.status(200).json({
          usage: {
            prompt_tokens: 120,
            completion_tokens: 12,
          },
        });
      }
    );

    expressApp.post('/cache/refresh', (_req, res) => {
      cacheMetricsRecorder.recordOperation('refresh', 'success', {
        entries: 3,
      });
      cacheMetricsRecorder.recordStats(3, 2048);
      res.status(204).send();
    });

    expressApp.get('/metrics', async (_req, res) => {
      try {
        const metrics = await service.getMetrics();
        res.status(200).send(metrics);
      } catch (error) {
        res.status(500).send(error.message);
      }
    });

    expressApp.get('/metrics/stats', (_req, res) => {
      res.status(200).json(service.getStats());
    });

    return expressApp;
  };

  beforeEach(() => {
    logger = createTestLogger();
    metricsService = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });
    app = initializeApp(metricsService);
  });

  afterEach(() => {
    if (metricsService) {
      metricsService.clear();
    }
  });

  it('records HTTP request metrics and exposes them via /metrics', async () => {
    await request(app).get('/sample').expect(200);

    const metricsResponse = await request(app).get('/metrics');

    expect(metricsResponse.status).toBe(200);
    expect(metricsResponse.text).toContain(
      'llm_proxy_http_requests_total{method="GET",route="/sample",status_code="200"} 1'
    );
    expect(metricsResponse.text).toContain(
      'llm_proxy_http_request_duration_seconds_count{method="GET",route="/sample",status_code="200"} 1'
    );

    const statsResponse = await request(app).get('/metrics/stats');
    expect(statsResponse.body).toMatchObject({ enabled: true });
    expect(typeof statsResponse.body.totalMetrics).toBe('number');
  });

  it('captures error metrics for failing HTTP requests', async () => {
    await request(app).get('/error').expect(500);

    const metricsResponse = await request(app).get('/metrics');
    expect(metricsResponse.text).toContain(
      'llm_proxy_errors_total{error_type="internal_server_error",component="http_server",severity="high"} 1'
    );
  });

  it('captures LLM request metrics including token usage', async () => {
    await request(app)
      .post('/api/llm-request')
      .send({ llmId: 'openai-gpt-4o', prompt: 'Hello world' })
      .expect(200);

    const metricsResponse = await request(app).get('/metrics');

    expect(metricsResponse.text).toContain(
      'llm_proxy_llm_requests_total{llm_provider="openai",model="gpt-4o",status="success"} 1'
    );
    expect(metricsResponse.text).toContain(
      'llm_proxy_llm_tokens_processed_total{llm_provider="openai",model="gpt-4o",token_type="input"} 120'
    );
    expect(metricsResponse.text).toContain(
      'llm_proxy_llm_tokens_processed_total{llm_provider="openai",model="gpt-4o",token_type="output"} 12'
    );
  });

  it('tracks cache metrics through the cache metrics recorder', async () => {
    await request(app).post('/cache/refresh').expect(204);

    const metricsResponse = await request(app).get('/metrics');

    expect(metricsResponse.text).toContain(
      'llm_proxy_cache_operations_total{operation="refresh",result="success"} 1'
    );
    expect(metricsResponse.text).toContain(
      'llm_proxy_cache_memory_usage_bytes{cache_type="llm-cache"} 2048'
    );
  });

  it('returns disabled metrics notice when observability is turned off', async () => {
    const disabledService = new MetricsService({
      logger,
      enabled: false,
      collectDefaultMetrics: false,
    });

    const disabledApp = initializeApp(disabledService);

    const metricsResponse = await request(disabledApp).get('/metrics');

    expect(metricsResponse.status).toBe(200);
    expect(metricsResponse.text).toContain('# Metrics collection is disabled');

    const statsResponse = await request(disabledApp).get('/metrics/stats');
    expect(statsResponse.body).toEqual({ enabled: false });

    disabledService.clear();
  });
});
