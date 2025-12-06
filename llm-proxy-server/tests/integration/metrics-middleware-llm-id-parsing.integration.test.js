/**
 * @file metrics-middleware-llm-id-parsing.integration.test.js
 * @description Validates that the LLM metrics middleware correctly normalizes
 *              diverse llmId formats—including nested OpenRouter identifiers,
 *              simple provider conventions, and malformed inputs—while
 *              interacting with a real Express response flow.
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

describe('Metrics middleware LLM identifier parsing integration', () => {
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
      '/llm/metrics-parsing',
      (req, _res, next) => {
        req.correlationId = req.body?.correlationId || 'llm-metrics-parsing';
        next();
      },
      createLlmMetricsMiddleware({ metricsService, logger }),
      (req, res) => {
        const statusCode =
          typeof req.body?.statusCode === 'number' ? req.body.statusCode : 200;

        const fallbackPayload = {
          usage: req.body?.responseUsage ?? req.body?.usage,
          token_usage: req.body?.token_usage,
          data: req.body?.responseData,
        };

        const payload = req.body?.responsePayload ?? fallbackPayload;

        res.status(statusCode).json(payload ?? {});
      }
    );
  });

  it('normalizes provider/model pairs for diverse llmId formats end-to-end', async () => {
    const scenarios = [
      {
        llmId: 987,
        correlationId: 'numeric-identifier',
        statusCode: 200,
        responsePayload: {
          usage: { prompt_tokens: 7, completion_tokens: 3 },
        },
        expected: {
          provider: 'unknown',
          model: 'unknown',
          tokens: { input: 7, output: 3 },
          status: 'success',
        },
      },
      {
        llmId: 'OpenAI-GPT-4o-Mini',
        correlationId: 'openai-simple',
        statusCode: 202,
        responsePayload: {
          token_usage: { input: 64, output: 32 },
        },
        expected: {
          provider: 'openai',
          model: 'gpt-4o-mini',
          tokens: { input: 64, output: 32 },
          status: 'success',
        },
      },
      {
        llmId: 'openrouter/Anthropic/Claude-3-Haiku',
        correlationId: 'openrouter-nested',
        statusCode: 207,
        responsePayload: {
          data: {
            usage: { prompt_tokens: 24, completion_tokens: 12 },
          },
        },
        expected: {
          provider: 'openrouter_anthropic',
          model: 'claude-3-haiku',
          tokens: { input: 24, output: 12 },
          status: 'success',
        },
      },
      {
        llmId: 'enterprise.model.v1',
        correlationId: 'fallback-provider',
        statusCode: 429,
        responsePayload: {},
        expected: {
          provider: 'unknown',
          model: 'enterprise.model.v1',
          tokens: null,
          status: 'error',
        },
      },
    ];

    for (const scenario of scenarios) {
      const response = await request(app).post('/llm/metrics-parsing').send({
        llmId: scenario.llmId,
        correlationId: scenario.correlationId,
        statusCode: scenario.statusCode,
        responsePayload: scenario.responsePayload,
      });

      expect(response.status).toBe(scenario.statusCode);
    }

    expect(metricsService.llmRequests).toHaveLength(scenarios.length);

    scenarios.forEach((scenario, index) => {
      const recorded = metricsService.llmRequests[index];

      expect(recorded.provider).toBe(scenario.expected.provider);
      expect(recorded.model).toBe(scenario.expected.model);
      expect(recorded.status).toBe(scenario.expected.status);

      if (scenario.expected.tokens === null) {
        expect(recorded.tokens).toBeNull();
      } else {
        expect(recorded.tokens).toEqual(scenario.expected.tokens);
      }

      expect(typeof recorded.duration).toBe('number');
      expect(recorded.duration).toBeGreaterThanOrEqual(0);
    });

    expect(logger.debug).toHaveBeenCalledTimes(scenarios.length);
    scenarios.forEach((scenario, index) => {
      expect(logger.debug).toHaveBeenNthCalledWith(
        index + 1,
        'LLM request metrics recorded',
        expect.objectContaining({
          provider: scenario.expected.provider,
          model: scenario.expected.model,
          correlationId: scenario.correlationId,
          status: scenario.expected.status,
        })
      );
    });

    expect(logger.error).not.toHaveBeenCalled();
  });
});
