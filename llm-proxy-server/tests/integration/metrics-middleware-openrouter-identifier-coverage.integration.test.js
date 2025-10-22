/**
 * @file metrics-middleware-openrouter-identifier-coverage.integration.test.js
 * @description Ensures the metrics middleware exercises the OpenRouter-specific
 *              LLM identifier parsing along with the defensive fallback path
 *              for unexpected identifier types while interacting with the real
 *              middleware stack and response handling.
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

describe('Metrics middleware OpenRouter identifier coverage', () => {
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
      '/llm/branch-evaluation',
      (req, _res, next) => {
        req.correlationId =
          req.body.correlationId || 'openrouter-branch-evaluation';
        next();
      },
      createLlmMetricsMiddleware({ metricsService, logger }),
      (req, res) => {
        const usage = req.body.usage || {
          prompt_tokens: 19,
          completion_tokens: 11,
        };

        res.status(207).json({ data: { usage } });
      }
    );
  });

  it('normalises nested OpenRouter identifiers into provider/model pairs', async () => {
    const response = await request(app)
      .post('/llm/branch-evaluation')
      .send({
        llmId: 'OpenRouter/DeepMind/Gemini-1.5-Pro',
        usage: { prompt_tokens: 33, completion_tokens: 5 },
        correlationId: 'openrouter-deepmind-branch',
      });

    expect(response.status).toBe(207);
    expect(metricsService.llmRequests).toHaveLength(1);

    const [recorded] = metricsService.llmRequests;
    expect(recorded).toMatchObject({
      provider: 'openrouter_deepmind',
      model: 'gemini-1.5-pro',
      status: 'success',
      tokens: { input: 33, output: 5 },
    });

    expect(logger.debug).toHaveBeenCalledWith(
      'LLM request metrics recorded',
      expect.objectContaining({
        provider: 'openrouter_deepmind',
        model: 'gemini-1.5-pro',
        tokens: { input: 33, output: 5 },
        correlationId: 'openrouter-deepmind-branch',
        status: 'success',
      })
    );
  });

  it('falls back to unknown provider/model identifiers for non-string llmIds', async () => {
    const response = await request(app)
      .post('/llm/branch-evaluation')
      .send({
        llmId: 42,
        usage: { prompt_tokens: 7, completion_tokens: 2 },
        correlationId: 'openrouter-invalid-branch',
      });

    expect(response.status).toBe(207);
    expect(metricsService.llmRequests).toHaveLength(1);

    const [recorded] = metricsService.llmRequests;
    expect(recorded).toMatchObject({
      provider: 'unknown',
      model: 'unknown',
      status: 'success',
      tokens: { input: 7, output: 2 },
    });

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      'LLM request metrics recorded',
      expect.objectContaining({
        provider: 'unknown',
        model: 'unknown',
        correlationId: 'openrouter-invalid-branch',
        status: 'success',
      })
    );
  });
});
