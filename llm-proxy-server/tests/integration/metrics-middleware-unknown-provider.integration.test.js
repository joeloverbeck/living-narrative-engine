/**
 * @file metrics-middleware-unknown-provider.integration.test.js
 * @description Ensures the LLM metrics middleware gracefully categorises requests
 *              with malformed or absent LLM identifiers by exercising the
 *              provider/model fallback branches with the real middleware stack.
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

describe('metrics middleware unknown provider classification', () => {
  let app;
  let metricsService;

  beforeEach(() => {
    metricsService = new RecordingMetricsService();
    const logger = createTestLogger();

    app = express();
    app.use(express.json());

    app.post(
      '/llm/unknown-provider',
      (req, _res, next) => {
        req.correlationId = 'unknown-provider-correlation-id';
        next();
      },
      createLlmMetricsMiddleware({ metricsService, logger }),
      (_req, res) => {
        // Simulate an upstream failure with an opaque response payload
        res.status(503).json({ error: 'service unavailable', raw: [1, 2, 3] });
      }
    );
  });

  it('labels requests without a usable llmId as coming from an unknown provider/model', async () => {
    await request(app)
      .post('/llm/unknown-provider')
      .send({ llmId: 42 })
      .expect(503);

    expect(metricsService.llmRequests).toHaveLength(1);
    const [entry] = metricsService.llmRequests;

    expect(entry).toMatchObject({
      provider: 'unknown',
      model: 'unknown',
      status: 'error',
      tokens: null,
    });
  });
});
