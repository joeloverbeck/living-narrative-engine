/**
 * @file metrics-service-live-middleware.integration.test.js
 * @description Ensures the metrics middleware and MetricsService collaborate
 *              to capture real HTTP and LLM metrics without mocks.
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
import {
  createMetricsMiddleware,
  createLlmMetricsMiddleware,
  createCacheMetricsRecorder,
} from '../../src/middleware/metrics.js';

const METRIC_LLM_TOKENS = 'llm_proxy_llm_tokens_processed_total';
const METRIC_CACHE_MEMORY = 'llm_proxy_cache_memory_usage_bytes';
const METRIC_CACHE_SIZE = 'llm_proxy_cache_size_entries';
const METRIC_RATE_LIMIT_SIZE = 'llm_proxy_rate_limit_map_size_entries';

/**
 * Helper that extracts a metric entry from prom-client JSON payloads.
 * @param {Array<import('prom-client').Metric>} metrics
 * @param {string} name
 * @returns {import('prom-client').Metric | undefined}
 */
function findMetric(metrics, name) {
  return metrics.find((metric) => metric.name === name);
}

describe('MetricsService live middleware collaboration', () => {
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

  it('captures token, cache, and rate limit statistics from a real request lifecycle', async () => {
    const app = express();
    app.use(express.json());

    // Attach the HTTP metrics middleware with a deterministic route resolver.
    app.use(
      createMetricsMiddleware({
        metricsService,
        logger,
        routeResolver: (req) => req.path,
      })
    );

    app.post(
      '/llm-metrics',
      createLlmMetricsMiddleware({ metricsService, logger }),
      (req, res) => {
        // Simulate cache updates driven by the request lifecycle.
        const cacheRecorder = createCacheMetricsRecorder({
          metricsService,
          cacheType: 'llm_payloads',
        });

        cacheRecorder.recordOperation('set', 'success', {
          size: 1,
          memoryUsage: 2048,
        });
        cacheRecorder.recordStats(4, 8192);

        metricsService.recordRateLimiting({
          limitType: 'adaptive',
          clientType: 'ip',
          patternType: 'bursty-client',
          severity: 'high',
          mapSize: 2,
        });

        res.status(200).json({
          data: {
            usage: {
              prompt_tokens: 33,
              completion_tokens: 12,
            },
          },
        });
      }
    );

    const response = await request(app)
      .post('/llm-metrics')
      .set('Content-Type', 'application/json')
      .send({
        llmId: 'openrouter/anthropic/claude-3-haiku',
        targetPayload: { message: 'integration-check' },
      });

    expect(response.status).toBe(200);

    const metricsJson = await metricsService.getRegistry().getMetricsAsJSON();

    const tokenMetric = findMetric(metricsJson, METRIC_LLM_TOKENS);
    expect(tokenMetric?.values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          labels: expect.objectContaining({
            llm_provider: 'openrouter_anthropic',
            model: 'claude-3-haiku',
            token_type: 'input',
          }),
          value: 33,
        }),
        expect.objectContaining({
          labels: expect.objectContaining({
            llm_provider: 'openrouter_anthropic',
            model: 'claude-3-haiku',
            token_type: 'output',
          }),
          value: 12,
        }),
      ])
    );

    const cacheSizeMetric = findMetric(metricsJson, METRIC_CACHE_SIZE);
    expect(cacheSizeMetric?.values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          labels: expect.objectContaining({ cache_type: 'llm_payloads' }),
          value: 4,
        }),
      ])
    );

    const cacheMemoryMetric = findMetric(metricsJson, METRIC_CACHE_MEMORY);
    expect(cacheMemoryMetric?.values).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          labels: expect.objectContaining({ cache_type: 'llm_payloads' }),
          value: 8192,
        }),
      ])
    );

    const mapSizeMetric = findMetric(metricsJson, METRIC_RATE_LIMIT_SIZE);
    expect(mapSizeMetric?.values?.[0]?.value).toBe(2);

    expect(logger.debug).toHaveBeenCalledWith(
      'HTTP request metrics recorded',
      expect.objectContaining({ route: '/llm-metrics', statusCode: 200 })
    );
    expect(logger.debug).toHaveBeenCalledWith(
      'LLM request metrics recorded',
      expect.objectContaining({
        provider: 'openrouter_anthropic',
        model: 'claude-3-haiku',
      })
    );
  });
});
