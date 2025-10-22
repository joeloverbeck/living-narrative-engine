/**
 * @file metrics-middleware-openrouter-openai-branch.integration.test.js
 * @description Ensures the metrics middleware correctly normalizes OpenRouter
 *              identifiers that include nested provider segments, covering the
 *              branch that maps the provider name to `openrouter_<vendor>`.
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

describe('Metrics middleware OpenRouter OpenAI provider branch integration', () => {
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
      '/llm/openrouter-openai',
      (req, _res, next) => {
        req.correlationId = 'openrouter-openai-branch';
        next();
      },
      createLlmMetricsMiddleware({ metricsService, logger }),
      (_req, res) => {
        res.status(207).json({
          usage: {
            prompt_tokens: 42,
            completion_tokens: 21,
          },
        });
      }
    );
  });

  it('records metrics using the nested provider branch for OpenRouter identifiers', async () => {
    const response = await request(app)
      .post('/llm/openrouter-openai')
      .send({ llmId: 'OpenRouter/OpenAI/GPT-4o-mini' });

    expect(response.status).toBe(207);
    expect(metricsService.llmRequests).toHaveLength(1);

    const [recorded] = metricsService.llmRequests;
    expect(recorded).toMatchObject({
      provider: 'openrouter_openai',
      model: 'gpt-4o-mini',
      status: 'success',
      tokens: { input: 42, output: 21 },
    });
    expect(typeof recorded.duration).toBe('number');
    expect(recorded.duration).toBeGreaterThanOrEqual(0);

    expect(logger.debug).toHaveBeenCalledWith(
      'LLM request metrics recorded',
      expect.objectContaining({
        provider: 'openrouter_openai',
        model: 'gpt-4o-mini',
        status: 'success',
        tokens: { input: 42, output: 21 },
        correlationId: 'openrouter-openai-branch',
      })
    );
  });
});
