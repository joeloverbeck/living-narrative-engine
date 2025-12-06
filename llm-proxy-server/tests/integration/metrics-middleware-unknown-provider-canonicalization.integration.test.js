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
import { register } from 'prom-client';

import { createLlmMetricsMiddleware } from '../../src/middleware/metrics.js';
import MetricsService from '../../src/services/metricsService.js';

/**
 * @file metrics-middleware-unknown-provider-canonicalization.integration.test.js
 * @description Exercises the metrics middleware fallback logic for non-standard LLM identifiers
 *              while using the real MetricsService implementation to verify that provider/model
 *              canonicalization and token extraction behave as expected without relying on mocks.
 */

describe('metrics middleware fallback canonicalization for atypical LLM identifiers', () => {
  /** @type {express.Express} */
  let app;
  /** @type {MetricsService} */
  let metricsService;
  /** @type {{debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock}} */
  let logger;

  beforeEach(() => {
    register.clear();

    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    metricsService = new MetricsService({
      logger,
      enabled: true,
      collectDefaultMetrics: false,
    });

    app = express();
    app.use(express.json());

    app.post(
      '/llm/fallback-canonicalization',
      (req, _res, next) => {
        req.correlationId = 'llm-fallback-canonicalization';
        next();
      },
      createLlmMetricsMiddleware({ metricsService, logger }),
      (_req, res) => {
        res.status(207).json({
          result: 'accepted',
          usage: {
            prompt_tokens: 19,
            completion_tokens: 7,
          },
        });
      }
    );
  });

  afterEach(() => {
    register.clear();
    jest.resetAllMocks();
  });

  it('records unknown provider/model metrics with canonicalised identifiers and extracted tokens', async () => {
    await request(app)
      .post('/llm/fallback-canonicalization')
      .send({ llmId: 'VendorX::Model-Prime' })
      .expect(207);

    const requestCounters = await metricsService.llmRequestsTotal.get();
    expect(Array.isArray(requestCounters.values)).toBe(true);

    const fallbackRequest = requestCounters.values.find(
      (entry) =>
        entry.labels.llm_provider === 'unknown' &&
        entry.labels.model === 'vendorx::model-prime' &&
        entry.labels.status === 'success'
    );

    expect(fallbackRequest).toBeDefined();
    expect(fallbackRequest?.value).toBeGreaterThanOrEqual(1);

    const tokenCounters = await metricsService.llmTokensProcessed.get();
    const inputTokens = tokenCounters.values.find(
      (entry) =>
        entry.labels.llm_provider === 'unknown' &&
        entry.labels.model === 'vendorx::model-prime' &&
        entry.labels.token_type === 'input'
    );
    const outputTokens = tokenCounters.values.find(
      (entry) =>
        entry.labels.llm_provider === 'unknown' &&
        entry.labels.model === 'vendorx::model-prime' &&
        entry.labels.token_type === 'output'
    );

    expect(inputTokens?.value).toBe(19);
    expect(outputTokens?.value).toBe(7);

    expect(logger.debug).toHaveBeenCalledWith(
      'LLM request metrics recorded',
      expect.objectContaining({
        provider: 'unknown',
        model: 'vendorx::model-prime',
        status: 'success',
        tokens: { input: 19, output: 7 },
        correlationId: 'llm-fallback-canonicalization',
      })
    );
    expect(logger.error).not.toHaveBeenCalled();
  });
});
