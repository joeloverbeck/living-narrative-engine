/**
 * @file metrics-middleware-unknown-string-provider.integration.test.js
 * @description Verifies the LLM metrics middleware records unknown providers when
 *              given non-standard string llmIds by exercising the parse fallback
 *              branch with the real middleware stack.
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

describe('metrics middleware custom provider fallback classification', () => {
  let app;
  let metricsService;

  beforeEach(() => {
    metricsService = new RecordingMetricsService();
    const logger = createTestLogger();

    app = express();
    app.use(express.json());

    app.post(
      '/llm/custom-provider',
      (req, _res, next) => {
        req.correlationId = 'custom-provider-correlation-id';
        next();
      },
      createLlmMetricsMiddleware({ metricsService, logger }),
      (_req, res) => {
        res.status(200).json({ result: 'ok' });
      }
    );
  });

  it('treats unrecognised string llmIds as unknown providers while preserving the model identifier', async () => {
    await request(app)
      .post('/llm/custom-provider')
      .send({ llmId: 'BespokeModelV1' })
      .expect(200);

    expect(metricsService.llmRequests).toHaveLength(1);
    const [entry] = metricsService.llmRequests;

    expect(entry).toMatchObject({
      provider: 'unknown',
      model: 'bespokemodelv1',
      status: 'success',
      tokens: null,
    });
  });
});
