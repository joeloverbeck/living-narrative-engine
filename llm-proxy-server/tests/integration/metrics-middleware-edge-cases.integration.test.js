/**
 * @file metrics-middleware-edge-cases.integration.test.js
 * @description Additional integration coverage for the metrics middleware layer.
 * The scenarios in this suite exercise error handling, fallback logic, and
 * route resolution behaviour that were previously untested by the primary
 * metrics integration suite.
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

import {
  createCacheMetricsRecorder,
  createLlmMetricsMiddleware,
  createMetricsMiddleware,
} from '../../src/middleware/metrics.js';

/**
 * @description Simple in-memory metrics collector used for assertions.
 */
class RecordingMetricsService {
  constructor() {
    this.httpRequests = [];
    this.errors = [];
    this.llmRequests = [];
    this.cacheOperations = [];
    this.throwOnHttp = false;
    this.throwOnLlm = false;
  }

  recordHttpRequest(payload) {
    if (this.throwOnHttp) {
      this.throwOnHttp = false;
      throw new Error('http-metrics-failure');
    }
    this.httpRequests.push(payload);
  }

  recordError(payload) {
    this.errors.push(payload);
  }

  recordLlmRequest(payload) {
    if (this.throwOnLlm) {
      this.throwOnLlm = false;
      throw new Error('llm-metrics-failure');
    }
    this.llmRequests.push(payload);
  }

  recordCacheOperation(payload) {
    this.cacheOperations.push(payload);
  }
}

const createTestLogger = () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  logger.isDebugEnabled = true;
  return logger;
};

