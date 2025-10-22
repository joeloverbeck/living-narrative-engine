/**
 * @file metrics-middleware-openrouter-degenerate-identifiers.integration.test.js
 * @description Exercises the metrics middleware branch that falls back to
 *              unknown provider/model identifiers when encountering OpenRouter
 *              IDs that are syntactically malformed. The suite wires together
 *              the real middleware with an Express app and a recording metrics
 *              service to verify token extraction via nested usage payloads.
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

describe('metrics middleware handling for degenerate OpenRouter identifiers', () => {
  let app;
  let metricsService;
  /** @type {{debug: jest.Mock, info: jest.Mock, warn: jest.Mock, error: jest.Mock}} */
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
      '/llm/degenerate-openrouter-id',
      (req, _res, next) => {
        req.correlationId = 'degenerate-openrouter-branch';
        next();
      },
      createLlmMetricsMiddleware({ metricsService, logger }),
      (_req, res) => {
        res.status(206).json({
          status: 'partial',
          data: {
            usage: {
              prompt_tokens: 21,
              completion_tokens: 13,
            },
          },
        });
      }
    );
  });

  it('falls back to unknown provider/model when the OpenRouter identifier omits the model segment', async () => {
    await request(app)
      .post('/llm/degenerate-openrouter-id')
      .send({
        llmId: 'openrouter/Anthropic/',
      })
      .expect(206);

    expect(metricsService.llmRequests).toHaveLength(1);
    const [recorded] = metricsService.llmRequests;

    expect(recorded).toMatchObject({
      provider: 'unknown',
      model: 'openrouter/anthropic/',
      status: 'success',
      tokens: { input: 21, output: 13 },
    });

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      'LLM request metrics recorded',
      expect.objectContaining({
        provider: 'unknown',
        model: 'openrouter/anthropic/',
        tokens: { input: 21, output: 13 },
        correlationId: 'degenerate-openrouter-branch',
        status: 'success',
      })
    );
  });
});
