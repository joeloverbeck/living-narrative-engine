/**
 * @file metrics-middleware-readiness-openrouter.integration.test.js
 * @description Extends integration coverage for the metrics middleware by
 *              exercising the readiness route shortcut and the OpenRouter
 *              provider parsing + token extraction logic with real services.
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

const HTTP_REQUESTS_TOTAL = 'llm_proxy_http_requests_total';
const LLM_REQUESTS_TOTAL = 'llm_proxy_llm_requests_total';
const LLM_TOKENS_TOTAL = 'llm_proxy_llm_tokens_processed_total';

/**
 * Locates a metric payload within the Prometheus registry snapshot.
 * @param {Array<import('prom-client').Metric>} metrics
 * @param {string} name
 * @returns {import('prom-client').Metric | undefined}
 */
function findMetric(metrics, name) {
  return metrics.find((metric) => metric.name === name);
}

describe('metrics middleware readiness + OpenRouter integration coverage', () => {
  /** @type {import('../../src/interfaces/coreServices.js').ILogger} */
  let logger;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records the readiness route using the dedicated shortcut without query parameters', async () => {
    const metricsService = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.correlationId = 'readiness-shortcut';
      next();
    });
    app.use(createMetricsMiddleware({ metricsService, logger }));

    app.get('/health/ready', (_req, res) => {
      res.status(200).json({ status: 'ready' });
    });

    await request(app).get('/health/ready').expect(200);

    const metrics = await metricsService.getRegistry().getMetricsAsJSON();
    const httpMetric = findMetric(metrics, HTTP_REQUESTS_TOTAL);
    expect(httpMetric?.values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          labels: expect.objectContaining({ route: '/health/ready' }),
        }),
      ])
    );

    const readinessEntry = httpMetric?.values.find(
      (entry) => entry.labels.route === '/health/ready'
    );
    expect(readinessEntry?.labels.method).toBe('GET');
    expect(Number(readinessEntry?.labels.status_code)).toBe(200);

    expect(logger.debug).toHaveBeenCalledWith(
      'HTTP request metrics recorded',
      expect.objectContaining({ route: '/health/ready', statusCode: 200 })
    );

    metricsService.reset();
    metricsService.clear();
  });

  it('parses OpenRouter identifiers and extracts prompt token usage for LLM metrics', async () => {
    const metricsService = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.correlationId = `openrouter-${req.method}-${req.path}`;
      next();
    });
    app.use(createMetricsMiddleware({ metricsService, logger }));

    app.post(
      '/llm/openrouter-success',
      createLlmMetricsMiddleware({ metricsService, logger }),
      (_req, res) => {
        res.status(200).json({
          usage: { prompt_tokens: 31, completion_tokens: 7 },
        });
      }
    );

    await request(app)
      .post('/llm/openrouter-success')
      .send({ llmId: 'openrouter/anthropic/claude-3-haiku' })
      .expect(200);

    await new Promise((resolve) => setImmediate(resolve));

    const metrics = await metricsService.getRegistry().getMetricsAsJSON();

    const llmRequestMetric = findMetric(metrics, LLM_REQUESTS_TOTAL);
    expect(llmRequestMetric?.values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          labels: expect.objectContaining({
            llm_provider: 'openrouter_anthropic',
            model: 'claude-3-haiku',
            status: 'success',
          }),
        }),
      ])
    );

    const llmTokensMetric = findMetric(metrics, LLM_TOKENS_TOTAL);
    expect(llmTokensMetric?.values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          labels: expect.objectContaining({
            llm_provider: 'openrouter_anthropic',
            model: 'claude-3-haiku',
            token_type: 'input',
          }),
          value: 31,
        }),
        expect.objectContaining({
          labels: expect.objectContaining({
            llm_provider: 'openrouter_anthropic',
            model: 'claude-3-haiku',
            token_type: 'output',
          }),
          value: 7,
        }),
      ])
    );

    expect(logger.debug).toHaveBeenCalledWith(
      'LLM request metrics recorded',
      expect.objectContaining({
        provider: 'openrouter_anthropic',
        model: 'claude-3-haiku',
        status: 'success',
        tokens: { input: 31, output: 7 },
      })
    );

    metricsService.reset();
    metricsService.clear();
  });

  it('derives OpenRouter providers and falls back to zero tokens when usage counters are absent', async () => {
    const metricsService = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });

    const middleware = createLlmMetricsMiddleware({ metricsService, logger });

    const req = {
      body: { llmId: 'openrouter/anthropic/claude-3-sonnet' },
      correlationId: 'openrouter-direct-middleware',
    };

    const responsePayload = { usage: {} };

    const res = {
      statusCode: 207,
      json: (data) => data,
    };

    await new Promise((resolve) => {
      middleware(req, res, resolve);
    });

    res.json(responsePayload);

    const metrics = await metricsService.getRegistry().getMetricsAsJSON();
    const llmRequestsMetric = findMetric(metrics, LLM_REQUESTS_TOTAL);
    expect(llmRequestsMetric?.values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          labels: expect.objectContaining({
            llm_provider: 'openrouter_anthropic',
            model: 'claude-3-sonnet',
            status: 'success',
          }),
        }),
      ])
    );

    const llmTokensMetric = findMetric(metrics, LLM_TOKENS_TOTAL);
    if (llmTokensMetric) {
      expect(llmTokensMetric.values).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            labels: expect.objectContaining({
              llm_provider: 'openrouter_anthropic',
            }),
          }),
        ])
      );
    }

    expect(logger.debug).toHaveBeenCalledWith(
      'LLM request metrics recorded',
      expect.objectContaining({
        provider: 'openrouter_anthropic',
        model: 'claude-3-sonnet',
        status: 'success',
        tokens: { input: 0, output: 0 },
      })
    );

    metricsService.reset();
    metricsService.clear();
  });
});
