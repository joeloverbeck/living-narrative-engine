/**
 * @file Performance tests for ActionTraceConfigLoader
 * @see src/configuration/actionTraceConfigLoader.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ActionTraceConfigLoader from '../../../src/configuration/actionTraceConfigLoader.js';

describe('ActionTraceConfigLoader Performance', () => {
  let loader;
  let mockTraceConfigLoader;
  let mockLogger;
  let mockValidator;

  beforeEach(async () => {
    // Reset mocks
    mockTraceConfigLoader = {
      loadConfig: jest.fn(),
    };
    mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
    mockValidator = {
      validate: jest.fn(),
    };

    loader = new ActionTraceConfigLoader({
      traceConfigLoader: mockTraceConfigLoader,
      logger: mockLogger,
      validator: mockValidator,
    });
  });

  describe('Exact Match Performance', () => {
    it('should perform exact match lookups in <1ms with many patterns', async () => {
      // Create loader with many exact match patterns for performance testing
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: [
            // 100 exact matches
            ...Array.from({ length: 100 }, (_, i) => `mod${i}:action${i}`),
          ],
          outputDirectory: './traces',
          verbosity: 'standard',
          includeComponentData: true,
          includePrerequisites: true,
          includeTargets: true,
          maxTraceFiles: 100,
          rotationPolicy: 'age',
          maxFileAge: 86400,
        },
      });

      mockValidator.validate.mockResolvedValue({ isValid: true });

      // Initialize with optimized structures
      await loader.loadConfig();

      const iterations = 10000;
      const targetAction = 'mod50:action50'; // Middle of the list

      // Warm up the performance timer
      for (let i = 0; i < 100; i++) {
        await loader.shouldTraceAction(targetAction);
      }

      // Reset statistics for accurate measurement
      loader.resetStatistics();

      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        await loader.shouldTraceAction(targetAction);
      }

      const duration = performance.now() - start;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(1); // Less than 1ms per lookup

      // Verify all lookups were exact matches
      const stats = loader.getStatistics();
      expect(stats.totalLookups).toBe(iterations);
      expect(stats.exactMatches).toBe(iterations);
      expect(stats.wildcardMatches).toBe(0);
    });

    it('should handle non-matching exact lookups efficiently', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: [
            ...Array.from({ length: 100 }, (_, i) => `mod${i}:action${i}`),
          ],
          outputDirectory: './traces',
          verbosity: 'standard',
        },
      });

      mockValidator.validate.mockResolvedValue({ isValid: true });

      await loader.loadConfig();

      const iterations = 10000;
      const nonExistentAction = 'nonexistent:action';

      loader.resetStatistics();

      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        const result = await loader.shouldTraceAction(nonExistentAction);
        expect(result).toBe(false);
      }

      const duration = performance.now() - start;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(1); // Less than 1ms per lookup

      const stats = loader.getStatistics();
      expect(stats.totalLookups).toBe(iterations);
      expect(stats.exactMatches).toBe(0);
      expect(stats.wildcardMatches).toBe(0);
    });
  });

  describe('Wildcard Pattern Performance', () => {
    it('should handle wildcard matching efficiently', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: [
            // 10 wildcard patterns
            ...Array.from({ length: 10 }, (_, i) => `wildcard${i}:*`),
          ],
          outputDirectory: './traces',
          verbosity: 'standard',
        },
      });

      mockValidator.validate.mockResolvedValue({ isValid: true });

      await loader.loadConfig();

      const iterations = 10000;
      const wildcardAction = 'wildcard5:something';

      loader.resetStatistics();

      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        const result = await loader.shouldTraceAction(wildcardAction);
        expect(result).toBe(true);
      }

      const duration = performance.now() - start;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(1); // Less than 1ms per lookup

      const stats = loader.getStatistics();
      expect(stats.totalLookups).toBe(iterations);
      expect(stats.wildcardMatches).toBe(iterations);
      expect(stats.exactMatches).toBe(0);
    });

    it('should handle global wildcard (*) efficiently', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: ['*'],
          outputDirectory: './traces',
          verbosity: 'standard',
        },
      });

      mockValidator.validate.mockResolvedValue({ isValid: true });

      await loader.loadConfig();

      const iterations = 10000;
      const actions = ['core:go', 'custom:action', 'mod:behavior', 'any:thing'];

      loader.resetStatistics();

      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        const action = actions[i % actions.length];
        const result = await loader.shouldTraceAction(action);
        expect(result).toBe(true);
      }

      const duration = performance.now() - start;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(1); // Less than 1ms per lookup

      const stats = loader.getStatistics();
      expect(stats.totalLookups).toBe(iterations);
      expect(stats.wildcardMatches).toBe(iterations);
    });
  });

  describe('Mixed Pattern Performance', () => {
    it('should handle mixed exact and wildcard patterns efficiently', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: [
            // 50 exact matches
            ...Array.from({ length: 50 }, (_, i) => `exact${i}:action${i}`),
            // 10 wildcard patterns
            ...Array.from({ length: 10 }, (_, i) => `wildcard${i}:*`),
            // Global wildcard
            '*',
          ],
          outputDirectory: './traces',
          verbosity: 'standard',
        },
      });

      mockValidator.validate.mockResolvedValue({ isValid: true });

      await loader.loadConfig();

      const iterations = 10000;
      const testCases = [
        { action: 'exact25:action25', expectedMatch: true, type: 'exact' },
        {
          action: 'wildcard3:something',
          expectedMatch: true,
          type: 'wildcard',
        },
        { action: 'any:random:action', expectedMatch: true, type: 'global' },
        { action: 'nonexistent:action', expectedMatch: true, type: 'global' }, // Still matches * pattern
      ];

      loader.resetStatistics();

      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        const testCase = testCases[i % testCases.length];
        const result = await loader.shouldTraceAction(testCase.action);
        expect(result).toBe(testCase.expectedMatch);
      }

      const duration = performance.now() - start;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(1); // Less than 1ms per lookup

      const stats = loader.getStatistics();
      expect(stats.totalLookups).toBe(iterations);
      expect(stats.exactMatches + stats.wildcardMatches).toBe(iterations);
    });

    it('should maintain performance with config reloads', async () => {
      const config1 = {
        actionTracing: {
          enabled: true,
          tracedActions: Array.from(
            { length: 50 },
            (_, i) => `config1_${i}:action`
          ),
          outputDirectory: './traces1',
          verbosity: 'standard',
        },
      };

      const config2 = {
        actionTracing: {
          enabled: true,
          tracedActions: Array.from(
            { length: 75 },
            (_, i) => `config2_${i}:action`
          ),
          outputDirectory: './traces2',
          verbosity: 'detailed',
        },
      };

      mockValidator.validate.mockResolvedValue({ isValid: true });

      // Load initial config
      mockTraceConfigLoader.loadConfig.mockResolvedValueOnce(config1);
      await loader.loadConfig();

      // Test performance with first config
      const iterations1 = 1000;
      loader.resetStatistics();

      const start1 = performance.now();
      for (let i = 0; i < iterations1; i++) {
        await loader.shouldTraceAction('config1_25:action');
      }
      const duration1 = performance.now() - start1;
      const avgTime1 = duration1 / iterations1;

      expect(avgTime1).toBeLessThan(1);

      // Reload with new config
      mockTraceConfigLoader.loadConfig.mockResolvedValueOnce(config2);
      await loader.reloadConfig();

      // Test performance with reloaded config
      const iterations2 = 1000;
      loader.resetStatistics();

      const start2 = performance.now();
      for (let i = 0; i < iterations2; i++) {
        await loader.shouldTraceAction('config2_35:action');
      }
      const duration2 = performance.now() - start2;
      const avgTime2 = duration2 / iterations2;

      expect(avgTime2).toBeLessThan(1);

      // Performance should remain consistent
      const performanceDifference = Math.abs(avgTime2 - avgTime1);
      expect(performanceDifference).toBeLessThan(0.5); // Should be within 0.5ms
    });
  });

  describe('Configuration Method Performance', () => {
    it('should access configuration methods efficiently', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: ['*'],
          verbosity: 'detailed',
          includeComponentData: true,
          includePrerequisites: false,
          includeTargets: true,
          outputDirectory: './traces',
          rotationPolicy: 'count',
          maxTraceFiles: 100,
          maxFileAge: 3600,
        },
      });

      mockValidator.validate.mockResolvedValue({ isValid: true });

      await loader.loadConfig();

      const iterations = 1000;

      // Test multiple configuration method calls
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        await loader.getVerbosityLevel();
        await loader.getInclusionConfig();
        await loader.getOutputDirectory();
        await loader.getRotationConfig();
      }

      const duration = performance.now() - start;
      const avgTime = duration / (iterations * 4); // 4 method calls per iteration

      expect(avgTime).toBeLessThan(0.1); // Should be very fast since config is cached
    });

    it('should filter data by verbosity efficiently', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: ['*'],
          verbosity: 'verbose',
          includeComponentData: true,
          includePrerequisites: true,
          includeTargets: true,
          outputDirectory: './traces',
        },
      });

      mockValidator.validate.mockResolvedValue({ isValid: true });

      await loader.loadConfig();

      const testData = {
        timestamp: Date.now(),
        actionId: 'core:test',
        result: 'success',
        executionTime: 100,
        success: true,
        componentData: { test: 'data' },
        prerequisites: { prereq: 'info' },
        targets: { target: 'info' },
        debugInfo: { debug: 'info' },
        stackTrace: 'trace',
        systemState: { state: 'info' },
      };

      const iterations = 1000;

      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        const filtered = await loader.filterDataByVerbosity(testData);
        expect(filtered).toBeDefined();
        expect(filtered.actionId).toBe('core:test');
      }

      const duration = performance.now() - start;
      const avgTime = duration / iterations;

      expect(avgTime).toBeLessThan(1); // Less than 1ms per filter operation
    });
  });

  describe('Statistics Performance', () => {
    it('should provide statistics without impacting lookup performance', async () => {
      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go', 'custom:*'],
          outputDirectory: './traces',
        },
      });

      mockValidator.validate.mockResolvedValue({ isValid: true });

      await loader.loadConfig();

      // Perform many lookups to generate statistics
      const lookupIterations = 1000;
      for (let i = 0; i < lookupIterations; i++) {
        await loader.shouldTraceAction('core:go');
        await loader.shouldTraceAction('custom:action');
      }

      // Test statistics access performance
      const statsIterations = 1000;
      const start = performance.now();

      for (let i = 0; i < statsIterations; i++) {
        const stats = loader.getStatistics();
        expect(stats.totalLookups).toBe(lookupIterations * 2);
      }

      const duration = performance.now() - start;
      const avgTime = duration / statsIterations;

      expect(avgTime).toBeLessThan(0.1); // Should be very fast (read-only)
    });
  });
});
