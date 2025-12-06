/**
 * @file metrics-service-advanced.integration.test.js
 * @description Integration tests exercising MetricsService in conjunction with
 *              rate limiting, security validation, API key management, and
 *              health check modules to provide near-complete coverage.
 */

import { describe, it, beforeEach, afterEach, expect } from '@jest/globals';
import express from 'express';
import request from 'supertest';

import MetricsService from '../../src/services/metricsService.js';
import { createMetricsMiddleware } from '../../src/middleware/metrics.js';
import { SuspiciousPatternsManager } from '../../src/middleware/rateLimiting.js';
import { SecurityValidationUtils } from '../../src/middleware/securityValidation.js';
import CacheService from '../../src/services/cacheService.js';
import {
  createLivenessCheck,
  createReadinessCheck,
} from '../../src/middleware/healthCheck.js';
import { createConsoleLogger } from '../../src/consoleLogger.js';

const createTestApp = ({
  metricsService,
  logger,
  cacheService,
  suspiciousPatternsManager,
}) => {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.correlationId = 'advanced-metrics-suite';
    next();
  });

  app.use(
    createMetricsMiddleware({
      metricsService,
      logger,
      enabled: metricsService.isEnabled(),
    })
  );

  app.use((req, _res, next) => {
    const validation = SecurityValidationUtils.validateSecurityHeaders(
      req.headers
    );

    metricsService.recordSecurityValidation({
      result: validation.isValid ? 'pass' : 'fail',
      validationType: 'headers',
      incidentType: validation.errors.length
        ? 'invalid_header'
        : validation.suspiciousPatterns.length
          ? 'suspicious_pattern'
          : undefined,
      severity: validation.errors.length
        ? 'high'
        : validation.suspiciousPatterns.length
          ? 'medium'
          : 'low',
    });

    next();
  });

  const trackAdaptiveRateLimiting = (req, res, next) => {
    const clientKey = `${req.ip}:${req.get('x-api-key') || 'anonymous'}`;
    const now = Date.now();
    const pattern = suspiciousPatternsManager.get(clientKey) || {
      requests: [],
      suspiciousScore: 0,
    };

    const recentRequests = pattern.requests.filter((ts) => now - ts < 1000);
    recentRequests.push(now);

    const updatedPattern = {
      ...pattern,
      requests: recentRequests,
      suspiciousScore:
        recentRequests.length > 3
          ? pattern.suspiciousScore + 2
          : Math.max(0, pattern.suspiciousScore - 1),
      updatedAt: now,
    };

    suspiciousPatternsManager.set(clientKey, updatedPattern);

    if (recentRequests.length > 4) {
      metricsService.recordRateLimiting({
        limitType: 'adaptive',
        clientType: 'ip',
        patternType: 'burst',
        severity: updatedPattern.suspiciousScore >= 4 ? 'high' : 'medium',
        mapSize: suspiciousPatternsManager.size(),
      });

      return res.status(429).json({
        error: 'rate limited',
        suspiciousScore: updatedPattern.suspiciousScore,
      });
    }

    return next();
  };

  app.get('/limited', trackAdaptiveRateLimiting, (_req, res) => {
    res.status(200).json({ ok: true });
  });

  const cacheMetricsRecorder = {
    recordCacheHit: (llmId) =>
      metricsService.recordCacheOperation({
        operation: 'get',
        result: 'hit',
        cacheType: 'api-key',
        size: cacheService.getSize(),
        memoryUsage: cacheService.getMemoryInfo().currentBytes,
      }),
    recordCacheMiss: (llmId) =>
      metricsService.recordCacheOperation({
        operation: 'get',
        result: 'miss',
        cacheType: 'api-key',
        size: cacheService.getSize(),
        memoryUsage: cacheService.getMemoryInfo().currentBytes,
      }),
  };

  app.post('/apikey', (req, res) => {
    const { llmId, key } = req.body;

    if (!llmId) {
      metricsService.recordApiKeyOperation({
        operation: 'store',
        result: 'error',
        keySource: 'payload',
      });
      return res.status(400).json({ error: 'llmId is required' });
    }

    if (key) {
      cacheService.set(llmId, key, 5000);
      metricsService.recordApiKeyOperation({
        operation: 'store',
        result: 'success',
        keySource: 'file',
      });
      metricsService.recordCacheOperation({
        operation: 'set',
        result: 'success',
        cacheType: 'api-key',
        size: cacheService.getSize(),
        memoryUsage: cacheService.getMemoryInfo().currentBytes,
      });
      return res.status(201).json({ stored: true });
    }

    metricsService.recordApiKeyOperation({
      operation: 'retrieve',
      result: 'not_found',
      keySource: 'file',
    });
    return res.status(404).json({ error: 'api key not provided' });
  });

  app.get('/apikey/:llmId', (req, res) => {
    const { llmId } = req.params;
    const cached = cacheService.get(llmId);

    if (cached) {
      cacheMetricsRecorder.recordCacheHit(llmId);
      metricsService.recordApiKeyOperation({
        operation: 'retrieve',
        result: 'success',
        keySource: 'cache',
      });
      return res.status(200).json({ llmId, apiKey: cached });
    }

    cacheMetricsRecorder.recordCacheMiss(llmId);
    metricsService.recordApiKeyOperation({
      operation: 'retrieve',
      result: 'not_found',
      keySource: 'cache',
    });
    return res.status(404).json({ error: 'not in cache' });
  });

  const wrapHealthCheck = (handler, checkType) => (req, res, next) => {
    const start = process.hrtime.bigint();
    res.on('finish', () => {
      const duration = Number(process.hrtime.bigint() - start) / 1e9;
      metricsService.recordHealthCheck({
        checkType,
        result:
          res.statusCode >= 200 && res.statusCode < 400 ? 'success' : 'failure',
        duration,
      });
    });
    return handler(req, res, next);
  };

  const healthyLlmConfigService = {
    isOperational: () => true,
    getInitializationErrorDetails: () => null,
    getLlmConfigs: () => ({
      configs: { 'openai:gpt-4o': {}, 'anthropic:opus': {} },
    }),
    getResolvedConfigPath: () => '/etc/llm/config.yaml',
  };

  const failingLlmConfigService = {
    isOperational: () => false,
    getInitializationErrorDetails: () => ({
      message: 'LLM config missing',
      stage: 'bootstrap',
    }),
    getLlmConfigs: () => ({ configs: {} }),
    getResolvedConfigPath: () => '/etc/llm/config.yaml',
  };

  const httpAgentService = {
    getAgent: () => ({ keepAlive: true }),
    cleanup: () => {},
    getStats: () => ({ activeAgents: 1, totalRequests: 0, memoryUsage: 0 }),
  };

  app.get(
    '/health/live',
    wrapHealthCheck(createLivenessCheck({ logger }), 'liveness')
  );

  app.get(
    '/health/ready',
    wrapHealthCheck(
      createReadinessCheck({
        logger,
        llmConfigService: healthyLlmConfigService,
        cacheService,
        httpAgentService,
      }),
      'readiness'
    )
  );

  app.get(
    '/health/ready/down',
    wrapHealthCheck(
      createReadinessCheck({
        logger,
        llmConfigService: failingLlmConfigService,
        cacheService: {
          set: () => {
            throw new Error('cache offline');
          },
          get: () => undefined,
          invalidate: () => {},
          getSize: () => 0,
        },
        httpAgentService: {
          getAgent: () => {
            throw new Error('agent unavailable');
          },
          cleanup: () => {},
        },
      }),
      'readiness'
    )
  );

  app.get('/metrics', async (_req, res) => {
    try {
      const metrics = await metricsService.getMetrics();
      res.status(200).send(metrics);
    } catch (error) {
      res.status(500).send(error.message);
    }
  });

  return app;
};

