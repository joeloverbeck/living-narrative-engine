/**
 * @file metrics-middleware-openrouter-multi-provider-coverage.integration.test.js
 * @description Ensures the metrics middleware normalizes OpenRouter identifiers
 *              that include nested provider information and records structured
 *              metrics without relying on mocks for downstream services.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createLlmMetricsMiddleware } from '../../src/middleware/metrics.js';

class RecordingMetricsService {
  constructor() {
    /** @type {Array<import('../../src/services/metricsService.js').LlmRequestMetric>} */
    this.llmRequests = [];
  }

  /**
   * @param {import('../../src/services/metricsService.js').LlmRequestMetric} payload
   */
  recordLlmRequest(payload) {
    this.llmRequests.push(payload);
  }
}

describe('Metrics middleware OpenRouter hierarchical provider branch coverage', () => {
  let app;
  let metricsService;
  let logger;

  beforeEach(() => {
    metricsService = new RecordingMetricsService();
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    app = express();
    app.use(express.json());

    app.post(
      '/llm/telemetry',
      (req, _res, next) => {
        req.correlationId = 'openrouter-multi-provider';
        next();
      },
      createLlmMetricsMiddleware({ metricsService, logger }),
      (_req, res) => {
        res.status(201).json({
          usage: {
            prompt_tokens: 64,
            completion_tokens: 8,
          },
        });
      }
    );
  });

  it('records metrics for OpenRouter identifiers with nested provider segments', async () => {
    const response = await request(app).post('/llm/telemetry').send({
      llmId: 'OpenRouter/DeepMind/Gemma-3-8B',
    });

    expect(response.status).toBe(201);
    expect(metricsService.llmRequests).toHaveLength(1);

    const [recorded] = metricsService.llmRequests;
    expect(recorded).toMatchObject({
      provider: 'openrouter_deepmind',
      model: 'gemma-3-8b',
      status: 'success',
      tokens: { input: 64, output: 8 },
    });
    expect(typeof recorded.duration).toBe('number');
    expect(recorded.duration).toBeGreaterThanOrEqual(0);

    expect(logger.debug).toHaveBeenCalledWith(
      'LLM request metrics recorded',
      expect.objectContaining({
        provider: 'openrouter_deepmind',
        model: 'gemma-3-8b',
        status: 'success',
        tokens: { input: 64, output: 8 },
        correlationId: 'openrouter-multi-provider',
      })
    );
    expect(logger.error).not.toHaveBeenCalled();
  });
});
