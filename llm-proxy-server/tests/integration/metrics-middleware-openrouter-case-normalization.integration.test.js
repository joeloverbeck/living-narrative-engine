/**
 * @file metrics-middleware-openrouter-case-normalization.integration.test.js
 * @description Ensures the metrics middleware normalizes mixed-case OpenRouter identifiers
 *              while capturing error responses without mocking internal helpers.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createLlmMetricsMiddleware } from '../../src/middleware/metrics.js';

describe('Metrics middleware OpenRouter case normalization integration', () => {
  let app;
  let metricsService;
  let logger;

  beforeEach(() => {
    metricsService = {
      recordLlmRequest: jest.fn(),
    };

    logger = {
      debug: jest.fn(),
      error: jest.fn(),
    };

    app = express();
    app.use(express.json());

    app.post(
      '/llm/openrouter-case',
      (req, _res, next) => {
        req.correlationId = 'openrouter-case-normalization';
        next();
      },
      createLlmMetricsMiddleware({ metricsService, logger }),
      (_req, res) => {
        res.status(502).json({
          error: 'Gateway failure from upstream provider',
        });
      }
    );
  });

  it('records normalized provider/model pairs for mixed-case OpenRouter identifiers on error responses', async () => {
    const agent = request(app);

    await agent
      .post('/llm/openrouter-case')
      .send({
        llmId: 'OpenRouter/Anthropic/Claude-3-Opus',
        payload: { conversationId: 'case-001' },
      })
      .expect(502);

    expect(metricsService.recordLlmRequest).toHaveBeenCalledTimes(1);
    const [payload] = metricsService.recordLlmRequest.mock.calls[0];

    expect(payload).toEqual(
      expect.objectContaining({
        provider: 'openrouter_anthropic',
        model: 'claude-3-opus',
        status: 'error',
        tokens: null,
      })
    );

    expect(typeof payload.duration).toBe('number');
    expect(payload.duration).toBeGreaterThanOrEqual(0);

    expect(logger.debug).toHaveBeenCalledWith(
      'LLM request metrics recorded',
      expect.objectContaining({
        provider: 'openrouter_anthropic',
        model: 'claude-3-opus',
        status: 'error',
        correlationId: 'openrouter-case-normalization',
      })
    );

    expect(logger.error).not.toHaveBeenCalled();
  });
});
