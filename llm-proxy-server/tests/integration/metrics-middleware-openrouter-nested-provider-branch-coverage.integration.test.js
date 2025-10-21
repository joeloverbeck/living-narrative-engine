/**
 * @file metrics-middleware-openrouter-nested-provider-branch-coverage.integration.test.js
 * @description Validates that the metrics middleware correctly parses OpenRouter identifiers
 *              with nested providers and captures token usage structures without mocking any
 *              internal modules. This specifically exercises the parseLlmId branch that handles
 *              three-segment OpenRouter IDs to improve integration coverage.
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

class RecordingLogger {
  constructor() {
    this.debugEntries = [];
    this.errorEntries = [];
  }

  debug(message, context) {
    this.debugEntries.push({ message, context });
  }

  error(message, context) {
    this.errorEntries.push({ message, context });
  }
}

describe('Metrics middleware OpenRouter nested provider branch coverage', () => {
  let app;
  let metricsService;
  let logger;

  beforeEach(() => {
    metricsService = new RecordingMetricsService();
    logger = new RecordingLogger();

    app = express();
    app.use(express.json());

    app.post(
      '/llm/openrouter-branch-coverage',
      (req, _res, next) => {
        req.correlationId = 'openrouter-branch-coverage';
        next();
      },
      createLlmMetricsMiddleware({ metricsService, logger }),
      (req, res) => {
        const { variant } = req.body;

        if (variant === 'nested_usage') {
          return res.status(207).json({
            status: 'partial',
            token_usage: {
              input: 128,
              output: 64,
            },
          });
        }

        return res.status(201).json({
          status: 'created',
          usage: {
            prompt_tokens: 8,
            completion_tokens: 5,
          },
        });
      }
    );
  });

  it('records metrics for OpenRouter identifiers with nested providers and complex usage payloads', async () => {
    const agent = request(app);

    await agent
      .post('/llm/openrouter-branch-coverage')
      .send({
        llmId: 'openrouter/Anthropic/claude-3-opus',
        variant: 'direct_usage',
        payload: { prompt: 'hello world' },
      })
      .expect(201);

    await agent
      .post('/llm/openrouter-branch-coverage')
      .send({
        llmId: 'openrouter/Cohere/command-r-plus',
        variant: 'nested_usage',
        payload: { prompt: 'follow up' },
      })
      .expect(207);

    expect(metricsService.llmRequests).toHaveLength(2);

    const [firstEntry, secondEntry] = metricsService.llmRequests;

    expect(firstEntry).toMatchObject({
      provider: 'openrouter_anthropic',
      model: 'claude-3-opus',
      status: 'success',
      tokens: { input: 8, output: 5 },
    });

    expect(secondEntry).toMatchObject({
      provider: 'openrouter_cohere',
      model: 'command-r-plus',
      status: 'success',
      tokens: { input: 128, output: 64 },
    });

    expect(logger.debugEntries).toHaveLength(2);
    const providerModels = logger.debugEntries.map(({ context }) => ({
      provider: context.provider,
      model: context.model,
    }));

    expect(providerModels).toEqual([
      { provider: 'openrouter_anthropic', model: 'claude-3-opus' },
      { provider: 'openrouter_cohere', model: 'command-r-plus' },
    ]);

    expect(logger.errorEntries).toHaveLength(0);
  });
});
