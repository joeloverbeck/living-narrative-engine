/**
 * @file metrics-middleware-openrouter-tokens.integration.test.js
 * @description Exercises the metrics middleware against OpenRouter-style model identifiers
 *              and diverse token usage payloads to drive previously uncovered branches in
 *              parseLlmId and extractTokens without mocking internal dependencies.
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

describe('Metrics middleware OpenRouter and token usage integration', () => {
  let app;
  let metricsService;

  beforeEach(() => {
    metricsService = new RecordingMetricsService();
    const logger = createTestLogger();

    app = express();
    app.use(express.json());

    // Attach middleware under test before the route handler so it can observe
    // the response payloads we send back below without any mocking.
    app.post(
      '/llm/observability',
      (req, _res, next) => {
        // Provide a correlation id similar to the live server configuration to
        // exercise the logging flow.
        req.correlationId = 'openrouter-metrics-integration';
        next();
      },
      createLlmMetricsMiddleware({ metricsService, logger }),
      (req, res) => {
        const { variant } = req.body;

        if (variant === 'token_usage') {
          return res.status(208).json({
            status: 'partial',
            token_usage: {
              input: 512,
              output: 256,
            },
          });
        }

        if (variant === 'nested_usage') {
          return res.status(206).json({
            status: 'multi',
            data: {
              usage: {
                prompt_tokens: 42,
                completion_tokens: 21,
              },
            },
          });
        }

        return res.status(200).json({ status: 'ok' });
      }
    );
  });

  it('derives OpenRouter provider/model pairs and extracts diverse token usage payloads', async () => {
    const agent = request(app);

    await agent
      .post('/llm/observability')
      .send({
        llmId: 'openrouter/anthropic/claude-3-haiku',
        variant: 'token_usage',
        targetPayload: { prompt: 'hello' },
      })
      .expect(208);

    await agent
      .post('/llm/observability')
      .send({
        llmId: 'openrouter/anthropic/claude-3-haiku',
        variant: 'nested_usage',
        targetPayload: { prompt: 'follow-up' },
      })
      .expect(206);

    expect(metricsService.llmRequests).toHaveLength(2);

    const [firstEntry, secondEntry] = metricsService.llmRequests;

    expect(firstEntry).toMatchObject({
      provider: 'openrouter_anthropic',
      model: 'claude-3-haiku',
      status: 'success',
      tokens: { input: 512, output: 256 },
    });

    expect(secondEntry).toMatchObject({
      provider: 'openrouter_anthropic',
      model: 'claude-3-haiku',
      status: 'success',
      tokens: { input: 42, output: 21 },
    });
  });
});
