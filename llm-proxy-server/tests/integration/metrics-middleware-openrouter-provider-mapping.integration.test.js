/**
 * @file metrics-middleware-openrouter-provider-mapping.integration.test.js
 * @description Validates that the metrics middleware correctly classifies
 *              OpenRouter-style LLM identifiers and records metrics for both
 *              successful and failed responses without mocking dependencies.
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

  recordLlmRequest(payload) {
    this.llmRequests.push(payload);
  }
}

const buildLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('Metrics middleware OpenRouter provider classification integration', () => {
  let app;
  let metricsService;
  let logger;

  beforeEach(() => {
    metricsService = new RecordingMetricsService();
    logger = buildLogger();

    app = express();
    app.use(express.json());

    app.post(
      '/llm/observability',
      (req, _res, next) => {
        req.correlationId = 'openrouter-provider-coverage';
        next();
      },
      createLlmMetricsMiddleware({ metricsService, logger }),
      (req, res) => {
        if (req.body?.scenario === 'error') {
          return res.status(503).json({
            status: 'unavailable',
          });
        }

        return res.status(201).json({
          status: 'created',
          token_usage: {
            input: 128,
            output: 64,
          },
        });
      }
    );
  });

  it('maps OpenRouter identifiers to provider/model pairs for mixed outcomes', async () => {
    const agent = request(app);

    await agent
      .post('/llm/observability')
      .send({
        llmId: 'openrouter/Anthropic/Claude-3-Haiku',
        scenario: 'error',
      })
      .expect(503);

    await agent
      .post('/llm/observability')
      .send({
        llmId: 'OPENROUTER/anthropic/claude-3-haiku',
        scenario: 'success',
      })
      .expect(201);

    expect(metricsService.llmRequests).toHaveLength(2);

    const [errorEntry, successEntry] = metricsService.llmRequests;

    expect(errorEntry).toMatchObject({
      provider: 'openrouter_anthropic',
      model: 'claude-3-haiku',
      status: 'error',
      tokens: null,
    });

    expect(successEntry).toMatchObject({
      provider: 'openrouter_anthropic',
      model: 'claude-3-haiku',
      status: 'success',
      tokens: { input: 128, output: 64 },
    });

    expect(logger.debug).toHaveBeenCalledWith(
      'LLM request metrics recorded',
      expect.objectContaining({
        provider: 'openrouter_anthropic',
        model: 'claude-3-haiku',
        correlationId: 'openrouter-provider-coverage',
      })
    );
  });
});
