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

describe('Metrics middleware hierarchical OpenRouter provider integration', () => {
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
        req.correlationId = 'openrouter-hierarchical-provider';
        next();
      },
      createLlmMetricsMiddleware({ metricsService, logger }),
      (_req, res) => {
        res.status(503).json({
          token_usage: {
            input: 512,
            output: 16,
          },
        });
      }
    );
  });

  it('normalizes hierarchical OpenRouter identifiers and records token usage', async () => {
    const response = await request(app).post('/llm/observability').send({
      llmId: 'OpenRouter/Anthropic/Claude-3.5-Sonnet',
    });

    expect(response.status).toBe(503);
    expect(metricsService.llmRequests).toHaveLength(1);

    const [recorded] = metricsService.llmRequests;
    expect(recorded).toMatchObject({
      provider: 'openrouter_anthropic',
      model: 'claude-3.5-sonnet',
      status: 'error',
      tokens: { input: 512, output: 16 },
    });
    expect(typeof recorded.duration).toBe('number');
    expect(recorded.duration).toBeGreaterThanOrEqual(0);

    expect(logger.debug).toHaveBeenCalledWith(
      'LLM request metrics recorded',
      expect.objectContaining({
        provider: 'openrouter_anthropic',
        model: 'claude-3.5-sonnet',
        status: 'error',
        tokens: { input: 512, output: 16 },
        correlationId: 'openrouter-hierarchical-provider',
      })
    );
    expect(logger.error).not.toHaveBeenCalled();
  });
});
