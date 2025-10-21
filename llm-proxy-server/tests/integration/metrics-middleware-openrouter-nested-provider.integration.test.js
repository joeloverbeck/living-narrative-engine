/**
 * @file metrics-middleware-openrouter-nested-provider.integration.test.js
 * @description Exercises the metrics middleware with an OpenRouter identifier that
 *              includes a nested provider segment to ensure coverage of the
 *              multi-part parsing branch while capturing real token usage.
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createLlmMetricsMiddleware } from '../../src/middleware/metrics.js';

describe('Metrics middleware OpenRouter nested provider coverage', () => {
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
      '/llm/openrouter-nested-provider',
      (req, _res, next) => {
        req.correlationId = 'openrouter-nested-provider';
        next();
      },
      createLlmMetricsMiddleware({ metricsService, logger }),
      (_req, res) => {
        res.status(200).json({
          usage: {
            prompt_tokens: 42,
            completion_tokens: 7,
          },
          result: {
            provider: 'OpenRouter',
            nestedProvider: 'Anthropic',
            model: 'Claude-3-Haiku',
          },
        });
      }
    );
  });

  it('records metrics using the nested OpenRouter provider and model mapping with usage data', async () => {
    const agent = request(app);

    await agent
      .post('/llm/openrouter-nested-provider')
      .send({
        llmId: 'openrouter/Anthropic/claude-3-haiku',
        payload: {
          conversationId: 'nested-provider-coverage',
        },
      })
      .expect(200);

    expect(metricsService.recordLlmRequest).toHaveBeenCalledTimes(1);
    const [payload] = metricsService.recordLlmRequest.mock.calls[0];

    expect(payload).toEqual(
      expect.objectContaining({
        provider: 'openrouter_anthropic',
        model: 'claude-3-haiku',
        status: 'success',
        duration: expect.any(Number),
        tokens: {
          input: 42,
          output: 7,
        },
      })
    );
    expect(payload.duration).toBeGreaterThanOrEqual(0);

    expect(logger.debug).toHaveBeenCalledWith(
      'LLM request metrics recorded',
      expect.objectContaining({
        provider: 'openrouter_anthropic',
        model: 'claude-3-haiku',
        status: 'success',
        correlationId: 'openrouter-nested-provider',
      })
    );

    expect(logger.error).not.toHaveBeenCalled();
  });
});
