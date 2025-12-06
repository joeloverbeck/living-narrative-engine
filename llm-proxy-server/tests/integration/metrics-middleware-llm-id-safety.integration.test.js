/**
 * @file metrics-middleware-llm-id-safety.integration.test.js
 * @description Exercises the LLM metrics middleware against unusual identifier
 *              inputs to ensure provider/model derivation remains stable when
 *              encountering missing or malformed llmId values. The test suite
 *              wires the middleware into a real Express app so interactions
 *              flow through the actual request/response lifecycle without
 *              mocking internal modules.
 */

import { afterEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import { createLlmMetricsMiddleware } from '../../src/middleware/metrics.js';

class RecordingMetricsService {
  constructor() {
    /**
     * @type {Array<import('../../src/services/metricsService.js').LlmRequestMetric>}
     */
    this.llmRequests = [];
  }

  /**
   * @param {import('../../src/services/metricsService.js').LlmRequestMetric} payload
   */
  recordLlmRequest(payload) {
    this.llmRequests.push(payload);
  }
}

describe('Metrics middleware LLM identifier safety integration', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Creates an Express application wired with the LLM metrics middleware and
   * a recording metrics service so assertions can inspect captured payloads.
   * @returns {{ app: import('express').Express, metricsService: RecordingMetricsService, logger: Record<string, jest.Mock> }}
   */
  function createTestApp() {
    const metricsService = new RecordingMetricsService();
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const app = express();
    app.use(express.json());

    app.post(
      '/llm/metrics-safety',
      (req, _res, next) => {
        req.correlationId = 'llm-id-safety';
        next();
      },
      createLlmMetricsMiddleware({ metricsService, logger }),
      (_req, res) => {
        res.status(207).json({ data: {} });
      }
    );

    return { app, metricsService, logger };
  }

  it('treats missing llmId values as unknown provider/model pairs', async () => {
    const { app, metricsService, logger } = createTestApp();

    const response = await request(app)
      .post('/llm/metrics-safety')
      .send({ prompt: 'run without identifier' });

    expect(response.status).toBe(207);
    expect(metricsService.llmRequests).toHaveLength(1);

    const [recorded] = metricsService.llmRequests;
    expect(recorded).toMatchObject({
      provider: 'unknown',
      model: 'unknown',
      status: 'success',
      tokens: null,
    });

    expect(logger.debug).toHaveBeenCalledWith(
      'LLM request metrics recorded',
      expect.objectContaining({
        provider: 'unknown',
        model: 'unknown',
        status: 'success',
        correlationId: 'llm-id-safety',
      })
    );
  });

  it('preserves lowercase fallback identifiers when format parsing fails', async () => {
    const { app, metricsService, logger } = createTestApp();
    const rawIdentifier = 'Experimental-Provider::MODEL@BETA';

    const response = await request(app)
      .post('/llm/metrics-safety')
      .send({ llmId: rawIdentifier, context: { attempt: 1 } });

    expect(response.status).toBe(207);
    expect(metricsService.llmRequests).toHaveLength(1);

    const [recorded] = metricsService.llmRequests;
    expect(recorded).toMatchObject({
      provider: 'unknown',
      model: rawIdentifier.toLowerCase(),
      status: 'success',
      tokens: null,
    });

    expect(logger.debug).toHaveBeenCalledWith(
      'LLM request metrics recorded',
      expect.objectContaining({
        provider: 'unknown',
        model: rawIdentifier.toLowerCase(),
        correlationId: 'llm-id-safety',
      })
    );
  });
});
