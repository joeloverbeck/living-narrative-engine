/**
 * @file metrics-service-observability.integration.test.js
 * @description Integration coverage for MetricsService ensuring both rich telemetry
 *              emission and resilience paths when collaborating modules experience
 *              Prometheus primitive failures.
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
  createCacheMetricsRecorder,
} from '../../src/middleware/metrics.js';

const waitForAsync = () => new Promise((resolve) => setImmediate(resolve));

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

describe('MetricsService observability integration', () => {
  let logger;

  beforeEach(() => {
    logger = createTestLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('records comprehensive telemetry when collaborating middleware provides full context', async () => {
    const service = new MetricsService({
      logger,
      collectDefaultMetrics: true,
      defaultMetricsInterval: 20,
    });

    const app = express();
    app.use(express.json());
    app.use(
      createMetricsMiddleware({
        metricsService: service,
        logger,
        enabled: true,
      })
    );

    app.post(
      '/llm/full',
      createLlmMetricsMiddleware({ metricsService: service, logger }),
      (req, res) => {
        const cacheRecorder = createCacheMetricsRecorder({
          metricsService: service,
          cacheType: 'llm-response',
        });

        cacheRecorder.recordOperation('get', 'hit', {
          size: 2,
          memoryUsage: 512,
        });
        cacheRecorder.recordStats(5, 2048);

        service.recordRateLimiting({
          limitType: 'general',
          clientType: 'ip',
          patternType: 'sustained_burst',
          severity: 'high',
          mapSize: 9,
        });

        service.recordSecurityValidation({
          result: 'pass',
          validationType: 'headers',
          incidentType: 'shadow_anomaly',
          severity: 'medium',
        });

        service.recordApiKeyOperation({
          operation: 'retrieve',
          result: 'success',
          keySource: 'env',
        });

        service.recordHealthCheck({
          checkType: 'readiness',
          result: 'success',
          duration: 0.24,
        });

        service.recordError({
          errorType: 'timeout',
          component: 'llm_gateway',
          severity: 'critical',
        });

        res.status(200).json({
          ok: true,
          llmId: req.body.llmId,
          usage: {
            prompt_tokens: 42,
            completion_tokens: 21,
          },
        });
      }
    );

    const payload = { llmId: 'openai/gpt-4', prompt: 'collect metrics' };
    const response = await request(app).post('/llm/full').send(payload);

    expect(response.status).toBe(200);

    await waitForAsync();

    const metricsJson = await service.getRegistry().getMetricsAsJSON();
    const findMetric = (name) =>
      metricsJson.find((metric) => metric.name === name) ?? { values: [] };

    const httpSizeMetric = findMetric('llm_proxy_http_request_size_bytes');
    expect(httpSizeMetric.values[0]?.value).toBeGreaterThan(0);

    const httpResponseSize = findMetric('llm_proxy_http_response_size_bytes');
    expect(httpResponseSize.values[0]?.value).toBeGreaterThan(0);

    const tokenMetric = findMetric('llm_proxy_llm_tokens_processed_total');
    const tokenLabels = tokenMetric.values
      .map((entry) => entry.labels.token_type)
      .sort();
    expect(tokenLabels).toEqual(['input', 'output']);

    const cacheSizeMetric = findMetric('llm_proxy_cache_size_entries');
    expect(cacheSizeMetric.values[0]?.value).toBe(5);

    const cacheMemoryMetric = findMetric('llm_proxy_cache_memory_usage_bytes');
    expect(cacheMemoryMetric.values[0]?.value).toBe(2048);

    const rateLimitGauge = findMetric('llm_proxy_rate_limit_map_size_entries');
    expect(rateLimitGauge.values[0]?.value).toBe(9);

    const securityValidationMetric = findMetric(
      'llm_proxy_security_validation_results_total'
    );
    expect(securityValidationMetric.values[0]?.labels).toMatchObject({
      result: 'pass',
      validation_type: 'headers',
    });

    const securityIncidentMetric = findMetric(
      'llm_proxy_security_incidents_total'
    );
    expect(securityIncidentMetric.values[0]?.labels).toMatchObject({
      incident_type: 'shadow_anomaly',
      severity: 'medium',
    });

    const apiKeyMetric = findMetric('llm_proxy_api_key_operations_total');
    expect(apiKeyMetric.values[0]?.labels).toMatchObject({
      operation: 'retrieve',
      result: 'success',
      key_source: 'env',
    });

    const healthResultMetric = findMetric(
      'llm_proxy_health_check_results_total'
    );
    expect(healthResultMetric.values[0]?.labels).toMatchObject({
      check_type: 'readiness',
      result: 'success',
    });

    const errorMetric = findMetric('llm_proxy_errors_total');
    expect(errorMetric.values[0]?.labels).toMatchObject({
      error_type: 'timeout',
      component: 'llm_gateway',
      severity: 'critical',
    });

    const statsBeforeReset = service.getStats();
    expect(statsBeforeReset).toMatchObject({ enabled: true });
    expect(typeof statsBeforeReset.totalMetrics).toBe('number');

    service.reset();
    expect(logger.debug).toHaveBeenCalledWith('Metrics reset successfully');

    const statsAfterReset = service.getStats();
    expect(statsAfterReset).toMatchObject({ enabled: true });

    service.clear();
    expect(logger.debug).toHaveBeenCalledWith('Metrics cleared successfully');
  });

  it('logs and absorbs failures when Prometheus primitives throw unexpectedly', async () => {
    const service = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });

    const app = express();
    app.use(express.json());
    app.use(
      createMetricsMiddleware({
        metricsService: service,
        logger,
        enabled: true,
      })
    );

    jest.spyOn(service.httpRequestsTotal, 'inc').mockImplementation(() => {
      throw new Error('http counter failure');
    });
    jest.spyOn(service.llmRequestsTotal, 'inc').mockImplementation(() => {
      throw new Error('llm counter failure');
    });
    jest.spyOn(service.cacheOperationsTotal, 'inc').mockImplementation(() => {
      throw new Error('cache counter failure');
    });
    jest.spyOn(service.cacheSize, 'set').mockImplementation(() => {
      throw new Error('cache size failure');
    });
    jest.spyOn(service.cacheMemoryUsage, 'set').mockImplementation(() => {
      throw new Error('cache memory failure');
    });
    jest.spyOn(service.rateLimitHits, 'inc').mockImplementation(() => {
      throw new Error('rate limit counter failure');
    });
    jest
      .spyOn(service.suspiciousPatternsDetected, 'inc')
      .mockImplementation(() => {
        throw new Error('pattern counter failure');
      });
    jest.spyOn(service.rateLimitMapSize, 'set').mockImplementation(() => {
      throw new Error('rate limit gauge failure');
    });
    jest
      .spyOn(service.securityValidationResults, 'inc')
      .mockImplementation(() => {
        throw new Error('security validation counter failure');
      });
    jest.spyOn(service.securityIncidents, 'inc').mockImplementation(() => {
      throw new Error('security incident counter failure');
    });
    jest.spyOn(service.apiKeyOperations, 'inc').mockImplementation(() => {
      throw new Error('api key counter failure');
    });
    jest.spyOn(service.healthCheckResults, 'inc').mockImplementation(() => {
      throw new Error('health counter failure');
    });
    jest
      .spyOn(service.healthCheckDuration, 'observe')
      .mockImplementation(() => {
        throw new Error('health histogram failure');
      });
    jest.spyOn(service.errorsTotal, 'inc').mockImplementation(() => {
      throw new Error('error counter failure');
    });

    app.post(
      '/llm/failure',
      createLlmMetricsMiddleware({ metricsService: service, logger }),
      (_req, res) => {
        const cacheRecorder = createCacheMetricsRecorder({
          metricsService: service,
          cacheType: 'llm-response',
        });

        cacheRecorder.recordOperation('set', 'error', {
          size: 3,
          memoryUsage: 128,
        });
        cacheRecorder.recordStats(7, 4096);

        service.recordRateLimiting({
          limitType: 'auth',
          clientType: 'api_key',
          patternType: 'suspicious_ip',
          severity: 'critical',
          mapSize: 11,
        });

        service.recordSecurityValidation({
          result: 'fail',
          validationType: 'ip',
          incidentType: 'blocked_request',
          severity: 'high',
        });

        service.recordApiKeyOperation({
          operation: 'cache_hit',
          result: 'success',
          keySource: 'cache',
        });

        service.recordHealthCheck({
          checkType: 'liveness',
          result: 'failure',
          duration: 0.5,
        });

        service.recordError({
          errorType: 'validation',
          component: 'middleware',
          severity: 'high',
        });

        res.status(502).json({
          llmId: 'vertex/large',
          usage: {
            input_tokens: 3,
            output_tokens: 1,
          },
        });
      }
    );

    const failureResponse = await request(app)
      .post('/llm/failure')
      .send({ llmId: 'vertex/large', payload: 'bad path' });

    expect(failureResponse.status).toBe(502);

    await waitForAsync();

    const errorMessages = logger.error.mock.calls.map(([message]) => message);
    expect(errorMessages).toEqual(
      expect.arrayContaining([
        'Error recording HTTP request metrics',
        'Error recording LLM request metrics',
        'Error recording cache operation metrics',
        'Error recording rate limiting metrics',
        'Error recording security validation metrics',
        'Error recording API key operation metrics',
        'Error recording health check metrics',
        'Error recording error metrics',
      ])
    );

    jest
      .spyOn(service.getRegistry(), 'metrics')
      .mockRejectedValue(new Error('metrics snapshot failure'));
    await expect(service.getMetrics()).rejects.toThrow(
      'metrics snapshot failure'
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Error getting metrics',
      expect.any(Error)
    );

    jest.spyOn(service.getRegistry(), 'resetMetrics').mockImplementation(() => {
      throw new Error('reset failure');
    });
    service.reset();
    expect(logger.error).toHaveBeenCalledWith(
      'Error resetting metrics',
      expect.any(Error)
    );

    jest.spyOn(service.getRegistry(), 'clear').mockImplementation(() => {
      throw new Error('clear failure');
    });
    service.clear();
    expect(logger.error).toHaveBeenCalledWith(
      'Error clearing metrics',
      expect.any(Error)
    );

    jest
      .spyOn(service.getRegistry(), 'getMetricsAsJSON')
      .mockImplementation(() => {
        throw new Error('stats failure');
      });
    const stats = service.getStats();
    expect(stats).toEqual({ enabled: true, error: 'stats failure' });
    expect(logger.error).toHaveBeenCalledWith(
      'Error getting metrics stats',
      expect.any(Error)
    );
  });
});
