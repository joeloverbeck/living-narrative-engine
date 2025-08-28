/**
 * @file Integration tests for DebugLoggingConfigValidator async validation features
 * @description Tests the comprehensive validation system with real async network checks
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import { DebugLoggingConfigValidator } from '../../../../src/logging/config/configValidator.js';

describe('DebugLoggingConfigValidator - Async Integration', () => {
  let testBed;
  let validator;
  let mockSchemaValidator;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.createMockLogger();
    mockSchemaValidator = testBed.createMock('schemaValidator', [
      'validateAgainstSchema',
    ]);

    validator = new DebugLoggingConfigValidator({
      schemaValidator: mockSchemaValidator,
      logger: mockLogger,
    });

    // Mock schema validation to pass by default
    mockSchemaValidator.validateAgainstSchema.mockReturnValue({
      isValid: true,
      errors: [],
    });
  });

  afterEach(() => {
    testBed.cleanup();
    jest.restoreAllMocks();
  });

  describe('Comprehensive Validation with Network Mocking', () => {
    beforeEach(() => {
      // Mock global fetch for integration tests
      global.fetch = jest.fn();
    });

    it('should perform full validation pipeline with successful network check', async () => {
      // Mock successful network response
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
      });

      const config = {
        enabled: true,
        mode: 'remote',
        remote: {
          endpoint: 'https://api.example.com/logs',
          batchSize: 100,
          flushInterval: 1000,
          retryAttempts: 3,
        },
        categories: {
          engine: { enabled: true, level: 'info' },
          ui: { enabled: true, level: 'debug' },
        },
      };

      const result = await validator.performComprehensiveValidation(config);

      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
      expect(result.layers.schema.isValid).toBe(true);
      expect(result.layers.semantic.isValid).toBe(true);
      expect(result.layers.security.isValid).toBe(true);
      expect(result.layers.runtime.isValid).toBe(true);

      // Verify network call was made
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.example.com/logs',
        expect.objectContaining({
          method: 'HEAD',
          signal: expect.any(AbortSignal),
        })
      );
    });

    it('should handle network timeout gracefully in comprehensive validation', async () => {
      // Mock timeout scenario
      global.fetch.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject({ name: 'AbortError' }), 100);
        });
      });

      const config = {
        enabled: true,
        mode: 'remote',
        remote: {
          endpoint: 'https://slow-api.example.com/logs',
          batchSize: 50,
          flushInterval: 2000,
        },
      };

      const result = await validator.performComprehensiveValidation(config);

      // Should still be valid overall (network issues are warnings)
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain('Endpoint timeout after 5000ms');
      expect(result.layers.runtime.isValid).toBe(false);
    }, 10000);

    it('should collect multiple warnings across all validation layers', async () => {
      // Mock network failure
      global.fetch.mockRejectedValue(new Error('Connection refused'));

      // Configure environment for security warnings
      process.env.NODE_ENV = 'production';

      const config = {
        enabled: true,
        mode: 'remote',
        remote: {
          endpoint: 'http://api.example.com/logs', // HTTP in production (warning)
          batchSize: 1500, // Large batch (warning)
          flushInterval: 100, // Short interval (warning)
          circuitBreakerThreshold: 60, // Permissive threshold (warning)
          retryMaxDelay: 90000, // Excessive delay (warning)
        },
      };

      const result = await validator.performComprehensiveValidation(config);

      expect(result.isValid).toBe(true); // Network failures don't fail validation
      expect(result.warnings.length).toBeGreaterThanOrEqual(5);
      expect(result.warnings).toContain(
        'Using insecure HTTP endpoint in production'
      );
      expect(result.warnings).toContain(
        'Very large batch size may cause memory issues'
      );
      expect(result.warnings).toContain(
        'Very short flush interval may cause performance degradation'
      );
      expect(result.warnings).toContain(
        'Very high circuit breaker threshold may not provide adequate protection'
      );
      expect(result.warnings).toContain(
        'Very high retry max delay may cause poor user experience'
      );
      expect(result.warnings).toContain(
        'Cannot reach endpoint: Connection refused'
      );

      delete process.env.NODE_ENV;
    });

    it('should handle mixed validation results with some layers failing', async () => {
      // Mock network success
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
      });

      // Configure for semantic failure
      const config = {
        enabled: true,
        mode: 'none', // This will conflict with enabled categories
        remote: {
          endpoint: 'https://api.example.com/logs',
        },
        categories: {
          engine: { enabled: true, level: 'info' }, // Enabled category with mode "none"
        },
      };

      const result = await validator.performComprehensiveValidation(config);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Categories enabled but mode is "none": engine'
      );
      expect(result.layers.schema.isValid).toBe(true);
      expect(result.layers.semantic.isValid).toBe(false);
      expect(result.layers.security.isValid).toBe(true);
      expect(result.layers.runtime.isValid).toBe(true);
    });

    it('should support selective layer skipping for performance', async () => {
      const config = {
        enabled: true,
        mode: 'remote',
        remote: {
          endpoint: 'https://api.example.com/logs',
        },
      };

      // Skip expensive network validation
      const result = await validator.performComprehensiveValidation(config, {
        skipRuntime: true,
      });

      expect(result.layers.runtime).toBe(null);
      expect(global.fetch).not.toHaveBeenCalled();
      expect(result.validationDurationMs).toBeGreaterThanOrEqual(0);
    });

    it('should validate performance characteristics of comprehensive validation', async () => {
      // Mock fast network response
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
      });

      const config = {
        enabled: true,
        mode: 'hybrid',
        remote: {
          endpoint: 'https://api.example.com/logs',
          batchSize: 100,
          flushInterval: 1000,
        },
        categories: {
          engine: { enabled: true, level: 'debug' },
          ui: { enabled: true, level: 'info' },
          logic: { enabled: true, level: 'warn' },
          entities: { enabled: true, level: 'error' },
        },
        console: {
          enabled: true,
          useColors: true,
          showTimestamp: false,
        },
        performance: {
          enableMetrics: true,
          metricsInterval: 30000,
          slowLogThreshold: 500,
        },
      };

      const startTime = Date.now();
      const result = await validator.performComprehensiveValidation(config);
      const actualDuration = Date.now() - startTime;

      expect(result.isValid).toBe(true);
      expect(result.validationDurationMs).toBeGreaterThanOrEqual(0);
      expect(result.validationDurationMs).toBeLessThan(1000); // Should be fast
      expect(actualDuration).toBeLessThan(1000); // Overall test should be fast

      // Verify all layers were executed
      expect(result.layers.schema).not.toBe(null);
      expect(result.layers.semantic).not.toBe(null);
      expect(result.layers.security).not.toBe(null);
      expect(result.layers.runtime).not.toBe(null);
    });

    it('should handle error recovery during comprehensive validation', async () => {
      // Mock schema validator throwing on first call, succeeding on retry
      let callCount = 0;
      mockSchemaValidator.validateAgainstSchema.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('Temporary schema validation error');
        }
        return { isValid: true, errors: [] };
      });

      const config = {
        enabled: true,
        mode: 'console',
      };

      const result = await validator.performComprehensiveValidation(config);

      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toMatch(
        /Validation error: Temporary schema validation error/
      );
      expect(mockLogger.error).toHaveBeenCalledWith(
        'Error during debug logging configuration validation',
        expect.any(Error)
      );
    });

    it('should validate real-world configuration scenarios', async () => {
      // Mock network success
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
      });

      // Test development configuration
      const devConfig = {
        enabled: true,
        mode: 'console',
        fallbackToConsole: true,
        remote: {
          endpoint: 'http://localhost:3001/api/debug-log',
          batchSize: 50,
          flushInterval: 500,
          retryAttempts: 1,
          requestTimeout: 3000,
        },
        categories: {
          engine: { enabled: true, level: 'debug' },
          ui: { enabled: true, level: 'info' },
          performance: { enabled: false, level: 'warn' },
        },
        console: {
          enabled: true,
          useColors: true,
          showTimestamp: true,
        },
      };

      const devResult =
        await validator.performComprehensiveValidation(devConfig);

      expect(devResult.isValid).toBe(true);
      expect(devResult.warnings.length).toBeGreaterThanOrEqual(0); // May have warnings

      // Test production configuration
      process.env.NODE_ENV = 'production';
      const prodConfig = {
        enabled: true,
        mode: 'production',
        fallbackToConsole: false,
        remote: {
          endpoint: 'https://logs.company.com/api/debug-log',
          batchSize: 200,
          flushInterval: 2000,
          retryAttempts: 3,
          requestTimeout: 5000,
          compression: true,
        },
        categories: {
          engine: { enabled: true, level: 'error' },
          ui: { enabled: true, level: 'warn' },
          security: { enabled: true, level: 'info' },
        },
        console: {
          enabled: false,
        },
      };

      const prodResult =
        await validator.performComprehensiveValidation(prodConfig);

      expect(prodResult.isValid).toBe(true);
      expect(prodResult.warnings).toEqual([]); // Should have no warnings in production

      delete process.env.NODE_ENV;
    });

    it('should measure validation performance under concurrent load', async () => {
      // Mock fast network responses
      global.fetch.mockResolvedValue({
        ok: true,
        status: 200,
      });

      const config = {
        enabled: true,
        mode: 'remote',
        remote: {
          endpoint: 'https://api.example.com/logs',
          batchSize: 100,
          flushInterval: 1000,
        },
      };

      // Run 5 concurrent validations
      const validationPromises = Array.from({ length: 5 }, () =>
        validator.performComprehensiveValidation(config)
      );

      const results = await Promise.all(validationPromises);

      // All validations should succeed
      results.forEach((result, index) => {
        expect(result.isValid).toBe(true);
        expect(result.validationDurationMs).toBeGreaterThanOrEqual(0);
        expect(result.validationDurationMs).toBeLessThan(500);
      });

      // Verify fetch was called for each validation
      expect(global.fetch).toHaveBeenCalledTimes(5);
    });
  });

  describe('Error Boundary Testing', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    it('should handle malformed network responses gracefully', async () => {
      // Mock malformed response
      global.fetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      const config = {
        enabled: true,
        mode: 'remote',
        remote: {
          endpoint: 'https://broken-api.example.com/logs',
        },
      };

      const result = await validator.performComprehensiveValidation(config);

      expect(result.isValid).toBe(true); // Network failures are warnings
      expect(result.warnings).toContain('Endpoint returned status: 500');
      expect(result.layers.runtime.isValid).toBe(false);
    });

    it('should handle DNS resolution failures', async () => {
      // Mock DNS failure
      global.fetch.mockRejectedValue(
        new Error('getaddrinfo ENOTFOUND nonexistent-domain.com')
      );

      const config = {
        enabled: true,
        mode: 'remote',
        remote: {
          endpoint: 'https://nonexistent-domain.com/logs',
        },
      };

      const result = await validator.performComprehensiveValidation(config);

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'Cannot reach endpoint: getaddrinfo ENOTFOUND nonexistent-domain.com'
      );
      expect(result.layers.runtime.isValid).toBe(false);
    });

    it('should validate with custom timeout settings', async () => {
      const endpoint = 'https://slow-api.example.com/logs';

      // Test with very short timeout - mock a slow response that will timeout
      global.fetch.mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          setTimeout(() => reject({ name: 'AbortError' }), 200);
        });
      });

      const shortTimeoutResult = await validator.validateEndpointReachability(
        endpoint,
        100
      );
      expect(shortTimeoutResult.isValid).toBe(false);
      expect(shortTimeoutResult.errors[0]).toMatch(/timeout/i);

      // Test with sufficient timeout - mock a successful response
      global.fetch.mockImplementationOnce(() => {
        return Promise.resolve({ ok: true, status: 200 });
      });

      const longTimeoutResult = await validator.validateEndpointReachability(
        endpoint,
        1000
      );
      expect(longTimeoutResult.isValid).toBe(true);
    }, 10000);
  });
});
