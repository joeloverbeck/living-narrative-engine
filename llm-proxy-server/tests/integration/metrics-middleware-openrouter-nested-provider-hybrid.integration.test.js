/**
 * @file metrics-middleware-openrouter-nested-provider-hybrid.integration.test.js
 * @description Validates the LLM metrics middleware when receiving OpenRouter identifiers
 *              that include nested provider information and suffix qualifiers, ensuring the
 *              parsing logic collaborates with the real middleware stack without mocks.
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

describe('Metrics middleware OpenRouter nested provider hybrid coverage', () => {
  let app;
  let metricsService;
  let logger;
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
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
      '/llm/openrouter-hybrid',
      (req, _res, next) => {
        req.correlationId = 'openrouter-hybrid-coverage';
        next();
      },
      createLlmMetricsMiddleware({ metricsService, logger }),
      (_req, res) => {
        res.status(201).json({
          usage: {
            prompt_tokens: 512,
            completion_tokens: 128,
          },
          metadata: {
            route: 'openrouter-hybrid',
          },
        });
      }
    );
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.restoreAllMocks();
  });

  it('records provider/model pairs for OpenRouter identifiers with nested providers and qualifiers', async () => {
    const response = await request(app)
      .post('/llm/openrouter-hybrid')
      .send({ llmId: 'openrouter/DeepMind/Gemini-1.5-Pro:latest' });

    expect(response.status).toBe(201);
    expect(metricsService.llmRequests).toHaveLength(1);

    const [recorded] = metricsService.llmRequests;
    expect(recorded).toMatchObject({
      provider: 'openrouter_deepmind',
      model: 'gemini-1.5-pro:latest',
      status: 'success',
      tokens: { input: 512, output: 128 },
    });
    expect(typeof recorded.duration).toBe('number');
    expect(recorded.duration).toBeGreaterThanOrEqual(0);

    expect(logger.debug).toHaveBeenCalledWith(
      'LLM request metrics recorded',
      expect.objectContaining({
        provider: 'openrouter_deepmind',
        model: 'gemini-1.5-pro:latest',
        correlationId: 'openrouter-hybrid-coverage',
        tokens: { input: 512, output: 128 },
        status: 'success',
      })
    );
  });
});
