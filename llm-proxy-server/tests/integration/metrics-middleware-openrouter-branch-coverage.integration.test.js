/**
 * @file metrics-middleware-openrouter-branch-coverage.integration.test.js
 * @description Provides additional coverage for the metrics middleware by
 *              validating that OpenRouter identifiers with nested providers
 *              and non-string identifiers flow through the real middleware
 *              stack. This ensures the parsing logic interacts with the
 *              metrics service and logger without mocks or reimplementation.
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

describe('Metrics middleware branch coverage for OpenRouter identifiers', () => {
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
      '/llm/observe',
      (req, _res, next) => {
        req.correlationId = 'openrouter-branch-cases';
        next();
      },
      createLlmMetricsMiddleware({ metricsService, logger }),
      (_req, res) => {
        res.status(201).json({
          usage: {
            prompt_tokens: 64,
            completion_tokens: 32,
          },
        });
      }
    );
  });

  it('derives nested OpenRouter provider identifiers and records structured metrics', async () => {
    const response = await request(app)
      .post('/llm/observe')
      .send({ llmId: 'OpenRouter/Anthropic/Claude-3-Haiku' });

    expect(response.status).toBe(201);
    expect(metricsService.llmRequests).toHaveLength(1);

    const [recorded] = metricsService.llmRequests;
    expect(recorded).toMatchObject({
      provider: 'openrouter_anthropic',
      model: 'claude-3-haiku',
      status: 'success',
      tokens: { input: 64, output: 32 },
    });

    expect(logger.debug).toHaveBeenCalledWith(
      'LLM request metrics recorded',
      expect.objectContaining({
        provider: 'openrouter_anthropic',
        model: 'claude-3-haiku',
        correlationId: 'openrouter-branch-cases',
        tokens: { input: 64, output: 32 },
      })
    );
  });

  it('falls back to unknown provider/model when the identifier is not a string', async () => {
    const response = await request(app)
      .post('/llm/observe')
      .send({ llmId: 42 });

    expect(response.status).toBe(201);
    expect(metricsService.llmRequests).toHaveLength(1);

    const [recorded] = metricsService.llmRequests;
    expect(recorded).toMatchObject({
      provider: 'unknown',
      model: 'unknown',
      tokens: { input: 64, output: 32 },
    });

    expect(logger.debug).toHaveBeenCalledWith(
      'LLM request metrics recorded',
      expect.objectContaining({
        provider: 'unknown',
        model: 'unknown',
      })
    );
  });
});
