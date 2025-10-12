/**
 * @file metrics-middleware-fallbacks.integration.test.js
 * @description Targets previously uncovered integration paths within the metrics middleware layer,
 *              exercising finish-event fallbacks, request/response size error handling, and
 *              comprehensive HTTP status classification without relying on mocked modules.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import { EventEmitter } from 'events';

import {
  createMetricsMiddleware,
  createLlmMetricsMiddleware,
} from '../../src/middleware/metrics.js';

const createTestLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

class RecordingMetricsService {
  constructor() {
    this.httpRequests = [];
    this.errors = [];
    this.llmRequests = [];
  }

  recordHttpRequest(payload) {
    this.httpRequests.push(payload);
  }

  recordError(payload) {
    this.errors.push(payload);
  }

  recordLlmRequest(payload) {
    this.llmRequests.push(payload);
  }
}

describe('Metrics middleware fallback integration coverage', () => {
  let logger;

  beforeEach(() => {
    logger = createTestLogger();
    jest.restoreAllMocks();
  });

  it('records metrics when only the finish event fires and header lookups fail', () => {
    const metricsService = new RecordingMetricsService();
    const middleware = createMetricsMiddleware({ metricsService, logger });

    const req = {
      method: 'GET',
      path: '/finish-only',
      originalUrl: '/finish-only?query=true',
      correlationId: 'finish-fallback',
      body: {
        toJSON() {
          throw new Error('serialization failure');
        },
      },
      get: () => {
        throw new Error('header lookup failed');
      },
    };

    const res = new EventEmitter();
    res.statusCode = 500;
    res.get = () => {
      throw new Error('response header missing');
    };
    res.end = jest.fn();

    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);

    res.emit('finish');

    expect(metricsService.httpRequests).toHaveLength(1);
    const [entry] = metricsService.httpRequests;
    expect(entry).toMatchObject({
      method: 'GET',
      route: '/finish-only',
      statusCode: 500,
      requestSize: 0,
      responseSize: 0,
    });

    expect(metricsService.errors).toEqual([
      {
        errorType: 'internal_server_error',
        component: 'http_server',
        severity: 'high',
      },
    ]);
  });

  it('classifies diverse HTTP error codes and LLM IDs while respecting severity tiers', async () => {
    const metricsService = new RecordingMetricsService();
    const app = express();

    app.use(express.json());
    app.use((req, _res, next) => {
      req.correlationId = 'status-coverage';
      next();
    });

    app.use(createMetricsMiddleware({ metricsService, logger }));

    app.get('/status/:code', (req, res) => {
      const code = Number(req.params.code);
      if (Number.isNaN(code)) {
        return res.status(400).send('bad status');
      }

      if (code === 413) {
        res.status(code);
        res.set('Content-Length', 'invalid');
        return res.send(Buffer.from('payload-too-large'));
      }

      return res.status(code).send(`status-${code}`);
    });

    app.post(
      '/llm',
      createLlmMetricsMiddleware({ metricsService, logger }),
      (req, res) => {
        res.status(207).json({ status: 'multi' });
      }
    );

    const agent = request(app);
    await agent.get('/status/403');
    await agent.get('/status/404');
    await agent.get('/status/413');
    await agent.get('/status/418');
    await agent.get('/status/500');
    await agent.get('/status/501');
    await agent.get('/status/502');
    await agent.get('/status/504');
    await agent.get('/status/520');

    await agent
      .post('/llm')
      .send({ llmId: { provider: 'object-id' }, payload: { ok: true } })
      .expect(207);

    const errorsByStatus = new Map(
      metricsService.httpRequests
        .filter((entry) => entry.statusCode >= 400)
        .map((entry, index) => [entry.statusCode, metricsService.errors[index]])
    );

    expect(errorsByStatus.get(403)).toMatchObject({
      errorType: 'forbidden',
      severity: 'medium',
    });
    expect(errorsByStatus.get(404)).toMatchObject({
      errorType: 'not_found',
      severity: 'low',
    });
    expect(errorsByStatus.get(413)).toMatchObject({
      errorType: 'payload_too_large',
      severity: 'low',
    });
    expect(errorsByStatus.get(418)).toMatchObject({
      errorType: 'client_error',
      severity: 'low',
    });
    expect(errorsByStatus.get(500)).toMatchObject({
      errorType: 'internal_server_error',
      severity: 'high',
    });
    expect(errorsByStatus.get(501)).toMatchObject({
      errorType: 'not_implemented',
      severity: 'high',
    });
    expect(errorsByStatus.get(502)).toMatchObject({
      errorType: 'bad_gateway',
      severity: 'high',
    });
    expect(errorsByStatus.get(504)).toMatchObject({
      errorType: 'gateway_timeout',
      severity: 'high',
    });
    expect(errorsByStatus.get(520)).toMatchObject({
      errorType: 'server_error',
      severity: 'high',
    });

    expect(metricsService.llmRequests).toHaveLength(1);
    expect(metricsService.llmRequests[0]).toMatchObject({
      provider: 'unknown',
      model: 'unknown',
      status: 'success',
    });
  });
});
