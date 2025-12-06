/**
 * @file metrics-service-disabled-and-resilience.integration.test.js
 * @description Integration tests covering MetricsService disabled mode and failure recovery paths.
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
import { register } from 'prom-client';

import MetricsService from '../../src/services/metricsService.js';
import { createMetricsMiddleware } from '../../src/middleware/metrics.js';
import { createConsoleLogger } from '../../src/consoleLogger.js';

const invokeAllRecorders = (service) => {
  service.recordHttpRequest({
    method: 'POST',
    route: '/llm/request',
    statusCode: 202,
    duration: 0.25,
    requestSize: 512,
    responseSize: 2048,
  });
  service.recordLlmRequest({
    provider: 'openai',
    model: 'gpt-4o',
    status: 'success',
    duration: 1.2,
    tokens: { input: 128, output: 256 },
  });
  service.recordCacheOperation({
    operation: 'set',
    result: 'success',
    cacheType: 'api-key',
    size: 1,
    memoryUsage: 4096,
  });
  service.recordRateLimiting({
    limitType: 'general',
    clientType: 'api-key',
    patternType: 'burst',
    severity: 'high',
    mapSize: 3,
  });
  service.recordSecurityValidation({
    result: 'pass',
    validationType: 'headers',
    incidentType: 'spoofing',
    severity: 'medium',
  });
  service.recordApiKeyOperation({
    operation: 'retrieve',
    result: 'success',
    keySource: 'cache',
  });
  service.recordHealthCheck({
    checkType: 'readiness',
    result: 'success',
    duration: 0.05,
  });
  service.recordError({
    errorType: 'network',
    component: 'llm-request-service',
    severity: 'high',
  });
};

describe('MetricsService disabled instrumentation', () => {
  let logger;

  beforeEach(() => {
    register.clear();
    logger = createConsoleLogger();
  });

  it('bypasses instrumentation and reports disabled state when metrics are turned off', async () => {
    const metricsService = new MetricsService({
      logger,
      enabled: false,
      collectDefaultMetrics: false,
    });

    const app = express();
    app.use(
      createMetricsMiddleware({
        logger,
        metricsService,
        enabled: metricsService.isEnabled(),
      })
    );
    app.get('/ping', (_req, res) => {
      invokeAllRecorders(metricsService);
      res.status(204).send();
    });

    await request(app).get('/ping').expect(204);

    expect(metricsService.isEnabled()).toBe(false);
    await expect(metricsService.getMetrics()).resolves.toBe(
      '# Metrics collection is disabled\n'
    );
    expect(metricsService.getStats()).toEqual({ enabled: false });

    // Ensure lifecycle helpers are safe when disabled
    expect(() => metricsService.reset()).not.toThrow();
    expect(() => metricsService.clear()).not.toThrow();
  });
});

describe('MetricsService failure resilience', () => {
  let metricsService;
  let logger;

  beforeEach(() => {
    logger = createConsoleLogger();
    metricsService = new MetricsService({
      logger,
      defaultMetricsInterval: 50,
    });
  });

  afterEach(() => {
    metricsService.clear();
    jest.restoreAllMocks();
  });

  it('collects metrics across domains and tolerates instrumentation failures', async () => {
    const defaultOptionsService = new MetricsService();
    defaultOptionsService.clear();

    const metricsServiceWithoutDefaults = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });
    metricsServiceWithoutDefaults.clear();

    metricsService.clear();
    metricsService = new MetricsService({
      logger,
      defaultMetricsInterval: 50,
    });

    invokeAllRecorders(metricsService);
    metricsService.recordHttpRequest({
      method: 'GET',
      route: '/skip-sizes',
      statusCode: 204,
      duration: 0.01,
      requestSize: 0,
      responseSize: 0,
    });
    metricsService.recordLlmRequest({
      provider: 'openai',
      model: 'gpt-4o-mini',
      status: 'success',
      duration: 0.5,
    });
    metricsService.recordLlmRequest({
      provider: 'openai',
      model: 'gpt-4o-mini',
      status: 'success',
      duration: 0.25,
      tokens: { input: 0, output: -1 },
    });
    metricsService.recordCacheOperation({
      operation: 'get',
      result: 'miss',
      cacheType: 'api-key',
    });
    metricsService.recordCacheOperation({
      operation: 'delete',
      result: 'success',
    });
    metricsService.recordRateLimiting({
      limitType: undefined,
      clientType: undefined,
      mapSize: undefined,
    });
    metricsService.recordSecurityValidation({
      result: 'pass',
      validationType: 'headers',
    });
    metricsService.recordSecurityValidation({
      result: undefined,
      validationType: 'headers',
    });
    metricsService.recordApiKeyOperation({
      operation: 'retrieve',
      result: 'success',
    });
    metricsService.recordHealthCheck({
      checkType: 'readiness',
      result: 'success',
    });
    metricsService.recordHealthCheck({ checkType: 'liveness' });
    metricsService.recordError({
      errorType: 'network',
      component: 'api-gateway',
    });

    const registry = metricsService.getRegistry();
    expect(registry).toBe(register);

    const metricsText = await metricsService.getMetrics();
    expect(metricsText).toContain('llm_proxy_http_requests_total');

    const stats = metricsService.getStats();
    expect(stats).toMatchObject({ enabled: true });
    expect(typeof stats.totalMetrics).toBe('number');
    expect(typeof stats.customMetrics).toBe('number');
    expect(typeof stats.defaultMetrics).toBe('number');

    const metricsDataSpy = jest
      .spyOn(register, 'getMetricsAsJSON')
      .mockImplementation(() => [
        { name: 'llm_proxy_http_requests_total' },
        { name: 'process_cpu_user_seconds_total' },
      ]);
    const enrichedStats = metricsService.getStats();
    expect(enrichedStats.customMetrics).toBeGreaterThan(0);
    expect(enrichedStats.defaultMetrics).toBeGreaterThan(0);
    metricsDataSpy.mockRestore();

    // reset succeeds under normal conditions
    expect(() => metricsService.reset()).not.toThrow();

    // Trigger histogram validation failure paths
    expect(() =>
      metricsService.recordHttpRequest({
        method: 'GET',
        route: '/bad-request',
        statusCode: 500,
        duration: 'invalid-duration',
        requestSize: 'invalid-size',
        responseSize: 'invalid-size',
      })
    ).not.toThrow();

    expect(() =>
      metricsService.recordLlmRequest({
        provider: 'anthropic',
        model: 'opus',
        status: 'error',
        duration: 'invalid-duration',
        tokens: { input: 'bad', output: 'bad' },
      })
    ).not.toThrow();

    expect(() =>
      metricsService.recordHealthCheck({
        checkType: 'liveness',
        result: 'failure',
        duration: 'invalid-duration',
      })
    ).not.toThrow();

    // Simulate counter/gauge failures to exercise catch branches
    const originalCacheSizeSet = metricsService.cacheSize.set;
    metricsService.cacheSize.set = () => {
      throw new Error('cache size failure');
    };
    expect(() =>
      metricsService.recordCacheOperation({
        operation: 'set',
        result: 'success',
        cacheType: 'api-key',
        size: 2,
        memoryUsage: 8192,
      })
    ).not.toThrow();
    metricsService.cacheSize.set = originalCacheSizeSet;

    const originalRateLimitInc = metricsService.rateLimitHits.inc;
    metricsService.rateLimitHits.inc = () => {
      throw new Error('rate limit counter failure');
    };
    expect(() =>
      metricsService.recordRateLimiting({
        limitType: 'auth',
        clientType: 'ip',
        patternType: 'burst',
        severity: 'medium',
        mapSize: 7,
      })
    ).not.toThrow();
    metricsService.rateLimitHits.inc = originalRateLimitInc;

    const originalSecurityInc = metricsService.securityValidationResults.inc;
    metricsService.securityValidationResults.inc = () => {
      throw new Error('security counter failure');
    };
    expect(() =>
      metricsService.recordSecurityValidation({
        result: 'fail',
        validationType: 'headers',
        incidentType: 'spoof',
        severity: 'high',
      })
    ).not.toThrow();
    metricsService.securityValidationResults.inc = originalSecurityInc;

    const originalApiKeyInc = metricsService.apiKeyOperations.inc;
    metricsService.apiKeyOperations.inc = () => {
      throw new Error('api key counter failure');
    };
    expect(() =>
      metricsService.recordApiKeyOperation({
        operation: 'store',
        result: 'error',
        keySource: 'payload',
      })
    ).not.toThrow();
    metricsService.apiKeyOperations.inc = originalApiKeyInc;

    const originalHealthInc = metricsService.healthCheckResults.inc;
    metricsService.healthCheckResults.inc = () => {
      throw new Error('health counter failure');
    };
    expect(() =>
      metricsService.recordHealthCheck({
        checkType: 'diagnostics',
        result: 'failure',
        duration: 0.25,
      })
    ).not.toThrow();
    metricsService.healthCheckResults.inc = originalHealthInc;

    const originalErrorInc = metricsService.errorsTotal.inc;
    metricsService.errorsTotal.inc = () => {
      throw new Error('error counter failure');
    };
    expect(() =>
      metricsService.recordError({
        errorType: 'timeout',
        component: 'metrics-service',
        severity: 'critical',
      })
    ).not.toThrow();
    metricsService.errorsTotal.inc = originalErrorInc;

    const resetSpy = jest
      .spyOn(register, 'resetMetrics')
      .mockImplementation(() => {
        throw new Error('reset failure');
      });
    expect(() => metricsService.reset()).not.toThrow();
    resetSpy.mockRestore();

    const clearSpy = jest.spyOn(register, 'clear').mockImplementation(() => {
      throw new Error('clear failure');
    });
    expect(() => metricsService.clear()).not.toThrow();
    clearSpy.mockRestore();

    const metricsSpy = jest
      .spyOn(register, 'metrics')
      .mockImplementation(() => {
        throw new Error('metrics failure');
      });
    await expect(metricsService.getMetrics()).rejects.toThrow(
      'metrics failure'
    );
    metricsSpy.mockRestore();

    const statsSpy = jest
      .spyOn(register, 'getMetricsAsJSON')
      .mockImplementation(() => {
        throw new Error('stats failure');
      });
    expect(metricsService.getStats()).toEqual({
      enabled: true,
      error: 'stats failure',
    });
    statsSpy.mockRestore();
  });
});
