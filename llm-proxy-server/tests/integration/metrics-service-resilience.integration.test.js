/**
 * @file metrics-service-resilience.integration.test.js
 * @description Integration tests focused on MetricsService resilience when collaborating with middleware
 *              and other services, ensuring error handling paths receive coverage.
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

/**
 * @returns {import('../../src/interfaces/coreServices.js').ILogger}
 */
function createLogger() {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  logger.isDebugEnabled = true;
  return logger;
}

describe('MetricsService resilience integration coverage', () => {
  let logger;

  beforeEach(() => {
    logger = createLogger();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns sentinel outputs and bypasses collectors when disabled', async () => {
    const service = new MetricsService({
      logger,
      enabled: false,
      collectDefaultMetrics: false,
    });

    expect(service.isEnabled()).toBe(false);

    // Ensure recorders silently no-op when disabled.
    service.recordHttpRequest({
      method: 'GET',
      route: '/disabled',
      statusCode: 200,
      duration: 0.05,
      requestSize: 128,
      responseSize: 256,
    });
    service.recordError({
      errorType: 'test',
      component: 'disabled',
      severity: 'low',
    });

    const metricsOutput = await service.getMetrics();
    expect(metricsOutput).toBe('# Metrics collection is disabled\n');
    expect(service.getStats()).toEqual({ enabled: false });

    service.clear();
  });

  it('continues serving requests and logs when collectors throw runtime errors', async () => {
    const service = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });

    const restoreSpies = [];

    const wrapToThrow = (target, methodName, label) => {
      const spy = jest.spyOn(target, methodName).mockImplementation(() => {
        throw new Error(label);
      });
      restoreSpies.push(spy);
    };

    wrapToThrow(
      service.httpRequestDuration,
      'observe',
      'http-request-duration'
    );
    wrapToThrow(service.llmRequestDuration, 'observe', 'llm-request-duration');
    wrapToThrow(service.cacheOperationsTotal, 'inc', 'cache-operations-total');
    wrapToThrow(service.rateLimitHits, 'inc', 'rate-limit-hits');
    wrapToThrow(
      service.securityValidationResults,
      'inc',
      'security-validation'
    );
    wrapToThrow(service.apiKeyOperations, 'inc', 'api-key-operations');
    wrapToThrow(service.healthCheckResults, 'inc', 'health-check-results');
    wrapToThrow(service.errorsTotal, 'inc', 'errors-total');

    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.correlationId = 'metrics-resilience-suite';
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
      '/llm-resilience',
      createLlmMetricsMiddleware({ metricsService: service, logger }),
      (req, res) => {
        const cacheRecorder = createCacheMetricsRecorder({
          metricsService: service,
          cacheType: 'api-key',
        });

        // Trigger cache recorder paths (the first call will throw and be caught).
        cacheRecorder.recordOperation('set', 'success', {
          size: 1,
          memoryUsage: 1024,
        });
        cacheRecorder.recordStats(2, 2048);

        // Exercise additional recorders that share the service instance.
        service.recordRateLimiting({
          limitType: 'adaptive',
          clientType: 'ip',
          patternType: 'burst',
          severity: 'high',
          mapSize: 3,
        });
        service.recordSecurityValidation({
          result: 'fail',
          validationType: 'headers',
          incidentType: 'missing-header',
          severity: 'medium',
        });
        service.recordApiKeyOperation({
          operation: 'retrieve',
          result: 'error',
          keySource: 'env',
        });
        service.recordHealthCheck({
          checkType: 'readiness',
          result: 'failure',
          duration: 0.2,
        });
        service.recordError({
          errorType: 'integration',
          component: 'middleware',
          severity: 'high',
        });

        res.status(500).json({
          usage: { prompt_tokens: 5, completion_tokens: 2 },
        });
      }
    );

    const response = await request(app)
      .post('/llm-resilience')
      .send({ llmId: 'openai-gpt-4' });

    expect(response.status).toBe(500);

    // Allow async finish handlers to record metrics and hit error branches.
    await new Promise((resolve) => setImmediate(resolve));

    expect(logger.error).toHaveBeenCalledWith(
      'Error recording HTTP request metrics',
      expect.any(Error)
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Error recording LLM request metrics',
      expect.any(Error)
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Error recording cache operation metrics',
      expect.any(Error)
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Error recording rate limiting metrics',
      expect.any(Error)
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Error recording security validation metrics',
      expect.any(Error)
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Error recording API key operation metrics',
      expect.any(Error)
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Error recording health check metrics',
      expect.any(Error)
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Error recording error metrics',
      expect.any(Error)
    );

    // Exercise reset() and clear() error paths by temporarily forcing registry failures.
    const registry = service.getRegistry();
    const resetSpy = jest
      .spyOn(registry, 'resetMetrics')
      .mockImplementation(() => {
        throw new Error('reset-failure');
      });
    const clearSpy = jest.spyOn(registry, 'clear').mockImplementation(() => {
      throw new Error('clear-failure');
    });

    service.reset();
    service.clear();

    expect(logger.error).toHaveBeenCalledWith(
      'Error resetting metrics',
      expect.any(Error)
    );
    expect(logger.error).toHaveBeenCalledWith(
      'Error clearing metrics',
      expect.any(Error)
    );

    resetSpy.mockRestore();
    clearSpy.mockRestore();

    restoreSpies.forEach((spy) => spy.mockRestore());

    const stats = service.getStats();
    expect(stats.enabled).toBe(true);
    expect(stats.totalMetrics).toBeGreaterThanOrEqual(0);
    expect(stats.customMetrics).toBeGreaterThanOrEqual(0);

    service.clear();
  });
});
