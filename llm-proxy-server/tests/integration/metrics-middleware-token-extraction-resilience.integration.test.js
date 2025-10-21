/**
 * @file metrics-middleware-token-extraction-resilience.integration.test.js
 * @description Ensures the metrics middleware gracefully handles LLM responses
 *              whose token usage accessors throw while collaborating with a real
 *              Express pipeline.
 */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createLlmMetricsMiddleware } from '../../src/middleware/metrics.js';

class RecordingMetricsService {
  constructor() {
    /** @type {Array<object>} */
    this.llmRequests = [];
  }

  /**
   * @param {object} payload
   */
  recordLlmRequest(payload) {
    this.llmRequests.push(payload);
  }
}

const createTestLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('metrics middleware token extraction resilience integration', () => {
  let app;
  let metricsService;
  let logger;

  beforeEach(() => {
    logger = createTestLogger();
    metricsService = new RecordingMetricsService();

    const expressApp = express();
    expressApp.use(express.json());

    expressApp.post(
      '/llm/unstable',
      (req, _res, next) => {
        req.correlationId = 'token-extraction-resilience';
        next();
      },
      createLlmMetricsMiddleware({ metricsService, logger }),
      (_req, res) => {
        let usageAccessCount = 0;
        const unstablePayload = { status: 'unstable-success' };

        Object.defineProperty(unstablePayload, 'usage', {
          enumerable: true,
          get() {
            usageAccessCount += 1;
            throw new Error('usage-not-readable');
          },
        });

        unstablePayload.toJSON = () => ({
          status: 'unstable-success',
          usageAccessCount,
        });

        res.status(200).json(unstablePayload);
      }
    );

    app = expressApp;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records LLM request metrics even when token usage extraction throws', async () => {
    const response = await request(app)
      .post('/llm/unstable')
      .set('content-type', 'application/json')
      .send({ llmId: 'custom-provider-model-v1' })
      .expect(200);

    expect(response.body).toEqual({
      status: 'unstable-success',
      usageAccessCount: 1,
    });

    expect(metricsService.llmRequests).toHaveLength(1);
    const [entry] = metricsService.llmRequests;

    expect(entry.provider).toBe('unknown');
    expect(entry.model).toBe('custom-provider-model-v1');
    expect(entry.status).toBe('success');
    expect(entry.tokens).toBeNull();
    expect(typeof entry.duration).toBe('number');

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.debug).toHaveBeenCalledWith(
      'LLM request metrics recorded',
      expect.objectContaining({
        correlationId: 'token-extraction-resilience',
        tokens: null,
      })
    );
  });
});
