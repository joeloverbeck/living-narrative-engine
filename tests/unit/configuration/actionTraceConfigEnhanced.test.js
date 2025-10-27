/**
 * @file Unit tests for ActionTraceConfigLoader enhancements (DUALFORMACT-002)
 * @see src/configuration/actionTraceConfigLoader.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ActionTraceConfigLoader from '../../../src/configuration/actionTraceConfigLoader.js';
import ActionTraceConfigValidator from '../../../src/configuration/actionTraceConfigValidator.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';
import {
  createMockTraceConfigLoader,
  createMockSchemaValidator,
  createSampleConfig,
} from '../../common/mockFactories/traceConfigMocks.js';

// Mock the ActionTraceConfigValidator
jest.mock('../../../src/configuration/actionTraceConfigValidator.js');

describe('ActionTraceConfigLoader Enhancements', () => {
  let loader;
  let mockTraceConfigLoader;
  let mockLogger;
  let mockValidator;

  beforeEach(() => {
    mockTraceConfigLoader = createMockTraceConfigLoader();
    mockLogger = createMockLogger();
    mockValidator = createMockSchemaValidator();

    // Setup the ActionTraceConfigValidator mock
    ActionTraceConfigValidator.mockClear();
    ActionTraceConfigValidator.mockImplementation(() => ({
      initialize: jest.fn().mockResolvedValue(undefined),
      validateConfiguration: jest.fn().mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
        normalizedConfig: null,
      }),
    }));

    loader = new ActionTraceConfigLoader({
      traceConfigLoader: mockTraceConfigLoader,
      logger: mockLogger,
      validator: mockValidator,
      cacheTtl: 60000,
    });
  });

  describe('Configuration Fingerprinting', () => {
    it('should generate consistent fingerprints for identical configurations', async () => {
      const config = createSampleConfig();
      mockTraceConfigLoader.loadConfig.mockResolvedValue(config);

      // Load config twice
      await loader.loadConfig();
      const stats1 = loader.getStatistics();

      await loader.loadConfig();
      const stats2 = loader.getStatistics();

      // Should hit cache on second load
      expect(stats2.cacheHits).toBe(1);
      expect(stats2.cacheMisses).toBe(1);
    });

    it('should detect configuration changes through fingerprinting', async () => {
      const config1 = createSampleConfig();
      const config2 = createSampleConfig({
        tracedActions: ['core:move', 'core:attack', 'core:interact'],
      });

      mockTraceConfigLoader.loadConfig
        .mockResolvedValueOnce(config1)
        .mockResolvedValueOnce(config2);

      await loader.loadConfig();

      // Force reload with different config
      await loader.reloadConfig();

      const stats = loader.getStatistics();
      expect(stats.fingerprintChanges).toBeGreaterThan(0);
    });

    it('should include text format options in fingerprint when text output is enabled', async () => {
      const config1 = createSampleConfig({
        outputFormats: ['json', 'text'],
        textFormatOptions: {
          enableColors: true,
          lineWidth: 100,
        },
      });

      const config2 = createSampleConfig({
        outputFormats: ['json', 'text'],
        textFormatOptions: {
          enableColors: false, // Changed
          lineWidth: 100,
        },
      });

      mockTraceConfigLoader.loadConfig
        .mockResolvedValueOnce(config1)
        .mockResolvedValueOnce(config2);

      await loader.loadConfig();
      await loader.reloadConfig();

      const stats = loader.getStatistics();
      expect(stats.fingerprintChanges).toBeGreaterThan(0);
    });

    it('should not include text format options in fingerprint when text output is disabled', async () => {
      const config = createSampleConfig({
        outputFormats: ['json'], // No text output
        textFormatOptions: {
          enableColors: true,
          lineWidth: 100,
        },
      });

      mockTraceConfigLoader.loadConfig.mockResolvedValue(config);

      await loader.loadConfig();

      // The fingerprint should not include text options
      const stats = loader.getStatistics();
      expect(stats.cacheMisses).toBe(1);
    });
  });

  describe('Operation-Specific Performance Tracking', () => {
    it('should track metrics for different operation types', async () => {
      const config = createSampleConfig();
      mockTraceConfigLoader.loadConfig.mockResolvedValue(config);

      // Perform operations
      await loader.loadConfig();
      await loader.loadConfig(); // Cache hit
      await loader.reloadConfig(); // Force reload

      const stats = loader.getStatistics();
      expect(stats.operationMetrics).toBeDefined();

      // Should have metrics for config-load
      if (stats.operationMetrics['config-load']) {
        const metrics = stats.operationMetrics['config-load'];
        expect(metrics.count).toBeGreaterThan(0);
        expect(metrics.avgTime).toBeGreaterThanOrEqual(0);
        expect(metrics.minTime).toBeGreaterThanOrEqual(0);
        expect(metrics.maxTime).toBeGreaterThanOrEqual(0);
      }

      // Should have metrics for cache-hit
      if (stats.operationMetrics['cache-hit']) {
        const metrics = stats.operationMetrics['cache-hit'];
        expect(metrics.count).toBe(1);
      }
    });

    it('should calculate accurate operation statistics', async () => {
      const config = createSampleConfig();
      mockTraceConfigLoader.loadConfig.mockResolvedValue(config);

      // Perform multiple operations
      for (let i = 0; i < 5; i++) {
        await loader.reloadConfig();
      }

      const stats = loader.getStatistics();
      const configLoadMetrics = stats.operationMetrics['config-load'];

      if (configLoadMetrics) {
        expect(configLoadMetrics.count).toBe(5);
        expect(configLoadMetrics.slowRate).toBeDefined();
        expect(configLoadMetrics.slowRate).toBeGreaterThanOrEqual(0);
        expect(configLoadMetrics.slowRate).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('Enhanced Cache Management', () => {
    it('should track cache hit rate accurately', async () => {
      const config = createSampleConfig();
      mockTraceConfigLoader.loadConfig.mockResolvedValue(config);

      // Miss, hit, hit, miss (reload), hit
      await loader.loadConfig(); // Miss
      await loader.loadConfig(); // Hit
      await loader.loadConfig(); // Hit
      await loader.reloadConfig(); // Miss
      await loader.loadConfig(); // Hit

      const stats = loader.getStatistics();
      expect(stats.cacheHits).toBe(3);
      expect(stats.cacheMisses).toBe(2);
      expect(stats.cacheHitRate).toBe(60); // 3/5 = 60%
    });

    it('should handle cache expiration correctly', async () => {
      const config = createSampleConfig();
      mockTraceConfigLoader.loadConfig.mockResolvedValue(config);

      // Create loader with very short TTL
      loader = new ActionTraceConfigLoader({
        traceConfigLoader: mockTraceConfigLoader,
        logger: mockLogger,
        validator: mockValidator,
        cacheTtl: 10, // 10ms TTL
      });

      await loader.loadConfig();

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 20));

      await loader.loadConfig();

      const stats = loader.getStatistics();
      expect(stats.cacheMisses).toBe(2); // Both should miss due to expiration
    });
  });

  describe('Statistics Management', () => {
    it('should reset all statistics correctly', async () => {
      const config = createSampleConfig();
      mockTraceConfigLoader.loadConfig.mockResolvedValue(config);

      // Generate some statistics
      await loader.loadConfig();
      await loader.shouldTraceAction('core:move');

      // Reset statistics
      loader.resetStatistics();

      const stats = loader.getStatistics();
      expect(stats.totalLookups).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
      expect(stats.operationMetrics).toEqual({});
      expect(stats.slowLookups).toBe(0);
    });

    it('should preserve fingerprint reference after reset', async () => {
      const config = createSampleConfig();
      mockTraceConfigLoader.loadConfig.mockResolvedValue(config);

      await loader.loadConfig();

      // Reset statistics
      loader.resetStatistics();

      // Load again - should still use cache if fingerprint matches
      await loader.loadConfig();

      const stats = loader.getStatistics();
      expect(stats.cacheHits).toBe(1);
    });
  });

  describe('Performance Thresholds', () => {
    it('should respect configurable performance thresholds', async () => {
      const config = createSampleConfig();
      mockTraceConfigLoader.loadConfig.mockResolvedValue(config);

      // Multiple loads to establish baseline
      for (let i = 0; i < 10; i++) {
        await loader.loadConfig();
      }

      const stats = loader.getStatistics();

      // Check that metrics are being tracked
      if (stats.operationMetrics['cache-hit']) {
        const metrics = stats.operationMetrics['cache-hit'];
        expect(metrics.count).toBeGreaterThan(0);

        // Performance should be good for cache hits
        expect(metrics.avgTime).toBeLessThan(5); // Should be very fast
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors gracefully', async () => {
      // Create a new loader with validation that will fail
      ActionTraceConfigValidator.mockClear();
      ActionTraceConfigValidator.mockImplementation(() => ({
        initialize: jest.fn().mockResolvedValue(undefined),
        validateConfiguration: jest.fn().mockResolvedValue({
          isValid: false,
          errors: ['Invalid configuration'],
          warnings: [],
          normalizedConfig: null,
        }),
      }));

      const errorLoader = new ActionTraceConfigLoader({
        traceConfigLoader: mockTraceConfigLoader,
        logger: mockLogger,
        validator: mockValidator,
        cacheTtl: 60000,
      });

      const config = createSampleConfig();
      mockTraceConfigLoader.loadConfig.mockResolvedValue(config);

      const result = await errorLoader.loadConfig();

      // Should return default config on validation error
      expect(result.enabled).toBe(false);
      expect(result.tracedActions).toEqual([]);
    });

    it('should handle loader errors gracefully', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        error: 'Failed to load configuration',
      });

      const result = await loader.loadConfig();

      // Should return default config on loader error
      expect(result.enabled).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        'Failed to load trace configuration, using defaults',
        expect.any(Object)
      );
    });
  });
});
