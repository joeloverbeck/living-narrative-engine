/**
 * @file metrics-middleware-advanced.integration.test.js
 * @description Additional integration coverage for metrics middleware edge cases using real Express apps
 */

import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';

import MetricsService from '../../src/services/metricsService.js';
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

describe('Metrics middleware advanced integration coverage', () => {
  let logger;

  beforeEach(() => {
    logger = createTestLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const withMetricsApp = ({
    metricsService,
    enabled = true,
    configure = () => {},
    routeResolver,
    bodyParsers = [(app) => app.use(express.json())],
  }) => {
    const app = express();

    bodyParsers.forEach((applyParser) => applyParser(app));

    app.use((req, _res, next) => {
      req.correlationId = 'advanced-metrics-test';
      next();
    });

    app.use(
      createMetricsMiddleware({
        metricsService,
        logger,
        enabled,
        routeResolver,
      })
    );

    configure(app);

    return app;
  };

  it('short-circuits when disabled and leaves request flow untouched', async () => {
    const metricsService = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });
    const httpSpy = jest.spyOn(metricsService, 'recordHttpRequest');

    const app = withMetricsApp({
      metricsService,
      enabled: false,
      configure: (expressApp) => {
        expressApp.get('/disabled', (_req, res) => {
          res.status(204).send();
        });
      },
    });

    await request(app).get('/disabled').expect(204);

    expect(httpSpy).not.toHaveBeenCalled();

    metricsService.clear();
  });

  it('ignores /metrics endpoint while still tracking other routes', async () => {
    const metricsService = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });

    const app = withMetricsApp({
      metricsService,
      configure: (expressApp) => {
        expressApp.get('/metrics', (_req, res) => {
          res.status(200).send('metrics endpoint');
        });
        expressApp.get('/health', (_req, res) => {
          res.status(200).json({ status: 'UP' });
        });
      },
    });

    await request(app).get('/metrics').expect(200);
    await request(app).get('/health').expect(200);

    const metricsOutput = await metricsService.getMetrics();

    expect(metricsOutput).toContain('route="/health"');
    expect(metricsOutput).not.toContain('route="/metrics"');

    metricsService.clear();
  });

  it('records accurate payload sizes for text bodies and buffer responses', async () => {
    const metricsService = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });
    const app = withMetricsApp({
      metricsService,
      bodyParsers: [
        (expressApp) => {
          expressApp.use(express.text({ type: '*/*' }));
          expressApp.use((req, _res, next) => {
            delete req.headers['content-length'];
            next();
          });
        },
      ],
      configure: (expressApp) => {
        expressApp.post('/text-endpoint', (req, res) => {
          res.set('x-handler-body-length', String(req.body.length || 0));
          res.status(201);
          res.set('transfer-encoding', 'chunked');
          res.end(Buffer.from('buffer-response'));
        });
      },
    });

    const response = await request(app)
      .post('/text-endpoint')
      .set('content-type', 'text/plain')
      .send('sample-text-payload');

    expect(response.status).toBe(201);

    // Allow asynchronous finish handlers to flush metrics recording
    await new Promise((resolve) => setImmediate(resolve));

    const metricsOutput = await metricsService.getMetrics();

    expect(metricsOutput).toContain(
      'llm_proxy_http_requests_total{method="POST",route="/text-endpoint",status_code="201"} 1'
    );
    expect(metricsOutput).toContain(
      'llm_proxy_http_request_size_bytes_sum{method="POST",route="/text-endpoint"} 19'
    );
    expect(metricsOutput).toContain(
      'llm_proxy_http_response_size_bytes_sum{method="POST",route="/text-endpoint",status_code="201"} 15'
    );

    metricsService.clear();
  });

  it('parameterizes dynamic API routes and classifies rate limit responses', async () => {
    const metricsService = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });
    const httpSpy = jest.spyOn(metricsService, 'recordHttpRequest');
    const errorSpy = jest.spyOn(metricsService, 'recordError');

    const app = withMetricsApp({
      metricsService,
      configure: (expressApp) => {
        expressApp.get(
          '/api/users/12345/v2/items/abcdef123456',
          (_req, res) => {
            res.status(429).json({ error: 'Too many requests' });
          }
        );
      },
    });

    await request(app)
      .get('/api/users/12345/v2/items/abcdef123456')
      .expect(429);

    expect(httpSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        route: '/api/users/:id/v*/items/:hash',
        statusCode: 429,
      })
    );
    expect(errorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        errorType: 'rate_limit_exceeded',
        severity: 'medium',
      })
    );

    metricsService.clear();
  });

  it('captures diverse LLM metrics patterns including OpenRouter IDs and nested usage data', async () => {
    const metricsService = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });

    const app = withMetricsApp({
      metricsService,
      configure: (expressApp) => {
        expressApp.post(
          '/api/llm-request',
          createLlmMetricsMiddleware({ metricsService, logger }),
          (req, res) => {
            if (req.body.variant === 'openrouter') {
              return res.status(200).json({
                token_usage: { input: 42, output: 7 },
              });
            }

            return res.status(500).json({
              data: {
                usage: { prompt_tokens: 9, completion_tokens: 2 },
              },
            });
          }
        );
      },
    });

    await request(app)
      .post('/api/llm-request')
      .send({
        variant: 'openrouter',
        llmId: 'openrouter/anthropic/claude-3-haiku',
      })
      .expect(200);

    await request(app)
      .post('/api/llm-request')
      .send({ variant: 'nested' })
      .expect(500);

    const metricsOutput = await metricsService.getMetrics();

    expect(metricsOutput).toContain(
      'llm_proxy_llm_requests_total{llm_provider="openrouter_anthropic",model="claude-3-haiku",status="success"} 1'
    );
    expect(metricsOutput).toContain(
      'llm_proxy_llm_tokens_processed_total{llm_provider="openrouter_anthropic",model="claude-3-haiku",token_type="input"} 42'
    );
    expect(metricsOutput).toContain(
      'llm_proxy_llm_tokens_processed_total{llm_provider="unknown",model="unknown",token_type="input"} 9'
    );
    expect(metricsOutput).toContain(
      'llm_proxy_llm_requests_total{llm_provider="unknown",model="unknown",status="error"} 1'
    );

    metricsService.clear();
  });
});
