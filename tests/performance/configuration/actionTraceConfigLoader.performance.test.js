/**
 * @file Performance tests for ActionTraceConfigLoader
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

describe('ActionTraceConfigLoader Performance', () => {
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

  describe('Performance Regression Detection', () => {
    it('should detect performance regressions after establishing baseline', async () => {
      const config = createSampleConfig({
        tracedActions: Array(100)
          .fill(null)
          .map((_, i) => `mod:action${i}`),
      });

      mockTraceConfigLoader.loadConfig.mockResolvedValue(config);

      // Perform 5 fast operations to establish baseline (>= MIN_OPERATION_SAMPLES_FOR_ALERT)
      for (let i = 0; i < 5; i++) {
        await loader.reloadConfig();
      }

      // Clear previous warnings
      mockLogger.warn.mockClear();

      // Now simulate slow operation that should trigger warning
      mockTraceConfigLoader.loadConfig.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 35));
        return config;
      });

      await loader.reloadConfig();

      // Check for performance warnings
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Performance regression'),
        expect.objectContaining({ threshold: '25ms' })
      );
    });

    it('should track slow operation rate correctly', async () => {
      const config = createSampleConfig();

      // Mix of fast and slow operations
      let callCount = 0;
      mockTraceConfigLoader.loadConfig.mockImplementation(async () => {
        callCount++;
        // Every 3rd operation is slow
        if (callCount % 3 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 30));
        }
        return config;
      });

      // Perform 10 operations
      for (let i = 0; i < 10; i++) {
        await loader.reloadConfig();
      }

      const stats = loader.getStatistics();
      const configLoadMetrics = stats.operationMetrics['config-load'];

      expect(configLoadMetrics).toBeDefined();
      expect(configLoadMetrics.count).toBe(10);
      expect(configLoadMetrics.slowOperations).toBeGreaterThan(0);
      expect(configLoadMetrics.slowRate).toBeGreaterThan(0);
      // Approximately 33% should be slow (3 out of 10)
      expect(configLoadMetrics.slowRate).toBeCloseTo(30, 0);
    });

    it('should measure operation performance accurately', async () => {
      const config = createSampleConfig();
      mockTraceConfigLoader.loadConfig.mockResolvedValue(config);

      const startTime = performance.now();

      // Perform multiple operations
      for (let i = 0; i < 10; i++) {
        await loader.reloadConfig();
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;

      const stats = loader.getStatistics();
      const configLoadMetrics = stats.operationMetrics['config-load'];

      expect(configLoadMetrics).toBeDefined();
      expect(configLoadMetrics.count).toBe(10);
      expect(configLoadMetrics.avgTime).toBeGreaterThan(0);
      // Verify average time is reasonable relative to total elapsed time
      expect(configLoadMetrics.avgTime * 10).toBeLessThanOrEqual(totalTime);
    });

    it('should track performance bounds (min/max)', async () => {
      const config = createSampleConfig();

      let callCount = 0;
      mockTraceConfigLoader.loadConfig.mockImplementation(async () => {
        callCount++;
        // Create variation in operation times
        const delay = callCount === 1 ? 1 : callCount === 5 ? 40 : 10;
        await new Promise((resolve) => setTimeout(resolve, delay));
        return config;
      });

      // Perform 5 operations with varying times
      for (let i = 0; i < 5; i++) {
        await loader.reloadConfig();
      }

      const stats = loader.getStatistics();
      const configLoadMetrics = stats.operationMetrics['config-load'];

      expect(configLoadMetrics).toBeDefined();
      expect(configLoadMetrics.minTime).toBeLessThan(configLoadMetrics.maxTime);
      expect(configLoadMetrics.avgTime).toBeGreaterThanOrEqual(
        configLoadMetrics.minTime
      );
      expect(configLoadMetrics.avgTime).toBeLessThanOrEqual(
        configLoadMetrics.maxTime
      );
    });
  });
});
