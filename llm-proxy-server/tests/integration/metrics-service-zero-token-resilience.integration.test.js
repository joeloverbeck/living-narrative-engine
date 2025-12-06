/**
 * @file metrics-service-zero-token-resilience.integration.test.js
 * @description Exercises MetricsService and metrics middleware branches where
 *              downstream components emit zero-token usage data or provide
 *              non-numeric rate limiting map sizes to ensure gauges are not
 *              updated while real modules collaborate without mocks.
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

import MetricsService from '../../src/services/metricsService.js';
import {
  createLlmMetricsMiddleware,
  createMetricsMiddleware,
} from '../../src/middleware/metrics.js';

/**
 * Builds an ILogger-compatible test logger with jest spies.
 * @returns {import('../../src/interfaces/coreServices.js').ILogger}
 */
function createTestLogger() {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  logger.isDebugEnabled = true;
  return logger;
}

/**
 * Helper to extract metric entries by name from prom-client JSON output.
 * @param {Array<import('prom-client').Metric>} metricsJson
 * @param {string} name
 * @returns {Array<import('prom-client').MetricValue>}
 */
function getMetricValues(metricsJson, name) {
  const metric = metricsJson.find((entry) => entry.name === name);
  return metric?.values ?? [];
}

describe('MetricsService zero-token resilience integration coverage', () => {
  let logger;
  let metricsService;
  let app;

  beforeEach(() => {
    logger = createTestLogger();
    metricsService = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });

    const expressApp = express();
    expressApp.use(express.json());

    expressApp.use((req, _res, next) => {
      req.correlationId = `zero-branch-${req.method}-${req.path}`;
      next();
    });

    expressApp.use(
      createMetricsMiddleware({
        metricsService,
        logger,
        enabled: true,
      })
    );

    expressApp.post(
      '/api/llm-request/versioned/v3/clients/1234567890abcdef',
      createLlmMetricsMiddleware({ metricsService, logger }),
      (req, res) => {
        metricsService.recordRateLimiting({
          limitType: 'general',
          clientType: 'ip',
          patternType: req.body.patternType || 'burst-spike',
          severity: req.body.severity || 'medium',
          // Provide a string to exercise the non-number branch for map sizes.
          mapSize: req.body.mapSize,
        });

        res.status(207).json({
          usage: {
            prompt_tokens: 0,
            completion_tokens: 0,
          },
          echo: req.body,
        });
      }
    );

    app = expressApp;
  });

  afterEach(() => {
    metricsService.clear();
    jest.restoreAllMocks();
  });

  it('avoids incrementing token counters and map size gauges for zero or non-numeric inputs', async () => {
    const payload = {
      patternType: 'burst-spike',
      severity: 'medium',
      mapSize: 'not-a-number',
    };

    const response = await request(app)
      .post('/api/llm-request/versioned/v3/clients/1234567890abcdef?debug=true')
      .set('content-type', 'application/json')
      .send(payload);

    expect(response.status).toBe(207);
    expect(response.body.usage).toEqual({
      prompt_tokens: 0,
      completion_tokens: 0,
    });

    await new Promise((resolve) => setImmediate(resolve));

    const metricsJson = await metricsService.getRegistry().getMetricsAsJSON();

    const tokenMetrics = getMetricValues(
      metricsJson,
      'llm_proxy_llm_tokens_processed_total'
    );
    expect(tokenMetrics).toHaveLength(0);

    const mapSizeMetrics = getMetricValues(
      metricsJson,
      'llm_proxy_rate_limit_map_size_entries'
    );
    expect(mapSizeMetrics.every((entry) => Number(entry.value) === 0)).toBe(
      true
    );

    const requestTotals = getMetricValues(
      metricsJson,
      'llm_proxy_http_requests_total'
    );
    expect(
      requestTotals.some((entry) => entry.labels.route === '/api/llm-request')
    ).toBe(true);

    const rateLimitHits = getMetricValues(
      metricsJson,
      'llm_proxy_rate_limit_hits_total'
    );
    expect(rateLimitHits[0]?.value).toBe(1);

    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      'HTTP request metrics recorded',
      expect.objectContaining({
        route: '/api/llm-request',
        statusCode: 207,
      })
    );
  });
});
