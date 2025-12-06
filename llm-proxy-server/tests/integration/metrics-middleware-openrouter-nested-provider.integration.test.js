/**
 * @file metrics-middleware-openrouter-nested-provider.integration.test.js
 * @description Exercises the metrics middleware against OpenRouter identifiers
 *              that contain nested provider segments to ensure the parsing
 *              logic integrates correctly with the metrics service and logger
 *              without relying on mocks.
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

describe('Metrics middleware OpenRouter nested provider integration', () => {
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
      '/llm/observability',
      (req, _res, next) => {
        req.correlationId = 'openrouter-nested-provider';
        next();
      },
      createLlmMetricsMiddleware({ metricsService, logger }),
      (_req, res) => {
        res.status(202).json({
          data: {
            usage: {
              prompt_tokens: 256,
              completion_tokens: 128,
            },
          },
        });
      }
    );
  });

  it('records metrics with the OpenRouter nested provider and propagates structured tokens', async () => {
    const response = await request(app).post('/llm/observability').send({
      llmId: 'OpenRouter/NVIDIA/Nemotron-4-340B-Instruct',
    });

    expect(response.status).toBe(202);
    expect(metricsService.llmRequests).toHaveLength(1);

    const [recorded] = metricsService.llmRequests;
    expect(recorded).toMatchObject({
      provider: 'openrouter_nvidia',
      model: 'nemotron-4-340b-instruct',
      status: 'success',
      tokens: { input: 256, output: 128 },
    });
    expect(typeof recorded.duration).toBe('number');
    expect(recorded.duration).toBeGreaterThanOrEqual(0);

    expect(logger.debug).toHaveBeenCalledWith(
      'LLM request metrics recorded',
      expect.objectContaining({
        provider: 'openrouter_nvidia',
        model: 'nemotron-4-340b-instruct',
        correlationId: 'openrouter-nested-provider',
        tokens: { input: 256, output: 128 },
        status: 'success',
      })
    );
  });
});