describe('MetricsService advanced integration', () => {
  let app;
  let metricsService;
  let logger;
  let cacheService;
  let suspiciousPatternsManager;

  beforeEach(() => {
    logger = createConsoleLogger();
    metricsService = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });
    cacheService = new CacheService(logger, {
      maxSize: 5,
      defaultTtl: 10000,
      enableAutoCleanup: false,
    });
    suspiciousPatternsManager = new SuspiciousPatternsManager({
      maxSize: 10,
      cleanupInterval: 25,
      minCleanupInterval: 1,
    });

    app = createTestApp({
      metricsService,
      logger,
      cacheService,
      suspiciousPatternsManager,
    });
  });

  afterEach(() => {
    if (metricsService) {
      metricsService.clear();
    }
    if (cacheService) {
      cacheService.cleanup();
    }
    if (suspiciousPatternsManager) {
      suspiciousPatternsManager.destroy();
    }
  });

  it('captures operational metrics across rate limiting, security, API key, and health flows', async () => {
    await request(app)
      .get('/limited')
      .set('x-content-type-options', 'nosniff')
      .set('x-frame-options', 'DENY')
      .set('x-xss-protection', '1; mode=block')
      .set(
        'strict-transport-security',
        'max-age=63072000; includeSubDomains; preload'
      )
      .expect(200);

    await request(app)
      .get('/limited')
      .set('content-security-policy', "script-src 'unsafe-inline'")
      .expect(200);

    await request(app)
      .get('/limited')
      .set('content-security-policy', "script-src 'unsafe-inline'")
      .expect(200);

    await request(app)
      .get('/limited')
      .set('content-security-policy', "script-src 'unsafe-inline'")
      .expect(200);

    await request(app)
      .get('/limited')
      .set('content-security-policy', "script-src 'unsafe-inline'")
      .expect(429);

    await request(app)
      .post('/apikey')
      .send({ llmId: 'openai:gpt-4o', key: 'sk-test-123456789' })
      .expect(201);

    await request(app).get('/apikey/openai:gpt-4o').expect(200);

    await request(app).get('/apikey/unknown-model').expect(404);

    await request(app).post('/apikey').send({}).expect(400);

    await request(app).get('/health/live').expect(200);
    await request(app).get('/health/ready').expect(200);
    await request(app).get('/health/ready/down').expect(503);

    const metricsResponse = await request(app).get('/metrics');
    expect(metricsResponse.status).toBe(200);
    expect(metricsResponse.text).toContain(
      'llm_proxy_rate_limit_hits_total{limit_type="adaptive",client_type="ip"} 1'
    );
    expect(metricsResponse.text).toContain(
      'llm_proxy_suspicious_patterns_detected_total{pattern_type="burst",severity="high"} 1'
    );
    expect(metricsResponse.text).toMatch(
      /llm_proxy_security_validation_results_total\{result="fail",validation_type="headers"\} [1-9]\d*/
    );
    expect(metricsResponse.text).toMatch(
      /llm_proxy_security_validation_results_total\{result="pass",validation_type="headers"\} [1-9]\d*/
    );
    expect(metricsResponse.text).toMatch(
      /llm_proxy_security_incidents_total\{incident_type="invalid_header",severity="high"\} [1-9]\d*/
    );
    expect(metricsResponse.text).toContain(
      'llm_proxy_api_key_operations_total{operation="retrieve",result="success",key_source="cache"} 1'
    );
    expect(metricsResponse.text).toContain(
      'llm_proxy_api_key_operations_total{operation="store",result="success",key_source="file"} 1'
    );
    expect(metricsResponse.text).toContain(
      'llm_proxy_api_key_operations_total{operation="retrieve",result="not_found",key_source="cache"} 1'
    );
    expect(metricsResponse.text).toContain(
      'llm_proxy_api_key_operations_total{operation="store",result="error",key_source="payload"} 1'
    );
    expect(metricsResponse.text).toContain(
      'llm_proxy_health_check_results_total{check_type="liveness",result="success"} 1'
    );
    expect(metricsResponse.text).toContain(
      'llm_proxy_health_check_results_total{check_type="readiness",result="success"} 1'
    );
    expect(metricsResponse.text).toContain(
      'llm_proxy_health_check_results_total{check_type="readiness",result="failure"} 1'
    );

    const stats = metricsService.getStats();
    expect(stats.enabled).toBe(true);
    expect(typeof stats.totalMetrics).toBe('number');
    expect(typeof stats.customMetrics).toBe('number');

    metricsService.reset();
    const resetMetrics = await metricsService.getMetrics();
    expect(resetMetrics).not.toContain(
      'llm_proxy_api_key_operations_total{operation="retrieve",result="success",key_source="cache"} 1'
    );

    const registry = metricsService.getRegistry();
    const originalMetricsFn = registry.metrics;
    registry.metrics = async () => {
      throw new Error('forced metrics failure');
    };
    await expect(metricsService.getMetrics()).rejects.toThrow(
      'forced metrics failure'
    );
    registry.metrics = originalMetricsFn;

    const originalGetMetricsAsJSON = registry.getMetricsAsJSON;
    registry.getMetricsAsJSON = () => {
      throw new Error('json failure');
    };
    const statsWithError = metricsService.getStats();
    expect(statsWithError).toEqual({ enabled: true, error: 'json failure' });
    registry.getMetricsAsJSON = originalGetMetricsAsJSON;

    metricsService.clear();
    const clearedMetrics = await metricsService.getMetrics();
    expect(typeof clearedMetrics).toBe('string');
  });
});