describe('Metrics middleware edge case integration', () => {
  let metricsService;
  let logger;

  beforeEach(() => {
    metricsService = new RecordingMetricsService();
    logger = createTestLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('respects disabled middleware and validates dependency requirements', async () => {
    const app = express();
    app.use(
      createMetricsMiddleware({
        metricsService,
        logger,
        enabled: false,
      })
    );
    app.get('/ping', (_req, res) => res.status(204).end());

    await request(app).get('/ping').expect(204);
    expect(metricsService.httpRequests).toHaveLength(0);

    expect(() => createMetricsMiddleware({ logger })).toThrow(
      'metricsService is required for metrics middleware'
    );
    expect(() => createLlmMetricsMiddleware({ logger })).toThrow(
      'metricsService is required for LLM metrics middleware'
    );
    expect(() =>
      createCacheMetricsRecorder({ cacheType: 'missing-service' })
    ).toThrow('metricsService is required for cache metrics recorder');
  });

  it('captures extended metrics scenarios with fallback estimators and error handling', async () => {
    const app = express();

    app.use(express.json({ limit: '10kb', strict: false }));
    app.use((req, _res, next) => {
      req.correlationId =
        req.get('x-correlation-id') || 'edge-case-correlation';
      next();
    });
    app.use((req, _res, next) => {
      if (req.path === '/circular') {
        const problematicBody = {};
        problematicBody.self = problematicBody;
        req.body = problematicBody;
        delete req.headers['content-length'];
      }
      next();
    });

    app.use(
      createMetricsMiddleware({
        metricsService,
        logger,
      })
    );

    const cacheRecorder = createCacheMetricsRecorder({
      metricsService,
      cacheType: 'integration-cache',
    });

    app.post('/circular', (_req, res) => {
      res.status(401).json({
        message: 'circular-body',
        usage: {
          prompt_tokens: 5,
          completion_tokens: 2,
        },
      });
    });

    app.post('/api/status', (_req, res) => {
      res.status(405).json({ message: 'method not allowed' });
    });

    app.post('/timeout', (_req, res) => {
      res.status(408).end('slow-down');
    });

    app.post('/ratelimit', (_req, res) => {
      res.status(429).json({ error: 'too many requests' });
    });

    app.post('/server-error', (_req, res) => {
      res.status(503).json({ message: 'service unavailable' });
    });

    app.post('/fail-http', (_req, res) => {
      metricsService.throwOnHttp = true;
      const buffer = Buffer.from('down');
      res.status(503).end(buffer);
    });

    app.get('/buffer', (_req, res) => {
      const payload = Buffer.from('edge');
      res.set('Content-Length', String(payload.length));
      res.status(200).end(payload);
    });

    app.post('/cache/record', (_req, res) => {
      cacheRecorder.recordOperation('refresh', 'success', { nodes: 2 });
      cacheRecorder.recordStats(4, 2048);
      res.status(204).end();
    });

    app.post(
      '/api/llm-request',
      createLlmMetricsMiddleware({ metricsService, logger }),
      (req, res) => {
        const variant = req.query.variant;
        if (variant === 'usage') {
          return res.status(200).json({
            usage: {
              prompt_tokens: 11,
              completion_tokens: 7,
            },
          });
        }
        if (variant === 'token_usage') {
          return res.status(200).json({
            token_usage: {
              input: 10,
              output: 5,
            },
          });
        }
        if (variant === 'nested') {
          return res.status(201).json({
            data: {
              usage: {
                prompt_tokens: 7,
                completion_tokens: 3,
              },
            },
          });
        }
        if (variant === 'error') {
          const problematicResponse = {};
          Object.defineProperty(problematicResponse, 'usage', {
            get() {
              throw new Error('usage-access-failure');
            },
          });
          Object.defineProperty(problematicResponse, 'toJSON', {
            value: () => ({ ok: true }),
          });
          return res.status(200).json(problematicResponse);
        }
        if (variant === 'throw') {
          metricsService.throwOnLlm = true;
          return res.status(500).json({ message: 'llm failure' });
        }

        return res.status(204).end();
      }
    );

    await request(app).post('/circular').send({});
    await request(app)
      .post('/api/status')
      .set('Content-Length', '8')
      .send('"ping"');
    await request(app).post('/timeout').send();
    await request(app).post('/ratelimit').send({});
    await request(app).post('/server-error').send({});
    await request(app).post('/fail-http').send({});
    await request(app).get('/buffer').expect(200);
    await request(app).post('/cache/record').send({});

    await request(app)
      .post('/api/llm-request?variant=usage')
      .send({ llmId: 'openai-gpt-4o' });
    await request(app)
      .post('/api/llm-request?variant=token_usage')
      .send({ llmId: 'anthropic-claude-3' });
    await request(app)
      .post('/api/llm-request?variant=nested')
      .send({ llmId: 'openrouter/anthropic/claude-3' });
    await request(app)
      .post('/api/llm-request?variant=error')
      .send({ llmId: 'custom-model' });
    await request(app)
      .post('/api/llm-request?variant=throw')
      .send({ llmId: 'custom-model' });

    const circularRequest = metricsService.httpRequests.find(
      (entry) => entry.route === '/circular'
    );
    expect(circularRequest).toBeDefined();
    expect(circularRequest.requestSize).toBe(1000);
    expect(circularRequest.responseSize).toBeGreaterThan(0);

    const bufferRequest = metricsService.httpRequests.find(
      (entry) => entry.route === '/buffer'
    );
    expect(bufferRequest?.responseSize).toBe(4);

    const apiStatusRequest = metricsService.httpRequests.find(
      (entry) => entry.route === '/api/*'
    );
    expect(apiStatusRequest?.statusCode).toBe(405);

    const errorTypes = metricsService.errors.map((entry) => entry.errorType);
    expect(errorTypes).toEqual(
      expect.arrayContaining([
        'unauthorized',
        'method_not_allowed',
        'request_timeout',
        'rate_limit_exceeded',
        'internal_server_error',
        'service_unavailable',
      ])
    );

    const errorSeverities = metricsService.errors.map(
      (entry) => entry.severity
    );
    expect(errorSeverities).toEqual(expect.arrayContaining(['medium', 'high']));

    expect(metricsService.cacheOperations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: 'refresh',
          result: 'success',
          cacheType: 'integration-cache',
          nodes: 2,
        }),
        expect.objectContaining({
          operation: 'stats_update',
          cacheType: 'integration-cache',
          size: 4,
          memoryUsage: 2048,
        }),
      ])
    );

    const [firstLlm, secondLlm, thirdLlm, fourthLlm] =
      metricsService.llmRequests;
    expect(firstLlm).toMatchObject({
      provider: 'openai',
      model: 'gpt-4o',
      tokens: { input: 11, output: 7 },
      status: 'success',
    });
    expect(secondLlm).toMatchObject({
      provider: 'anthropic',
      tokens: { input: 10, output: 5 },
    });
    expect(thirdLlm).toMatchObject({
      provider: 'openrouter_anthropic',
      tokens: { input: 7, output: 3 },
      status: 'success',
    });
    expect(fourthLlm).toMatchObject({
      provider: 'unknown',
      model: 'custom-model',
      tokens: null,
    });

    expect(logger.error).toHaveBeenCalledWith(
      'Error recording HTTP request metrics',
      expect.any(Error)
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Error recording LLM request metrics',
      expect.any(Error)
    );
  });
});
