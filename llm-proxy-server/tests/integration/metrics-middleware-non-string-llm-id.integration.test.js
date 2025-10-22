/**
 * @file metrics-middleware-non-string-llm-id.integration.test.js
 * @description Exercises the metrics middleware when requests carry non-string
 *              llmId values. This covers the guard branch in parseLlmId that
 *              normalises invalid identifiers to the ['unknown', 'unknown']
 *              tuple while still flowing through the full middleware stack
 *              without mocks.
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

describe('Metrics middleware non-string llmId handling', () => {
  let app;
  let metricsService;
  let logger;

  beforeEach(() => {
    metricsService = new RecordingMetricsService();
    logger = new RecordingLogger();

    app = express();
    app.use(express.json());

    app.post(
      '/llm/non-string-id',
      (req, _res, next) => {
        req.correlationId = 'non-string-identifier';
        next();
      },
      createLlmMetricsMiddleware({ metricsService, logger }),
      (_req, res) => {
        res.status(202).json({
          status: 'accepted',
          usage: {
            prompt_tokens: 6,
            completion_tokens: 3,
          },
        });
      }
    );
  });

  it('normalises non-string llmId values to the unknown provider/model tuple', async () => {
    const response = await request(app)
      .post('/llm/non-string-id')
      .send({
        llmId: { vendor: 'CustomAI', tier: 'alpha' },
        payload: { prompt: 'integrate unusual identifier' },
      })
      .expect(202);

    expect(response.body).toEqual({
      status: 'accepted',
      usage: {
        prompt_tokens: 6,
        completion_tokens: 3,
      },
    });

    expect(metricsService.llmRequests).toHaveLength(1);
    const [entry] = metricsService.llmRequests;
    expect(entry).toMatchObject({
      provider: 'unknown',
      model: 'unknown',
      status: 'success',
      tokens: { input: 6, output: 3 },
    });

    expect(logger.debugEntries).toHaveLength(1);
    expect(logger.debugEntries[0].context).toMatchObject({
      provider: 'unknown',
      model: 'unknown',
      correlationId: 'non-string-identifier',
    });
    expect(logger.errorEntries).toHaveLength(0);
  });
});
