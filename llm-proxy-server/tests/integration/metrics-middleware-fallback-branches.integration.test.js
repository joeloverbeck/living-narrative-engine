/**
 * @file metrics-middleware-fallback-branches.integration.test.js
 * @description Exercises less common execution paths in the metrics middleware using the real
 *              MetricsService implementation to increase integration coverage of fallback logic.
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

import {
  createMetricsMiddleware,
  createLlmMetricsMiddleware,
} from '../../src/middleware/metrics.js';
import MetricsService from '../../src/services/metricsService.js';

/**
 * Creates a lightweight logger with Jest spies for verification.
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
 * Builds an Express application that wires the real metrics middleware and adds
 * routes that surface rarely executed branches in the metrics helpers.
 * @param {MetricsService} metricsService - Real metrics service instance.
 * @param {import('../../src/interfaces/coreServices.js').ILogger} logger - Logger used by the middleware.
 * @returns {import('express').Express}
 */
const buildApp = (metricsService, logger) => {
  const app = express();
  app.use(express.json());

  // Attach correlation identifiers so that the debug logging remains deterministic.
  app.use((req, _res, next) => {
    req.correlationId = `branch-${req.method}-${req.path}`;
    next();
  });

  // Force payload characteristics that usually require fallbacks inside the helpers.
  app.use((req, _res, next) => {
    if (req.path.startsWith('/raw/')) {
      req.headers['content-length'] = '0';
      const forcedValue = Number.parseInt(
        req.get('x-body-as-number') ?? '',
        10
      );
      req.body = Number.isNaN(forcedValue) ? 1337 : forcedValue;
    }
    next();
  });

  app.use(
    createMetricsMiddleware({
      metricsService,
      logger,
      enabled: true,
    })
  );

  const llmMetricsMiddleware = createLlmMetricsMiddleware({
    metricsService,
    logger,
  });

  app.post('/raw/:status', (req, res) => {
    const statusCode = Number.parseInt(req.params.status, 10);
    res.set('Content-Length', '0');
    res.status(Number.isNaN(statusCode) ? 503 : statusCode);
    // Complete the response without a body so the response size estimator falls back to header handling.
    res.end('');
  });

  app.post('/api/llm-request', llmMetricsMiddleware, (req, res) => {
    const payload = {
      token_usage: {
        input: 5,
        output: 2,
      },
    };
    res.status(202).json(payload);
  });

  return app;
};

describe('Metrics middleware fallback branch integration', () => {
  let logger;
  let metricsService;
  let app;

  beforeEach(() => {
    logger = createTestLogger();
    metricsService = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });
    app = buildApp(metricsService, logger);
  });

  afterEach(() => {
    metricsService.clear();
    jest.restoreAllMocks();
  });

  it('records metrics for atypical payloads and openrouter LLM identifiers', async () => {
    await request(app)
      .post('/raw/503')
      .set('X-Body-As-Number', '4096')
      .expect(503)
      .expect('');

    await request(app)
      .post('/api/llm-request')
      .send({
        llmId: 'openrouter/anthropic/claude-3-5-sonnet',
        prompt: 'ping',
      })
      .expect(202);

    await new Promise((resolve) => setImmediate(resolve));

    const metricsSnapshot = await metricsService.getMetrics();

    expect(metricsSnapshot).toContain(
      'llm_proxy_http_requests_total{method="POST",route="/raw/:id",status_code="503"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_errors_total{error_type="service_unavailable",component="http_server",severity="high"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_llm_requests_total{llm_provider="openrouter_anthropic",model="claude-3-5-sonnet",status="success"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_llm_tokens_processed_total{llm_provider="openrouter_anthropic",model="claude-3-5-sonnet",token_type="input"} 5'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_llm_tokens_processed_total{llm_provider="openrouter_anthropic",model="claude-3-5-sonnet",token_type="output"} 2'
    );

    expect(logger.debug).toHaveBeenCalledWith(
      'HTTP request metrics recorded',
      expect.objectContaining({
        route: '/raw/:id',
        statusCode: 503,
        correlationId: 'branch-POST-/raw/503',
        requestSize: 0,
        responseSize: 0,
      })
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'LLM request metrics recorded',
      expect.objectContaining({
        provider: 'openrouter_anthropic',
        model: 'claude-3-5-sonnet',
        status: 'success',
        correlationId: 'branch-POST-/api/llm-request',
      })
    );
  });
});
