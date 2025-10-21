import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createLlmMetricsMiddleware } from '../../src/middleware/metrics.js';
import MetricsService from '../../src/services/metricsService.js';

const createTestLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('metrics middleware LLM identifier parsing integration', () => {
  let metricsService;
  let logger;

  beforeEach(() => {
    jest.useRealTimers();
    logger = createTestLogger();
    metricsService = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });
  });

  afterEach(() => {
    metricsService.clear();
  });

  const buildApp = (handler) => {
    const app = express();
    app.use(express.json());

    app.use((req, _res, next) => {
      req.correlationId = `llm-${req.method}-${req.path}`;
      next();
    });

    app.use(
      '/api/llm-request',
      createLlmMetricsMiddleware({ metricsService, logger })
    );

    app.post('/api/llm-request', handler);

    return app;
  };

  it('records nested provider mapping for OpenRouter identifiers', async () => {
    const app = buildApp((_req, res) => {
      res.status(200).json({
        usage: {
          prompt_tokens: 5,
          completion_tokens: 7,
        },
      });
    });

    await request(app)
      .post('/api/llm-request')
      .set('content-type', 'application/json')
      .send({ llmId: 'openrouter/Anthropic/claude-3-haiku' })
      .expect(200);

    await new Promise((resolve) => setImmediate(resolve));
    const metricsOutput = await metricsService.getMetrics();

    expect(metricsOutput).toContain(
      'llm_proxy_llm_requests_total{llm_provider="openrouter_anthropic",model="claude-3-haiku",status="success"} 1'
    );
    expect(metricsOutput).toContain(
      'llm_proxy_llm_tokens_processed_total{llm_provider="openrouter_anthropic",model="claude-3-haiku",token_type="input"} 5'
    );
    expect(metricsOutput).toContain(
      'llm_proxy_llm_tokens_processed_total{llm_provider="openrouter_anthropic",model="claude-3-haiku",token_type="output"} 7'
    );
  });

  it('falls back to unknown provider for non-standard identifiers while preserving the model name', async () => {
    const app = buildApp((_req, res) => {
      res.status(200).json({
        usage: {
          prompt_tokens: 11,
          completion_tokens: 13,
        },
      });
    });

    await request(app)
      .post('/api/llm-request')
      .set('content-type', 'application/json')
      .send({ llmId: 'CustomProvider-Experimental' })
      .expect(200);

    await new Promise((resolve) => setImmediate(resolve));
    const metricsOutput = await metricsService.getMetrics();

    expect(metricsOutput).toContain(
      'llm_proxy_llm_requests_total{llm_provider="unknown",model="customprovider-experimental",status="success"} 1'
    );
    expect(metricsOutput).toContain(
      'llm_proxy_llm_tokens_processed_total{llm_provider="unknown",model="customprovider-experimental",token_type="input"} 11'
    );
    expect(metricsOutput).toContain(
      'llm_proxy_llm_tokens_processed_total{llm_provider="unknown",model="customprovider-experimental",token_type="output"} 13'
    );
  });
});
