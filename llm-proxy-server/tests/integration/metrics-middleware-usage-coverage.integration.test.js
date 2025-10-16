/**
 * @file metrics-middleware-usage-coverage.integration.test.js
 * @description Expands integration coverage for the metrics middleware by exercising LLM
 *              usage extraction across all supported shapes and verifying provider parsing
 *              fallbacks in real Express flows.
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
 * Builds a deterministic logger compatible with ILogger.
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
 * Creates an Express application wired with both the generic HTTP metrics middleware and
 * the LLM metrics middleware. Routes are configured through the provided callback to keep
 * the tests focused on scenario setup rather than plumbing.
 * @param {MetricsService} metricsService - Metrics service instance shared for the test.
 * @param {import('../../src/interfaces/coreServices.js').ILogger} logger - Logger used for observability.
 * @param {(app: import('express').Express) => void} configureRoutes - Route configuration callback.
 * @returns {import('express').Express}
 */
const buildAppWithMetrics = (metricsService, logger, configureRoutes) => {
  const app = express();
  app.use(express.json());

  // Maintain deterministic correlation ids for easier assertions and to ensure the middleware
  // exercises the logging branches that read from req.correlationId.
  app.use((req, _res, next) => {
    req.correlationId = `llm-metrics-${req.method}-${req.path}`;
    next();
  });

  app.use(
    createMetricsMiddleware({
      metricsService,
      logger,
      enabled: true,
    })
  );

  configureRoutes(app);

  return app;
};

describe('Metrics middleware usage extraction integration coverage', () => {
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
    metricsService.clear();
    jest.restoreAllMocks();
  });

  it('records LLM metrics across all supported usage payload formats and provider patterns', async () => {
    const app = buildAppWithMetrics(metricsService, logger, (expressApp) => {
      expressApp.post(
        '/llm/openai-success',
        createLlmMetricsMiddleware({ metricsService, logger }),
        (req, res) => {
          res.status(200).json({
            usage: { prompt_tokens: 11, completion_tokens: 5 },
          });
        }
      );

      expressApp.post(
        '/llm/usage-fallback',
        createLlmMetricsMiddleware({ metricsService, logger }),
        (req, res) => {
          res.status(201).json({
            usage: { input_tokens: 7, output_tokens: 3 },
          });
        }
      );

      expressApp.post(
        '/llm/token-usage',
        createLlmMetricsMiddleware({ metricsService, logger }),
        (req, res) => {
          res.status(503).json({
            token_usage: { input: 13, output: 2 },
          });
        }
      );

      expressApp.post(
        '/llm/nested-usage',
        createLlmMetricsMiddleware({ metricsService, logger }),
        (req, res) => {
          res.status(202).json({
            data: {
              usage: { prompt_tokens: 17, completion_tokens: 4 },
            },
          });
        }
      );
    });

    await request(app)
      .post('/llm/openai-success')
      .send({ llmId: 'openai-gpt-4-turbo' })
      .expect(200);

    await request(app)
      .post('/llm/usage-fallback')
      .send({ llmId: 'anthropic-claude-3-sonnet' })
      .expect(201);

    await request(app)
      .post('/llm/token-usage')
      .send({ llmId: 'openrouter/anthropic/claude-3-opus' })
      .expect(503);

    await request(app)
      .post('/llm/nested-usage')
      .send({ llmId: 'anthropic-claude-3-haiku' })
      .expect(202);

    // Allow the middleware to flush metrics observers before reading from the registry.
    await new Promise((resolve) => setImmediate(resolve));

    const metricsSnapshot = await metricsService.getMetrics();

    expect(metricsSnapshot).toContain(
      'llm_proxy_llm_requests_total{llm_provider="openai",model="gpt-4-turbo",status="success"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_llm_tokens_processed_total{llm_provider="openai",model="gpt-4-turbo",token_type="input"} 11'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_llm_tokens_processed_total{llm_provider="openai",model="gpt-4-turbo",token_type="output"} 5'
    );

    expect(metricsSnapshot).toContain(
      'llm_proxy_llm_requests_total{llm_provider="anthropic",model="claude-3-sonnet",status="success"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_llm_tokens_processed_total{llm_provider="anthropic",model="claude-3-sonnet",token_type="input"} 7'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_llm_tokens_processed_total{llm_provider="anthropic",model="claude-3-sonnet",token_type="output"} 3'
    );

    expect(metricsSnapshot).toContain(
      'llm_proxy_llm_requests_total{llm_provider="openrouter_anthropic",model="claude-3-opus",status="error"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_llm_tokens_processed_total{llm_provider="openrouter_anthropic",model="claude-3-opus",token_type="input"} 13'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_llm_tokens_processed_total{llm_provider="openrouter_anthropic",model="claude-3-opus",token_type="output"} 2'
    );

    expect(metricsSnapshot).toContain(
      'llm_proxy_llm_requests_total{llm_provider="anthropic",model="claude-3-haiku",status="success"} 1'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_llm_tokens_processed_total{llm_provider="anthropic",model="claude-3-haiku",token_type="input"} 17'
    );
    expect(metricsSnapshot).toContain(
      'llm_proxy_llm_tokens_processed_total{llm_provider="anthropic",model="claude-3-haiku",token_type="output"} 4'
    );
  });

  it('falls back to unknown provider parsing and gracefully handles token extraction errors', async () => {
    const app = buildAppWithMetrics(metricsService, logger, (expressApp) => {
      expressApp.post(
        '/llm/resilient-extraction',
        createLlmMetricsMiddleware({ metricsService, logger }),
        (_req, res) => {
          const responseData = {};
          let firstAccess = true;
          Object.defineProperty(responseData, 'usage', {
            enumerable: true,
            get() {
              if (firstAccess) {
                firstAccess = false;
                throw new Error('usage unavailable');
              }
              return { prompt_tokens: 0, completion_tokens: 0 };
            },
          });

          res.status(429).json(responseData);
        }
      );
    });

    await request(app)
      .post('/llm/resilient-extraction')
      .send({ llmId: 42 })
      .expect(429);

    await new Promise((resolve) => setImmediate(resolve));

    const metricsSnapshot = await metricsService.getMetrics();

    expect(metricsSnapshot).toContain(
      'llm_proxy_llm_requests_total{llm_provider="unknown",model="unknown",status="error"} 1'
    );
    expect(metricsSnapshot).not.toContain(
      'llm_proxy_llm_tokens_processed_total{llm_provider="unknown",model="unknown",token_type="input"}'
    );

    expect(metricsSnapshot).toContain(
      'llm_proxy_errors_total{error_type="rate_limit_exceeded",component="http_server",severity="medium"} 1'
    );

    expect(logger.error).not.toHaveBeenCalledWith(
      'Error recording LLM request metrics',
      expect.any(Error)
    );
  });
});
