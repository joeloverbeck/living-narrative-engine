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

import {
  createCacheMetricsRecorder,
  createLlmMetricsMiddleware,
  createMetricsMiddleware,
} from '../../src/middleware/metrics.js';
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

describe('metrics middleware branch completion integration', () => {
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

  it('records metrics for fallback routes, circular bodies, cache stats, and openrouter identifiers', async () => {
    const app = express();
    app.use(express.json());

    app.use((req, _res, next) => {
      req.correlationId = `branch-${req.method}-${req.path}`;

      if (req.path === '/metrics-proxy') {
        // Force the default route resolver to classify the request as /metrics
        // while still allowing metrics collection to proceed.
        req.originalUrl = '/metrics';
      }

      if (req.path === '/circular-body') {
        // Simulate frameworks that populate complex objects on the request body,
        // including ones that cannot be serialized.
        const circular = { source: 'loop' };
        circular.self = circular;
        req.body = circular;

        const originalGet = req.get.bind(req);
        req.get = (header) => {
          if (header?.toLowerCase() === 'content-length') {
            return undefined;
          }
          return originalGet(header);
        };
      }

      next();
    });

    app.use(
      createMetricsMiddleware({
        metricsService,
        logger,
      })
    );
    app.use(
      '/api/llm-request',
      createLlmMetricsMiddleware({
        metricsService,
        logger,
      })
    );

    app.post('/metrics-proxy', (_req, res) => {
      res.set('Content-Length', 'invalid');
      res.status(503).json({
        usage: {
          prompt_tokens: 11,
          completion_tokens: 13,
        },
      });
    });

    app.post('/circular-body', (_req, res) => {
      res.status(418).end('circular');
    });

    app.post('/api/llm-request', (req, res) => {
      expect(req.body.llmId).toBe('openrouter/anthropic/claude-3-haiku');
      res.status(207).json({
        token_usage: {
          input: 42,
          output: 24,
        },
      });
    });

    const cacheRecorder = createCacheMetricsRecorder({
      metricsService,
      cacheType: 'llm-cache',
    });

    cacheRecorder.recordOperation('hydrate', 'failure', {
      region: 'primary',
    });
    cacheRecorder.recordStats(17, 8192);

    await request(app)
      .post('/metrics-proxy')
      .set('content-type', 'application/json')
      .send({ simulated: 'payload' })
      .expect(503);

    await request(app)
      .post('/circular-body')
      .set('content-type', 'application/json')
      .send({ placeholder: true })
      .expect(418);

    await request(app)
      .post('/api/llm-request')
      .set('content-type', 'application/json')
      .send({ llmId: 'openrouter/anthropic/claude-3-haiku' })
      .expect(207);

    await new Promise((resolve) => setImmediate(resolve));

    const metricsSnapshot = await metricsService.getMetrics();

    expect(metricsSnapshot).toContain(
      'llm_proxy_http_requests_total{method="POST",route="/metrics",status_code="503"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_errors_total{error_type="service_unavailable",component="http_server",severity="high"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_http_requests_total{method="POST",route="/circular-body",status_code="418"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_llm_requests_total{llm_provider="openrouter_anthropic",model="claude-3-haiku",status="success"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_llm_tokens_processed_total{llm_provider="openrouter_anthropic",model="claude-3-haiku",token_type="input"} 42'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_cache_operations_total{operation="hydrate",result="failure"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_cache_memory_usage_bytes{cache_type="llm-cache"} 8192'
    );
  });
});
