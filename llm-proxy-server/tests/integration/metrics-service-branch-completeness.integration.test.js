/**
 * @file metrics-service-branch-completeness.integration.test.js
 * @description Integration tests that exercise MetricsService branch paths that were
 *              previously uncovered, focusing on scenarios where optional data is
 *              intentionally missing while collaborating with real middleware.
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

describe('MetricsService branch completeness integration coverage', () => {
  let logger;

  beforeEach(() => {
    logger = createTestLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('short-circuits every recorder and lifecycle helper when metrics are disabled', async () => {
    const service = new MetricsService({
      logger,
      enabled: false,
      collectDefaultMetrics: false,
    });

    expect(service.isEnabled()).toBe(false);

    service.recordHttpRequest({
      method: 'GET',
      route: '/disabled',
      statusCode: 204,
      duration: 0.01,
    });
    service.recordLlmRequest({
      provider: 'openai',
      model: 'gpt-4',
      status: 'success',
      duration: 0.4,
    });
    service.recordCacheOperation({ operation: 'get', result: 'miss' });
    service.recordRateLimiting({ mapSize: 0 });
    service.recordSecurityValidation({});
    service.recordApiKeyOperation({ operation: 'retrieve', result: 'error' });
    service.recordHealthCheck({ checkType: 'readiness' });
    service.recordError({ errorType: 'network' });

    service.reset();

    const metricsOutput = await service.getMetrics();
    expect(metricsOutput).toBe('# Metrics collection is disabled\n');
    expect(service.getStats()).toEqual({ enabled: false });

    service.clear();
    expect(logger.info).toHaveBeenCalledWith('Metrics collection is disabled');
  });

  it('avoids optional metric emissions when collaborating modules supply partial context', async () => {
    const service = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.correlationId = 'metrics-branch-suite';
      next();
    });

    app.use(
      createMetricsMiddleware({
        metricsService: service,
        logger,
        enabled: service.isEnabled(),
      })
    );

    app.post(
      '/llm/minimal',
      createLlmMetricsMiddleware({ metricsService: service, logger }),
      (_req, res) => {
        service.recordLlmRequest({
          provider: 'manual-provider',
          model: 'minimal-model',
          status: 'success',
          duration: 0.05,
        });
        service.recordCacheOperation({
          operation: 'delete',
          result: 'success',
        });
        service.recordRateLimiting({ mapSize: 4 });
        service.recordSecurityValidation({
          incidentType: 'shadow-traffic',
        });
        service.recordApiKeyOperation({
          operation: 'retrieve',
          result: 'success',
        });
        service.recordHealthCheck({ checkType: 'readiness' });
        service.recordError({
          errorType: 'validation',
          component: 'controller',
        });
        res.status(204).end();
      }
    );

    const response = await request(app)
      .post('/llm/minimal')
      .set('content-length', '0');

    expect(response.status).toBe(204);

    await new Promise((resolve) => setImmediate(resolve));

    const metricsJson = await service.getRegistry().getMetricsAsJSON();
    const findMetric = (name) =>
      metricsJson.find((metric) => metric.name === name);
    const getValues = (name) => findMetric(name)?.values ?? [];

    expect(getValues('llm_proxy_http_request_size_bytes')).toHaveLength(0);
    expect(getValues('llm_proxy_http_response_size_bytes')).toHaveLength(0);
    expect(getValues('llm_proxy_llm_tokens_processed_total')).toHaveLength(0);
    expect(getValues('llm_proxy_cache_size_entries')).toHaveLength(0);
    expect(getValues('llm_proxy_cache_memory_usage_bytes')).toHaveLength(0);
    expect(getValues('llm_proxy_rate_limit_hits_total')).toHaveLength(0);
    expect(
      getValues('llm_proxy_suspicious_patterns_detected_total')
    ).toHaveLength(0);
    expect(
      getValues('llm_proxy_security_validation_results_total')
    ).toHaveLength(0);
    expect(getValues('llm_proxy_security_incidents_total')).toHaveLength(0);
    expect(getValues('llm_proxy_api_key_operations_total')).toHaveLength(0);
    expect(getValues('llm_proxy_health_check_results_total')).toHaveLength(0);
    expect(getValues('llm_proxy_health_check_duration_seconds')).toHaveLength(
      0
    );
    expect(getValues('llm_proxy_errors_total')).toHaveLength(0);

    const mapSizeMetric = findMetric('llm_proxy_rate_limit_map_size_entries');
    expect(mapSizeMetric?.values?.[0]?.value).toBe(4);

    const metricsOutput = await service.getMetrics();
    expect(metricsOutput).toContain('llm_proxy_llm_requests_total');
    expect(metricsOutput).toContain('status="success"');

    service.clear();
  });
});
