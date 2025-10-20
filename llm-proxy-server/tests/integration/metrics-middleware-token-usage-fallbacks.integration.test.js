/**
 * @file metrics-middleware-token-usage-fallbacks.integration.test.js
 * @description Covers token usage extraction fallbacks in the metrics middleware by
 *              exercising missing usage fields across OpenRouter-style responses with
 *              a fully wired Express app.
 */

import { beforeEach, describe, expect, it } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createLlmMetricsMiddleware } from '../../src/middleware/metrics.js';

class RecordingMetricsService {
  constructor() {
    this.llmRequests = [];
  }

  recordLlmRequest(payload) {
    this.llmRequests.push(payload);
  }
}

const createTestLogger = () => ({
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
});

describe('metrics middleware token usage fallback integration', () => {
  let app;
  let metricsService;

  beforeEach(() => {
    metricsService = new RecordingMetricsService();
    const logger = createTestLogger();

    app = express();
    app.use(express.json());

    app.post(
      '/llm/fallbacks',
      (req, _res, next) => {
        req.correlationId = 'token-fallback-correlation-id';
        next();
      },
      createLlmMetricsMiddleware({ metricsService, logger }),
      (req, res) => {
        const { variant } = req.body;

        if (variant === 'token_usage_missing_fields') {
          return res.status(207).json({
            status: 'partial',
            token_usage: {},
          });
        }

        if (variant === 'nested_usage_missing_fields') {
          return res.status(207).json({
            status: 'multi',
            data: {
              usage: {},
            },
          });
        }

        return res.status(200).json({ status: 'ok' });
      }
    );
  });

  it('defaults absent token usage counters to zero across OpenRouter responses', async () => {
    const agent = request(app);

    await agent
      .post('/llm/fallbacks')
      .send({
        llmId: 'openrouter/anthropic/claude-3-haiku',
        variant: 'token_usage_missing_fields',
      })
      .expect(207);

    await agent
      .post('/llm/fallbacks')
      .send({
        llmId: 'openrouter/anthropic/claude-3-haiku',
        variant: 'nested_usage_missing_fields',
      })
      .expect(207);

    expect(metricsService.llmRequests).toHaveLength(2);

    const [tokenUsageEntry, nestedUsageEntry] = metricsService.llmRequests;

    expect(tokenUsageEntry).toMatchObject({
      provider: 'openrouter_anthropic',
      model: 'claude-3-haiku',
      status: 'success',
      tokens: { input: 0, output: 0 },
    });

    expect(nestedUsageEntry).toMatchObject({
      provider: 'openrouter_anthropic',
      model: 'claude-3-haiku',
      status: 'success',
      tokens: { input: 0, output: 0 },
    });
  });
});
