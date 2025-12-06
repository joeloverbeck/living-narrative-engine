/**
 * @file metrics-middleware-openrouter-nested-provider-observability.integration.test.js
 * @description Validates that the metrics middleware normalizes nested OpenRouter
 *              provider identifiers when wired with the real MetricsService,
 *              ensuring the branch that parses multi-segment provider strings is
 *              covered through end-to-end interactions.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { register } from 'prom-client';

import { createLlmMetricsMiddleware } from '../../src/middleware/metrics.js';
import MetricsService from '../../src/services/metricsService.js';

const createStubLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('metrics middleware OpenRouter nested provider observability integration', () => {
  let app;
  let logger;

  beforeEach(() => {
    logger = createStubLogger();

    const metricsService = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });

    app = express();
    app.use(express.json());

    app.post(
      '/llm/openrouter-observability',
      (req, _res, next) => {
        req.correlationId = 'openrouter-observability';
        next();
      },
      createLlmMetricsMiddleware({ metricsService, logger }),
      (_req, res) => {
        res.status(207).json({
          usage: {
            prompt_tokens: 19,
            completion_tokens: 3,
          },
          response: {
            provider: 'OpenRouter',
            nestedProvider: 'Anthropic',
            model: 'Claude-3-Haiku',
          },
        });
      }
    );
  });

  afterEach(() => {
    register.clear();
    jest.resetModules();
  });

  it('records metrics using the normalized nested provider labels for OpenRouter identifiers', async () => {
    const response = await request(app)
      .post('/llm/openrouter-observability')
      .send({
        llmId: 'OpenRouter/Anthropic/Claude-3-Haiku',
        payload: { prompt: 'Explain nested provider handling.' },
      });

    expect(response.status).toBe(207);

    const llmRequestMetrics = await register.getSingleMetricAsString(
      'llm_proxy_llm_requests_total'
    );
    expect(llmRequestMetrics).toContain('llm_provider="openrouter_anthropic"');
    expect(llmRequestMetrics).toContain('model="claude-3-haiku"');
    expect(llmRequestMetrics).toContain('status="success"} 1');

    const tokenMetrics = await register.getSingleMetricAsString(
      'llm_proxy_llm_tokens_processed_total'
    );
    expect(tokenMetrics).toContain(
      'llm_proxy_llm_tokens_processed_total{llm_provider="openrouter_anthropic",model="claude-3-haiku",token_type="input"} 19'
    );
    expect(tokenMetrics).toContain(
      'llm_proxy_llm_tokens_processed_total{llm_provider="openrouter_anthropic",model="claude-3-haiku",token_type="output"} 3'
    );

    expect(logger.debug).toHaveBeenCalledWith(
      'LLM request metrics recorded',
      expect.objectContaining({
        provider: 'openrouter_anthropic',
        model: 'claude-3-haiku',
        status: 'success',
        correlationId: 'openrouter-observability',
      })
    );

    expect(logger.error).not.toHaveBeenCalled();
  });
});
