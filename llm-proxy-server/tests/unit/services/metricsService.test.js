/**
 * @file Unit tests for MetricsService
 * @description Tests for Prometheus metrics collection and management
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import MetricsService from '../../../src/services/metricsService.js';

describe('MetricsService', () => {
  let mockLogger;
  let metricsService;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Create a fresh metrics service for each test
    metricsService = new MetricsService({
      logger: mockLogger,
      enabled: true,
      collectDefaultMetrics: false, // Disable for cleaner testing
    });
  });

  afterEach(() => {
    if (metricsService) {
      metricsService.clear();
    }
    jest.clearAllMocks();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with default options', () => {
      const service = new MetricsService();
      expect(service.isEnabled()).toBe(true);
    });

    it('should respect enabled: false option', () => {
      const service = new MetricsService({ enabled: false });
      expect(service.isEnabled()).toBe(false);
    });

    it('should initialize custom metrics when enabled', () => {
      expect(metricsService.isEnabled()).toBe(true);
      expect(metricsService.httpRequestsTotal).toBeDefined();
      expect(metricsService.llmRequestsTotal).toBeDefined();
      expect(metricsService.cacheOperationsTotal).toBeDefined();
    });

    it('should log initialization message', () => {
      new MetricsService({ logger: mockLogger, enabled: true });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Metrics service initialized',
        expect.objectContaining({
          defaultMetrics: expect.any(Boolean),
          customMetrics: true,
        })
      );
    });

    it('should log disabled message when metrics are disabled', () => {
      new MetricsService({ logger: mockLogger, enabled: false });
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Metrics collection is disabled'
      );
    });

    it('should collect default metrics when enabled', () => {
      const service = new MetricsService({
        logger: mockLogger,
        enabled: true,
        collectDefaultMetrics: true,
        defaultMetricsInterval: 5000,
      });

      expect(service.isEnabled()).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Metrics service initialized',
        expect.objectContaining({
          defaultMetrics: true,
          customMetrics: true,
        })
      );
    });
  });

  describe('HTTP Request Metrics', () => {
    it('should record HTTP request metrics correctly', () => {
      const data = {
        method: 'POST',
        route: '/api/llm-request',
        statusCode: 200,
        duration: 1.5,
        requestSize: 1024,
        responseSize: 2048,
      };

      expect(() => {
        metricsService.recordHttpRequest(data);
      }).not.toThrow();

      // Verify metrics were recorded (we can't easily check values without accessing internals)
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle missing optional fields in HTTP request metrics', () => {
      const data = {
        method: 'GET',
        route: '/health',
        statusCode: 200,
        duration: 0.1,
        // Missing requestSize and responseSize
      };

      expect(() => {
        metricsService.recordHttpRequest(data);
      }).not.toThrow();
    });

    it('should handle invalid data gracefully', () => {
      const invalidData = {
        method: null,
        route: undefined,
        statusCode: 'not-a-number',
        duration: -1,
      };

      expect(() => {
        metricsService.recordHttpRequest(invalidData);
      }).not.toThrow();
    });

    it('should not record metrics when disabled', () => {
      const disabledService = new MetricsService({
        enabled: false,
        logger: mockLogger,
      });

      expect(() => {
        disabledService.recordHttpRequest({
          method: 'POST',
          route: '/test',
          statusCode: 200,
          duration: 1.0,
        });
      }).not.toThrow();
    });

    it('should skip recording request size when zero or negative', () => {
      const data = {
        method: 'POST',
        route: '/test',
        statusCode: 200,
        duration: 1.0,
        requestSize: 0,
        responseSize: 1024,
      };

      expect(() => {
        metricsService.recordHttpRequest(data);
      }).not.toThrow();
    });

    it('should skip recording response size when zero or negative', () => {
      const data = {
        method: 'POST',
        route: '/test',
        statusCode: 200,
        duration: 1.0,
        requestSize: 1024,
        responseSize: -100,
      };

      expect(() => {
        metricsService.recordHttpRequest(data);
      }).not.toThrow();
    });

    it('should handle non-numeric sizes gracefully', () => {
      const data = {
        method: 'POST',
        route: '/test',
        statusCode: 200,
        duration: 1.0,
        requestSize: 'not-a-number',
        responseSize: null,
      };

      expect(() => {
        metricsService.recordHttpRequest(data);
      }).not.toThrow();
    });
  });

  describe('LLM Request Metrics', () => {
    it('should record LLM request metrics correctly', () => {
      const data = {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        status: 'success',
        duration: 2.5,
        tokens: {
          input: 100,
          output: 150,
        },
      };

      expect(() => {
        metricsService.recordLlmRequest(data);
      }).not.toThrow();
    });

    it('should handle missing token information', () => {
      const data = {
        provider: 'anthropic',
        model: 'claude-3-haiku',
        status: 'error',
        duration: 0.5,
        // Missing tokens
      };

      expect(() => {
        metricsService.recordLlmRequest(data);
      }).not.toThrow();
    });

    it('should record different token types correctly', () => {
      const data = {
        provider: 'openai',
        model: 'gpt-4',
        status: 'success',
        duration: 5.0,
        tokens: {
          input: 200,
          output: 0, // Zero output tokens
        },
      };

      expect(() => {
        metricsService.recordLlmRequest(data);
      }).not.toThrow();
    });

    it('should not record tokens when disabled', () => {
      const disabledService = new MetricsService({
        enabled: false,
        logger: mockLogger,
      });

      expect(() => {
        disabledService.recordLlmRequest({
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          status: 'success',
          duration: 2.5,
          tokens: {
            input: 100,
            output: 150,
          },
        });
      }).not.toThrow();
    });

    it('should handle negative token values gracefully', () => {
      const data = {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        status: 'success',
        duration: 2.5,
        tokens: {
          input: -100, // Negative input tokens
          output: -150, // Negative output tokens
        },
      };

      expect(() => {
        metricsService.recordLlmRequest(data);
      }).not.toThrow();
    });

    it('should handle non-numeric token values', () => {
      const data = {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        status: 'success',
        duration: 2.5,
        tokens: {
          input: 'not-a-number',
          output: null,
        },
      };

      expect(() => {
        metricsService.recordLlmRequest(data);
      }).not.toThrow();
    });
  });

  describe('Cache Operation Metrics', () => {
    it('should record cache operations correctly', () => {
      const data = {
        operation: 'get',
        result: 'hit',
        cacheType: 'api_key',
        size: 50,
        memoryUsage: 1024000,
      };

      expect(() => {
        metricsService.recordCacheOperation(data);
      }).not.toThrow();
    });

    it('should handle different cache operations', () => {
      const operations = [
        { operation: 'set', result: 'success' },
        { operation: 'delete', result: 'success' },
        { operation: 'clear', result: 'success' },
        { operation: 'get', result: 'miss' },
      ];

      operations.forEach((op) => {
        expect(() => {
          metricsService.recordCacheOperation(op);
        }).not.toThrow();
      });
    });

    it('should handle missing cacheType gracefully', () => {
      const data = {
        operation: 'get',
        result: 'hit',
        // Missing cacheType, size, and memoryUsage
      };

      expect(() => {
        metricsService.recordCacheOperation(data);
      }).not.toThrow();
    });

    it('should handle non-numeric size and memory usage', () => {
      const data = {
        operation: 'get',
        result: 'hit',
        cacheType: 'api_key',
        size: 'not-a-number',
        memoryUsage: null,
      };

      expect(() => {
        metricsService.recordCacheOperation(data);
      }).not.toThrow();
    });

    it('should not record cache metrics when disabled', () => {
      const disabledService = new MetricsService({
        enabled: false,
        logger: mockLogger,
      });

      expect(() => {
        disabledService.recordCacheOperation({
          operation: 'get',
          result: 'hit',
          cacheType: 'api_key',
          size: 50,
          memoryUsage: 1024000,
        });
      }).not.toThrow();
    });
  });

  describe('Rate Limiting Metrics', () => {
    it('should record rate limiting metrics correctly', () => {
      const data = {
        limitType: 'llm',
        clientType: 'ip',
        patternType: 'rapid_requests',
        severity: 'medium',
        mapSize: 100,
      };

      expect(() => {
        metricsService.recordRateLimiting(data);
      }).not.toThrow();
    });

    it('should handle partial rate limiting data', () => {
      const data = {
        limitType: 'general',
        clientType: 'api_key',
        // Missing pattern and severity
      };

      expect(() => {
        metricsService.recordRateLimiting(data);
      }).not.toThrow();
    });

    it('should handle missing limitType or clientType', () => {
      const data = {
        patternType: 'rapid_requests',
        severity: 'high',
        mapSize: 50,
      };

      expect(() => {
        metricsService.recordRateLimiting(data);
      }).not.toThrow();
    });

    it('should handle missing patternType or severity', () => {
      const data = {
        limitType: 'llm',
        clientType: 'ip',
        mapSize: 75,
      };

      expect(() => {
        metricsService.recordRateLimiting(data);
      }).not.toThrow();
    });

    it('should handle non-numeric mapSize', () => {
      const data = {
        limitType: 'llm',
        clientType: 'ip',
        mapSize: 'not-a-number',
      };

      expect(() => {
        metricsService.recordRateLimiting(data);
      }).not.toThrow();
    });

    it('should not record rate limiting metrics when disabled', () => {
      const disabledService = new MetricsService({
        enabled: false,
        logger: mockLogger,
      });

      expect(() => {
        disabledService.recordRateLimiting({
          limitType: 'llm',
          clientType: 'ip',
          patternType: 'rapid_requests',
          severity: 'medium',
          mapSize: 100,
        });
      }).not.toThrow();
    });
  });

  describe('Security Validation Metrics', () => {
    it('should record security validation results', () => {
      const data = {
        result: 'pass',
        validationType: 'headers',
        incidentType: 'xss_attempt',
        severity: 'high',
      };

      expect(() => {
        metricsService.recordSecurityValidation(data);
      }).not.toThrow();
    });

    it('should handle different validation results', () => {
      const validations = [
        { result: 'pass', validationType: 'csp' },
        { result: 'fail', validationType: 'ip' },
        { result: 'warning', validationType: 'headers' },
      ];

      validations.forEach((validation) => {
        expect(() => {
          metricsService.recordSecurityValidation(validation);
        }).not.toThrow();
      });
    });

    it('should handle missing result or validationType', () => {
      const data = {
        incidentType: 'sql_injection',
        severity: 'critical',
      };

      expect(() => {
        metricsService.recordSecurityValidation(data);
      }).not.toThrow();
    });

    it('should handle missing incidentType or severity', () => {
      const data = {
        result: 'fail',
        validationType: 'input',
      };

      expect(() => {
        metricsService.recordSecurityValidation(data);
      }).not.toThrow();
    });

    it('should not record security metrics when disabled', () => {
      const disabledService = new MetricsService({
        enabled: false,
        logger: mockLogger,
      });

      expect(() => {
        disabledService.recordSecurityValidation({
          result: 'pass',
          validationType: 'headers',
          incidentType: 'xss_attempt',
          severity: 'high',
        });
      }).not.toThrow();
    });
  });

  describe('API Key Operation Metrics', () => {
    it('should record API key operations correctly', () => {
      const data = {
        operation: 'retrieve',
        result: 'success',
        keySource: 'file',
      };

      expect(() => {
        metricsService.recordApiKeyOperation(data);
      }).not.toThrow();
    });

    it('should handle different key sources', () => {
      const sources = ['file', 'env', 'cache'];

      sources.forEach((source) => {
        expect(() => {
          metricsService.recordApiKeyOperation({
            operation: 'retrieve',
            result: 'success',
            keySource: source,
          });
        }).not.toThrow();
      });
    });

    it('should handle missing fields in API key operation', () => {
      const data = {
        // All fields missing
      };

      expect(() => {
        metricsService.recordApiKeyOperation(data);
      }).not.toThrow();
    });

    it('should handle partial API key operation data', () => {
      const data = {
        operation: 'cache_hit',
        // Missing result and keySource
      };

      expect(() => {
        metricsService.recordApiKeyOperation(data);
      }).not.toThrow();
    });

    it('should not record API key metrics when disabled', () => {
      const disabledService = new MetricsService({
        enabled: false,
        logger: mockLogger,
      });

      expect(() => {
        disabledService.recordApiKeyOperation({
          operation: 'retrieve',
          result: 'success',
          keySource: 'file',
        });
      }).not.toThrow();
    });
  });

  describe('Health Check Metrics', () => {
    it('should record health check metrics correctly', () => {
      const data = {
        checkType: 'liveness',
        result: 'success',
        duration: 0.05,
      };

      expect(() => {
        metricsService.recordHealthCheck(data);
      }).not.toThrow();
    });

    it('should handle different check types', () => {
      const checks = [
        { checkType: 'liveness', result: 'success', duration: 0.01 },
        { checkType: 'readiness', result: 'failure', duration: 0.02 },
      ];

      checks.forEach((check) => {
        expect(() => {
          metricsService.recordHealthCheck(check);
        }).not.toThrow();
      });
    });

    it('should handle missing checkType or result', () => {
      const data = {
        duration: 0.03,
      };

      expect(() => {
        metricsService.recordHealthCheck(data);
      }).not.toThrow();
    });

    it('should handle missing duration', () => {
      const data = {
        checkType: 'liveness',
        result: 'success',
        // Missing duration
      };

      expect(() => {
        metricsService.recordHealthCheck(data);
      }).not.toThrow();
    });

    it('should handle non-numeric duration', () => {
      const data = {
        checkType: 'readiness',
        result: 'success',
        duration: 'not-a-number',
      };

      expect(() => {
        metricsService.recordHealthCheck(data);
      }).not.toThrow();
    });

    it('should not record health check metrics when disabled', () => {
      const disabledService = new MetricsService({
        enabled: false,
        logger: mockLogger,
      });

      expect(() => {
        disabledService.recordHealthCheck({
          checkType: 'liveness',
          result: 'success',
          duration: 0.05,
        });
      }).not.toThrow();
    });
  });

  describe('Error Metrics', () => {
    it('should record error metrics correctly', () => {
      const data = {
        errorType: 'validation',
        component: 'middleware',
        severity: 'medium',
      };

      expect(() => {
        metricsService.recordError(data);
      }).not.toThrow();
    });

    it('should handle different error types and severities', () => {
      const errors = [
        { errorType: 'network', component: 'llm_service', severity: 'high' },
        { errorType: 'timeout', component: 'http_client', severity: 'medium' },
        { errorType: 'parsing', component: 'validation', severity: 'low' },
      ];

      errors.forEach((error) => {
        expect(() => {
          metricsService.recordError(error);
        }).not.toThrow();
      });
    });

    it('should handle missing fields in error data', () => {
      const data = {
        // All fields missing
      };

      expect(() => {
        metricsService.recordError(data);
      }).not.toThrow();
    });

    it('should handle partial error data', () => {
      const data = {
        errorType: 'network',
        // Missing component and severity
      };

      expect(() => {
        metricsService.recordError(data);
      }).not.toThrow();
    });

    it('should not record error metrics when disabled', () => {
      const disabledService = new MetricsService({
        enabled: false,
        logger: mockLogger,
      });

      expect(() => {
        disabledService.recordError({
          errorType: 'validation',
          component: 'middleware',
          severity: 'medium',
        });
      }).not.toThrow();
    });
  });

  describe('Metrics Retrieval and Management', () => {
    it('should return metrics in Prometheus format', async () => {
      // Record some metrics first
      metricsService.recordHttpRequest({
        method: 'GET',
        route: '/health',
        statusCode: 200,
        duration: 0.1,
      });

      const metrics = await metricsService.getMetrics();
      expect(typeof metrics).toBe('string');
      expect(metrics).toContain('llm_proxy_http_requests_total');
    });

    it('should return disabled message when metrics are disabled', async () => {
      const disabledService = new MetricsService({ enabled: false });
      const metrics = await disabledService.getMetrics();
      expect(metrics).toBe('# Metrics collection is disabled\n');
    });

    it('should provide registry access', () => {
      const registry = metricsService.getRegistry();
      expect(registry).toBeDefined();
      expect(typeof registry.metrics).toBe('function');
    });

    it('should reset metrics correctly', () => {
      // Record some metrics
      metricsService.recordHttpRequest({
        method: 'POST',
        route: '/api/test',
        statusCode: 200,
        duration: 1.0,
      });

      expect(() => {
        metricsService.reset();
      }).not.toThrow();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Metrics reset successfully'
      );
    });

    it('should clear metrics correctly', () => {
      expect(() => {
        metricsService.clear();
      }).not.toThrow();

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Metrics cleared successfully'
      );
    });

    it('should return correct stats', () => {
      const stats = metricsService.getStats();
      expect(stats).toEqual(
        expect.objectContaining({
          enabled: true,
          totalMetrics: expect.any(Number),
          customMetrics: expect.any(Number),
          defaultMetrics: expect.any(Number),
        })
      );
    });

    it('should return disabled stats when metrics are disabled', () => {
      const disabledService = new MetricsService({ enabled: false });
      const stats = disabledService.getStats();
      expect(stats).toEqual({ enabled: false });
    });
  });

  describe('Error Handling', () => {
    it('should handle errors in recordHttpRequest gracefully', () => {
      // Force an error by corrupting the metric
      metricsService.httpRequestsTotal = null;

      expect(() => {
        metricsService.recordHttpRequest({
          method: 'POST',
          route: '/test',
          statusCode: 200,
          duration: 1.0,
        });
      }).not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error recording HTTP request metrics',
        expect.any(Error)
      );
    });

    it('should handle errors in recordLlmRequest gracefully', () => {
      // Force an error by corrupting the metric
      metricsService.llmRequestsTotal = null;

      expect(() => {
        metricsService.recordLlmRequest({
          provider: 'openai',
          model: 'gpt-3.5-turbo',
          status: 'success',
          duration: 2.5,
          tokens: {
            input: 100,
            output: 150,
          },
        });
      }).not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error recording LLM request metrics',
        expect.any(Error)
      );
    });

    it('should handle errors in recordCacheOperation gracefully', () => {
      // Force an error by corrupting the metric
      metricsService.cacheOperationsTotal = null;

      expect(() => {
        metricsService.recordCacheOperation({
          operation: 'get',
          result: 'hit',
          cacheType: 'api_key',
          size: 50,
          memoryUsage: 1024000,
        });
      }).not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error recording cache operation metrics',
        expect.any(Error)
      );
    });

    it('should handle errors in recordRateLimiting gracefully', () => {
      // Force an error by corrupting the metric
      metricsService.rateLimitHits = null;

      expect(() => {
        metricsService.recordRateLimiting({
          limitType: 'llm',
          clientType: 'ip',
          patternType: 'rapid_requests',
          severity: 'medium',
          mapSize: 100,
        });
      }).not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error recording rate limiting metrics',
        expect.any(Error)
      );
    });

    it('should handle errors in recordSecurityValidation gracefully', () => {
      // Force an error by corrupting the metric
      metricsService.securityValidationResults = null;

      expect(() => {
        metricsService.recordSecurityValidation({
          result: 'pass',
          validationType: 'headers',
          incidentType: 'xss_attempt',
          severity: 'high',
        });
      }).not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error recording security validation metrics',
        expect.any(Error)
      );
    });

    it('should handle errors in recordApiKeyOperation gracefully', () => {
      // Force an error by corrupting the metric
      metricsService.apiKeyOperations = null;

      expect(() => {
        metricsService.recordApiKeyOperation({
          operation: 'retrieve',
          result: 'success',
          keySource: 'file',
        });
      }).not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error recording API key operation metrics',
        expect.any(Error)
      );
    });

    it('should handle errors in recordHealthCheck gracefully', () => {
      // Force an error by corrupting the metric
      metricsService.healthCheckResults = null;

      expect(() => {
        metricsService.recordHealthCheck({
          checkType: 'liveness',
          result: 'success',
          duration: 0.05,
        });
      }).not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error recording health check metrics',
        expect.any(Error)
      );
    });

    it('should handle errors in recordError gracefully', () => {
      // Force an error by corrupting the metric
      metricsService.errorsTotal = null;

      expect(() => {
        metricsService.recordError({
          errorType: 'validation',
          component: 'middleware',
          severity: 'medium',
        });
      }).not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error recording error metrics',
        expect.any(Error)
      );
    });

    it('should handle errors in reset() gracefully', () => {
      // Mock the registry to throw an error
      const originalResetMetrics = metricsService.getRegistry().resetMetrics;
      metricsService.getRegistry().resetMetrics = jest
        .fn()
        .mockImplementation(() => {
          throw new Error('Test reset error');
        });

      expect(() => {
        metricsService.reset();
      }).not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error resetting metrics',
        expect.any(Error)
      );

      // Restore original method
      metricsService.getRegistry().resetMetrics = originalResetMetrics;
    });

    it('should handle errors in clear() gracefully', () => {
      // Mock the registry to throw an error
      const originalClear = metricsService.getRegistry().clear;
      metricsService.getRegistry().clear = jest.fn().mockImplementation(() => {
        throw new Error('Test clear error');
      });

      expect(() => {
        metricsService.clear();
      }).not.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error clearing metrics',
        expect.any(Error)
      );

      // Restore original method
      metricsService.getRegistry().clear = originalClear;
    });

    it('should not attempt reset when metrics are disabled', () => {
      const disabledService = new MetricsService({
        enabled: false,
        logger: mockLogger,
      });

      const spy = jest.spyOn(disabledService.getRegistry(), 'resetMetrics');

      disabledService.reset();

      expect(spy).not.toHaveBeenCalled();
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should handle errors in getMetrics gracefully', async () => {
      // Mock the registry to throw an error
      const originalMetrics = metricsService.getRegistry().metrics;
      metricsService.getRegistry().metrics = jest
        .fn()
        .mockRejectedValue(new Error('Test error'));

      await expect(metricsService.getMetrics()).rejects.toThrow('Test error');
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error getting metrics',
        expect.any(Error)
      );

      // Restore original method
      metricsService.getRegistry().metrics = originalMetrics;
    });

    it('should handle errors in getStats gracefully', () => {
      // Mock the registry to throw an error
      const originalGetMetricsAsJSON =
        metricsService.getRegistry().getMetricsAsJSON;
      metricsService.getRegistry().getMetricsAsJSON = jest
        .fn()
        .mockImplementation(() => {
          throw new Error('Test stats error');
        });

      const stats = metricsService.getStats();
      expect(stats).toEqual({
        enabled: true,
        error: 'Test stats error',
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error getting metrics stats',
        expect.any(Error)
      );

      // Restore original method
      metricsService.getRegistry().getMetricsAsJSON = originalGetMetricsAsJSON;
    });

    it('should handle non-array return from getMetricsAsJSON in getStats', () => {
      // Mock the registry to return null
      const originalGetMetricsAsJSON =
        metricsService.getRegistry().getMetricsAsJSON;
      metricsService.getRegistry().getMetricsAsJSON = jest
        .fn()
        .mockReturnValue(null);

      const stats = metricsService.getStats();
      expect(stats).toEqual({
        enabled: true,
        totalMetrics: 0,
        customMetrics: 0,
        defaultMetrics: 0,
      });

      // Restore original method
      metricsService.getRegistry().getMetricsAsJSON = originalGetMetricsAsJSON;
    });

    it('should handle undefined return from getMetricsAsJSON in getStats', () => {
      // Mock the registry to return undefined
      const originalGetMetricsAsJSON =
        metricsService.getRegistry().getMetricsAsJSON;
      metricsService.getRegistry().getMetricsAsJSON = jest
        .fn()
        .mockReturnValue(undefined);

      const stats = metricsService.getStats();
      expect(stats).toEqual({
        enabled: true,
        totalMetrics: 0,
        customMetrics: 0,
        defaultMetrics: 0,
      });

      // Restore original method
      metricsService.getRegistry().getMetricsAsJSON = originalGetMetricsAsJSON;
    });

    it('should correctly filter custom and default metrics in getStats', () => {
      // Mock the registry to return metrics with specific names
      const originalGetMetricsAsJSON =
        metricsService.getRegistry().getMetricsAsJSON;
      metricsService.getRegistry().getMetricsAsJSON = jest
        .fn()
        .mockReturnValue([
          { name: 'llm_proxy_test_metric' },
          { name: 'llm_proxy_another_metric' },
          { name: 'nodejs_gc_duration_seconds' },
          { name: 'process_cpu_seconds_total' },
          { name: 'llm_proxy_custom_metric' },
        ]);

      const stats = metricsService.getStats();
      expect(stats).toEqual({
        enabled: true,
        totalMetrics: 5,
        customMetrics: 3, // Three metrics starting with 'llm_proxy_'
        defaultMetrics: 2, // Two metrics not starting with 'llm_proxy_'
      });

      // Restore original method
      metricsService.getRegistry().getMetricsAsJSON = originalGetMetricsAsJSON;
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle high frequency metric recording', () => {
      const startTime = performance.now();

      // Record many metrics quickly
      for (let i = 0; i < 1000; i++) {
        metricsService.recordHttpRequest({
          method: 'GET',
          route: '/test',
          statusCode: 200,
          duration: 0.001,
        });
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete quickly
      expect(duration).toBeLessThan(1000); // Less than 1 second
    });

    it('should handle concurrent metric recording', async () => {
      const promises = [];

      // Create concurrent metric recording operations
      for (let i = 0; i < 100; i++) {
        promises.push(
          Promise.resolve().then(() => {
            metricsService.recordHttpRequest({
              method: 'POST',
              route: `/test-${i}`,
              statusCode: 200,
              duration: Math.random(),
            });
          })
        );
      }

      // Should not throw any errors
      await expect(Promise.all(promises)).resolves.toBeDefined();
    });

    it('should handle mixed metric types concurrently', async () => {
      const operations = [
        () =>
          metricsService.recordHttpRequest({
            method: 'GET',
            route: '/test',
            statusCode: 200,
            duration: 0.1,
          }),
        () =>
          metricsService.recordLlmRequest({
            provider: 'openai',
            model: 'gpt-3.5',
            status: 'success',
            duration: 1.0,
          }),
        () =>
          metricsService.recordCacheOperation({
            operation: 'get',
            result: 'hit',
          }),
        () =>
          metricsService.recordSecurityValidation({
            result: 'pass',
            validationType: 'headers',
          }),
        () =>
          metricsService.recordError({
            errorType: 'test',
            component: 'test',
            severity: 'low',
          }),
      ];

      const promises = [];
      for (let i = 0; i < 50; i++) {
        const operation = operations[i % operations.length];
        promises.push(Promise.resolve().then(operation));
      }

      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });
});
