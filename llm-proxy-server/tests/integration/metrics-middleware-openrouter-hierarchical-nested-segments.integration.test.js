/**
 * @file metrics-middleware-openrouter-hierarchical-nested-segments.integration.test.js
 * @description Ensures the LLM metrics middleware normalizes OpenRouter identifiers
 *              that include hierarchical provider segments and records token usage
 *              through the real MetricsService implementation.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
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

describe('metrics middleware OpenRouter hierarchical nested segments integration', () => {
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
      '/llm/openrouter-hierarchical-nested',
      (req, _res, next) => {
        req.correlationId = 'openrouter-hierarchical-nested';
        next();
      },
      createLlmMetricsMiddleware({ metricsService, logger }),
      (_req, res) => {
        res.status(202).json({
          data: {
            usage: {
              prompt_tokens: 11,
              completion_tokens: 7,
            },
          },
          message: 'Hierarchical OpenRouter provider recorded successfully.',
        });
      }
    );
  });

  afterEach(() => {
    register.clear();
    jest.resetModules();
  });

  it('records metrics with normalized provider and model for multi-segment OpenRouter identifiers', async () => {
    const response = await request(app)
      .post('/llm/openrouter-hierarchical-nested')
      .send({
        llmId: 'OpenRouter/Google/Vertex/Gemini-Pro',
        payload: { prompt: 'Demonstrate hierarchical provider normalization.' },
      });

    expect(response.status).toBe(202);

    const requestMetrics = await register.getSingleMetricAsString(
      'llm_proxy_llm_requests_total'
    );
    expect(requestMetrics).toContain('llm_provider="openrouter_google"');
    expect(requestMetrics).toContain('model="vertex/gemini-pro"');
    expect(requestMetrics).toContain('status="success"} 1');

    const tokenMetrics = await register.getSingleMetricAsString(
      'llm_proxy_llm_tokens_processed_total'
    );
    expect(tokenMetrics).toContain(
      'llm_proxy_llm_tokens_processed_total{llm_provider="openrouter_google",model="vertex/gemini-pro",token_type="input"} 11'
    );
    expect(tokenMetrics).toContain(
      'llm_proxy_llm_tokens_processed_total{llm_provider="openrouter_google",model="vertex/gemini-pro",token_type="output"} 7'
    );

    expect(logger.debug).toHaveBeenCalledWith(
      'LLM request metrics recorded',
      expect.objectContaining({
        provider: 'openrouter_google',
        model: 'vertex/gemini-pro',
        status: 'success',
        tokens: { input: 11, output: 7 },
        correlationId: 'openrouter-hierarchical-nested',
      })
    );
    expect(logger.error).not.toHaveBeenCalled();
  });
});
