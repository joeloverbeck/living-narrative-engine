/**
 * @file Unit tests for error handling configuration
 * @description Tests configuration loading, merging, and helper functions
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  errorHandlingConfig,
  getErrorConfig,
  getRetryConfig,
  getCircuitBreakerConfig,
  getFallbackValue,
  isRetriable,
  ErrorSeverity,
} from '../../../src/config/errorHandling.config.js';

// Mock environmentUtils
jest.mock('../../../src/utils/environmentUtils.js', () => ({
  getEnvironmentMode: jest.fn(),
}));

import { getEnvironmentMode } from '../../../src/utils/environmentUtils.js';

describe('Error Handling Configuration', () => {
  describe('Configuration Structure', () => {
    it('should have all required configuration sections', () => {
      expect(errorHandlingConfig).toHaveProperty('global');
      expect(errorHandlingConfig).toHaveProperty('retry');
      expect(errorHandlingConfig).toHaveProperty('circuitBreaker');
      expect(errorHandlingConfig).toHaveProperty('reporting');
      expect(errorHandlingConfig).toHaveProperty('fallback');
      expect(errorHandlingConfig).toHaveProperty('recovery');
      expect(errorHandlingConfig).toHaveProperty('performance');
      expect(errorHandlingConfig).toHaveProperty('environments');
    });

    it('should define ErrorSeverity constants', () => {
      expect(ErrorSeverity.CRITICAL).toBe('critical');
      expect(ErrorSeverity.ERROR).toBe('error');
      expect(ErrorSeverity.WARNING).toBe('warning');
      expect(ErrorSeverity.INFO).toBe('info');
    });

    it('should have valid retry configuration', () => {
      expect(errorHandlingConfig.retry.default).toMatchObject({
        maxAttempts: expect.any(Number),
        backoff: expect.objectContaining({
          type: expect.any(String),
          initialDelay: expect.any(Number),
        }),
        timeout: expect.any(Number),
      });
    });

    it('should have domain-specific overrides', () => {
      expect(errorHandlingConfig.retry.overrides).toHaveProperty(
        'ClothingError'
      );
      expect(errorHandlingConfig.retry.overrides).toHaveProperty(
        'AnatomyVisualizationError'
      );
      expect(errorHandlingConfig.retry.overrides).toHaveProperty(
        'LLMInteractionError'
      );
      expect(errorHandlingConfig.retry.overrides).toHaveProperty(
        'NetworkError'
      );
    });

    it('should define non-retriable error types', () => {
      expect(errorHandlingConfig.retry.nonRetriable).toContain(
        'ValidationError'
      );
      expect(errorHandlingConfig.retry.nonRetriable).toContain(
        'ConfigurationError'
      );
      expect(errorHandlingConfig.retry.nonRetriable).toContain(
        'AuthenticationError'
      );
    });
  });

  describe('getErrorConfig', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should return development configuration when in development mode', () => {
      getEnvironmentMode.mockReturnValue('development');

      const config = getErrorConfig();

      expect(config.global.includeStackTrace).toBe(true);
      expect(config.retry.default.maxAttempts).toBe(2); // Override from development
      expect(config.reporting.enabled).toBe(false);
    });

    it('should return test configuration when in test mode', () => {
      getEnvironmentMode.mockReturnValue('test');

      const config = getErrorConfig();

      expect(config.global.enabled).toBe(true);
      expect(config.retry.default.maxAttempts).toBe(1); // Override from test
      expect(config.circuitBreaker.default.failureThreshold).toBe(2); // Override from test
      expect(config.reporting.enabled).toBe(true); // Updated: test environment now enables reporting for testing
    });

    it('should return production configuration when in production mode', () => {
      getEnvironmentMode.mockReturnValue('production');

      const config = getErrorConfig();

      expect(config.global.includeStackTrace).toBe(false);
      expect(config.reporting.enabled).toBe(true);
      expect(config.fallback.useCache).toBe(true);
    });

    it('should merge environment config with base config', () => {
      getEnvironmentMode.mockReturnValue('development');

      const config = getErrorConfig();

      // Check that base config properties are preserved
      expect(config.global.correlationIdHeader).toBe('X-Correlation-ID');
      expect(config.global.maxContextSize).toBe(1000);

      // Check that environment overrides work
      expect(config.global.includeStackTrace).toBe(true);
    });
  });

  describe('getRetryConfig', () => {
    beforeEach(() => {
      getEnvironmentMode.mockReturnValue('development');
    });

    it('should return default config for unknown error type', () => {
      const config = getRetryConfig('UnknownError');

      expect(config.maxAttempts).toBe(2); // Development override
      expect(config.backoff.type).toBe('exponential');
    });

    it('should return specific config for ClothingError', () => {
      const config = getRetryConfig('ClothingError');

      expect(config.maxAttempts).toBe(3);
      expect(config.backoff.initialDelay).toBe(200);
    });

    it('should return specific config for AnatomyVisualizationError', () => {
      const config = getRetryConfig('AnatomyVisualizationError');

      expect(config.maxAttempts).toBe(2);
      expect(config.backoff.initialDelay).toBe(500);
    });

    it('should return specific config for NetworkError', () => {
      const config = getRetryConfig('NetworkError');

      expect(config.maxAttempts).toBe(5);
      expect(config.backoff.maxDelay).toBe(10000);
    });
  });

  describe('getCircuitBreakerConfig', () => {
    beforeEach(() => {
      getEnvironmentMode.mockReturnValue('development');
    });

    it('should return default config for unknown service', () => {
      const config = getCircuitBreakerConfig('unknown-service');

      expect(config.failureThreshold).toBe(5);
      expect(config.timeout).toBe(30000);
      expect(config.volumeThreshold).toBe(10);
    });

    it('should return specific config for clothing-service', () => {
      const config = getCircuitBreakerConfig('clothing-service');

      expect(config.failureThreshold).toBe(3);
      expect(config.timeout).toBe(60000);
    });

    it('should return specific config for llm-service', () => {
      const config = getCircuitBreakerConfig('llm-service');

      expect(config.failureThreshold).toBe(2);
      expect(config.timeout).toBe(120000); // 2 minutes for LLM
    });

    it('should return specific config for external-api', () => {
      const config = getCircuitBreakerConfig('external-api');

      expect(config.errorThresholdPercentage).toBe(30);
    });
  });

  describe('getFallbackValue', () => {
    beforeEach(() => {
      getEnvironmentMode.mockReturnValue('development');
    });

    it('should return default fallback for unknown domain', () => {
      expect(getFallbackValue(null, 'fetch')).toBe(null);
      expect(getFallbackValue(null, 'list')).toEqual([]);
      expect(getFallbackValue(null, 'count')).toBe(0);
      expect(getFallbackValue(null, 'validate')).toBe(false);
    });

    it('should return domain-specific fallback for clothing', () => {
      expect(getFallbackValue('clothing', 'getEquipment')).toEqual([]);
      expect(getFallbackValue('clothing', 'getAccessibility')).toEqual({
        accessible: true,
        items: [],
      });
    });

    it('should return domain-specific fallback for anatomy', () => {
      const anatomyFallback = getFallbackValue('anatomy', 'generateAnatomy');
      expect(anatomyFallback.parts).toHaveLength(6);
      expect(anatomyFallback.parts[0]).toMatchObject({
        id: 'head',
        type: 'head',
      });

      expect(getFallbackValue('anatomy', 'generateDescription')).toBe(
        'A standard humanoid form.'
      );
    });

    it('should return domain-specific fallback for llm', () => {
      expect(getFallbackValue('llm', 'generateText')).toBe(
        '[Text generation unavailable]'
      );
      expect(getFallbackValue('llm', 'analyzePrompt')).toEqual({
        tokens: 0,
        valid: false,
      });
      expect(getFallbackValue('llm', 'complete')).toBe(null);
    });

    it('should return null for undefined operations', () => {
      expect(getFallbackValue('unknown', 'unknown')).toBe(null);
    });
  });

  describe('isRetriable', () => {
    beforeEach(() => {
      getEnvironmentMode.mockReturnValue('development');
    });

    it('should return false for non-retriable errors', () => {
      expect(isRetriable('ValidationError')).toBe(false);
      expect(isRetriable('ConfigurationError')).toBe(false);
      expect(isRetriable('AuthenticationError')).toBe(false);
      expect(isRetriable('AuthorizationError')).toBe(false);
      expect(isRetriable('NotFoundError')).toBe(false);
      expect(isRetriable('ConflictError')).toBe(false);
    });

    it('should return true for retriable errors', () => {
      expect(isRetriable('NetworkError')).toBe(true);
      expect(isRetriable('TimeoutError')).toBe(true);
      expect(isRetriable('ServiceUnavailableError')).toBe(true);
      expect(isRetriable('UnknownError')).toBe(true);
    });
  });

  describe('Configuration Validation', () => {
    it('should have valid sampling configuration', () => {
      const config = errorHandlingConfig;

      expect(config.reporting.sampling).toMatchObject({
        enabled: expect.any(Boolean),
        rate: expect.any(Number),
        alwaysReport: expect.any(Array),
      });

      expect(config.reporting.sampling.rate).toBeGreaterThanOrEqual(0);
      expect(config.reporting.sampling.rate).toBeLessThanOrEqual(1);
    });

    it('should have valid performance settings', () => {
      const config = errorHandlingConfig;

      expect(config.performance.maxErrorHistory).toBeGreaterThan(0);
      expect(config.performance.metricsRetention).toBeGreaterThan(0);
      expect(config.performance.cleanupInterval).toBeGreaterThan(0);
    });

    it('should have valid recovery strategies for all severities', () => {
      const config = errorHandlingConfig;

      expect(config.recovery.strategies[ErrorSeverity.CRITICAL]).toMatchObject({
        strategy: 'fail-fast',
        notify: true,
        fallback: false,
      });

      expect(config.recovery.strategies[ErrorSeverity.ERROR]).toMatchObject({
        strategy: 'retry-with-fallback',
        notify: false,
        fallback: true,
      });
    });

    it('should have valid alert thresholds', () => {
      const config = errorHandlingConfig;

      expect(config.reporting.alerts.criticalErrors).toBeGreaterThan(0);
      expect(config.reporting.alerts.errorRate).toBeGreaterThan(0);
      expect(config.reporting.alerts.specificError).toBeGreaterThan(0);
      expect(config.reporting.alerts.failureRate).toBeGreaterThan(0);
      expect(config.reporting.alerts.failureRate).toBeLessThanOrEqual(1);
    });
  });

  describe('Environment Override Behavior', () => {
    it('should not override undefined properties', () => {
      getEnvironmentMode.mockReturnValue('test');

      const config = getErrorConfig();

      // Properties not overridden in test environment should retain base values
      expect(config.reporting.batchSize).toBe(50);
      expect(config.reporting.flushInterval).toBe(30000);
    });

    it('should deeply merge nested configurations', () => {
      getEnvironmentMode.mockReturnValue('development');

      const config = getErrorConfig();

      // Check that only specific retry properties are overridden
      expect(config.retry.default.maxAttempts).toBe(2); // Overridden
      expect(config.retry.default.backoff.type).toBe('exponential'); // Not overridden
      expect(config.retry.default.backoff.initialDelay).toBe(100); // Not overridden
    });
  });
});
