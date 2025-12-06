import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import express from 'express';
import request from 'supertest';
import MetricsService from '../../src/services/metricsService.js';
import { register } from 'prom-client';

const createTestLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const ORIGINAL_REGISTER_METHODS = {
  metrics: register.metrics,
  clear: register.clear,
  resetMetrics: register.resetMetrics,
  getMetricsAsJSON: register.getMetricsAsJSON,
};

describe('metrics service registry resilience integration', () => {
  let logger;
  let metricsService;

  beforeEach(() => {
    logger = createTestLogger();
    register.metrics = ORIGINAL_REGISTER_METHODS.metrics;
    register.clear = ORIGINAL_REGISTER_METHODS.clear;
    register.resetMetrics = ORIGINAL_REGISTER_METHODS.resetMetrics;
    register.getMetricsAsJSON = ORIGINAL_REGISTER_METHODS.getMetricsAsJSON;
    register.clear();
  });

  afterEach(() => {
    if (metricsService) {
      metricsService.clear();
      metricsService = null;
    }
    register.metrics = ORIGINAL_REGISTER_METHODS.metrics;
    register.clear = ORIGINAL_REGISTER_METHODS.clear;
    register.resetMetrics = ORIGINAL_REGISTER_METHODS.resetMetrics;
    register.getMetricsAsJSON = ORIGINAL_REGISTER_METHODS.getMetricsAsJSON;
    register.clear();
    jest.restoreAllMocks();
  });

  it('reports disabled metrics collection without touching the shared registry', async () => {
    metricsService = new MetricsService({
      logger,
      enabled: false,
    });

    const app = express();
    app.get('/metrics', async (_req, res) => {
      const metrics = await metricsService.getMetrics();
      res.status(200).send(metrics);
    });

    const response = await request(app).get('/metrics');
    expect(response.status).toBe(200);
    expect(response.text.trim()).toBe('# Metrics collection is disabled');

    metricsService.reset();
    expect(logger.debug).not.toHaveBeenCalled();
    expect(metricsService.isEnabled()).toBe(false);
  });

  it('records metrics across subsystems and logs registry failures without crashing', async () => {
    metricsService = new MetricsService({
      logger,
      collectDefaultMetrics: false,
    });

    metricsService.recordHttpRequest({
      method: 'POST',
      route: '/ingest',
      statusCode: 201,
      duration: 0.42,
      requestSize: 512,
      responseSize: 2048,
    });

    metricsService.recordLlmRequest({
      provider: 'openai',
      model: 'gpt-4o-mini',
      status: 'success',
      duration: 1.5,
      tokens: { input: 128, output: 64 },
    });

    metricsService.recordCacheOperation({
      operation: 'set',
      result: 'success',
      cacheType: 'general',
      size: 5,
      memoryUsage: 4096,
    });

    metricsService.recordRateLimiting({
      limitType: 'general',
      clientType: 'ip',
      patternType: 'burst',
      severity: 'high',
      mapSize: 7,
    });

    metricsService.recordSecurityValidation({
      result: 'fail',
      validationType: 'headers',
      incidentType: 'blocked-request',
      severity: 'medium',
    });

    metricsService.recordApiKeyOperation({
      operation: 'retrieve',
      result: 'success',
      keySource: 'file',
    });

    metricsService.recordHealthCheck({
      checkType: 'readiness',
      result: 'success',
      duration: 0.05,
    });

    metricsService.recordError({
      errorType: 'validation',
      component: 'middleware',
      severity: 'low',
    });

    const metricsSnapshot = await metricsService.getMetrics();
    expect(metricsSnapshot).toContain('llm_proxy_llm_requests_total');
    expect(metricsSnapshot).toContain('llm_proxy_rate_limit_hits_total');

    const metricsFailure = new Error('registry down');
    register.metrics = jest.fn(() => {
      throw metricsFailure;
    });
    await expect(metricsService.getMetrics()).rejects.toThrow('registry down');
    expect(logger.error).toHaveBeenCalledWith(
      'Error getting metrics',
      metricsFailure
    );
    logger.error.mockClear();

    const resetFailure = new Error('reset failed');
    register.resetMetrics = jest.fn(() => {
      throw resetFailure;
    });
    metricsService.reset();
    expect(logger.error).toHaveBeenCalledWith(
      'Error resetting metrics',
      resetFailure
    );
    logger.error.mockClear();
    register.resetMetrics = ORIGINAL_REGISTER_METHODS.resetMetrics;

    const clearFailure = new Error('clear failed');
    register.clear = jest.fn(() => {
      throw clearFailure;
    });
    metricsService.clear();
    expect(logger.error).toHaveBeenCalledWith(
      'Error clearing metrics',
      clearFailure
    );
    logger.error.mockClear();
    register.clear = ORIGINAL_REGISTER_METHODS.clear;
    metricsService.clear();

    const statsFailure = new Error('stats failed');
    register.getMetricsAsJSON = jest.fn(() => {
      throw statsFailure;
    });
    const statsResult = metricsService.getStats();
    expect(statsResult).toEqual({ enabled: true, error: 'stats failed' });
    expect(logger.error).toHaveBeenCalledWith(
      'Error getting metrics stats',
      statsFailure
    );
  });
});
