/**
 * @file Performance tests for ActionTraceConfigLoader
 * @see src/configuration/actionTraceConfigLoader.js
 *
 * Performance Test Guidelines:
 * - JavaScript timing precision varies due to system load, GC, and concurrent execution
 * - Thresholds account for realistic Node.js performance characteristics
 * - Tests include warm-up periods to stabilize JIT compilation effects
 * - Statistical variance is expected and accommodated in assertions
 */

import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import ActionTraceConfigLoader from '../../../src/configuration/actionTraceConfigLoader.js';
import ActionTraceConfigValidator from '../../../src/configuration/actionTraceConfigValidator.js';

// Mock the ActionTraceConfigValidator to prevent real instantiation
jest.mock('../../../src/configuration/actionTraceConfigValidator.js');

describe('ActionTraceConfigLoader Performance', () => {
  // Shared test fixtures
  let testFixtures;

  // Reduced iteration count for faster tests while maintaining statistical accuracy
  const PERFORMANCE_ITERATIONS = 1000;
  const TTL_ITERATIONS = 1000;
  const WARMUP_ITERATIONS = 100;

  beforeAll(async () => {
    // Force garbage collection to stabilize memory state
    if (global.gc) {
      global.gc();
    }

    // Create shared test fixtures
    testFixtures = createTestFixtures();

    // Setup the ActionTraceConfigValidator mock once
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
  });

  afterAll(() => {
    jest.clearAllMocks();
  });

  /**
   *
   */
  function createTestFixtures() {
    // Shared mock objects
    const mockTraceConfigLoader = {
      loadConfig: jest.fn(),
    };
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };
    const mockValidator = {
      validate: jest.fn().mockResolvedValue({ isValid: true }),
      addSchema: jest.fn(),
      removeSchema: jest.fn(),
    };

    // Pre-defined test configurations
    const configs = {
      exactMatches: {
        actionTracing: {
          enabled: true,
          tracedActions: Array.from(
            { length: 50 },
            (_, i) => `mod${i}:action${i}`
          ), // Reduced from 100
          outputDirectory: './traces',
          verbosity: 'standard',
          includeComponentData: true,
          includePrerequisites: true,
          includeTargets: true,
          maxTraceFiles: 100,
          rotationPolicy: 'age',
          maxFileAge: 86400,
        },
      },
      wildcardPatterns: {
        actionTracing: {
          enabled: true,
          tracedActions: Array.from({ length: 10 }, (_, i) => `wildcard${i}:*`),
          outputDirectory: './traces',
          verbosity: 'standard',
        },
      },
      mixedPatterns: {
        actionTracing: {
          enabled: true,
          tracedActions: [
            // 25 exact matches (reduced from 50)
            ...Array.from({ length: 25 }, (_, i) => `exact${i}:action${i}`),
            // 5 wildcard patterns (reduced from 10)
            ...Array.from({ length: 5 }, (_, i) => `wildcard${i}:*`),
            // Global wildcard
            '*',
          ],
          outputDirectory: './traces',
          verbosity: 'standard',
        },
      },
      globalWildcard: {
        actionTracing: {
          enabled: true,
          tracedActions: ['*'],
          outputDirectory: './traces',
          verbosity: 'standard',
        },
      },
    };

    return {
      mockTraceConfigLoader,
      mockLogger,
      mockValidator,
      configs,
    };
  }

  /**
   *
   * @param config
   */
  function createLoader(config) {
    const { mockTraceConfigLoader, mockLogger, mockValidator } = testFixtures;

    if (config) {
      mockTraceConfigLoader.loadConfig.mockResolvedValue(config);
    }

    return new ActionTraceConfigLoader({
      traceConfigLoader: mockTraceConfigLoader,
      logger: mockLogger,
      validator: mockValidator,
    });
  }

  describe('Pattern Matching Performance', () => {
    it('should handle exact matches, wildcards, and non-matches efficiently', async () => {
      const loader = createLoader(testFixtures.configs.mixedPatterns);

      // Initialize with optimized structures
      await loader.loadConfig();

      // Test scenarios: exact match, wildcard match, global wildcard, non-match
      const testCases = [
        { action: 'exact12:action12', expectedMatch: true, type: 'exact' },
        {
          action: 'wildcard2:something',
          expectedMatch: true,
          type: 'wildcard',
        },
        { action: 'any:random:action', expectedMatch: true, type: 'global' },
        { action: 'nonexistent:action', expectedMatch: true, type: 'global' }, // Still matches * pattern
      ];

      // Warm up the performance timer
      for (let i = 0; i < WARMUP_ITERATIONS; i++) {
        const testCase = testCases[i % testCases.length];
        await loader.shouldTraceAction(testCase.action);
      }

      // Reset statistics for accurate measurement
      loader.resetStatistics();

      const start = performance.now();

      for (let i = 0; i < PERFORMANCE_ITERATIONS; i++) {
        const testCase = testCases[i % testCases.length];
        const result = await loader.shouldTraceAction(testCase.action);
        expect(result).toBe(testCase.expectedMatch);
      }

      const duration = performance.now() - start;
      const avgTime = duration / PERFORMANCE_ITERATIONS;

      expect(avgTime).toBeLessThan(1); // Less than 1ms per lookup

      // Verify statistics
      const stats = loader.getStatistics();
      expect(stats.totalLookups).toBe(PERFORMANCE_ITERATIONS);
      expect(stats.exactMatches + stats.wildcardMatches).toBe(
        PERFORMANCE_ITERATIONS
      );
    });
  });

  describe('Configuration Reload Performance', () => {
    it('should maintain performance with config reloads', async () => {
      const { mockTraceConfigLoader, mockValidator } = testFixtures;

      const config1 = {
        actionTracing: {
          enabled: true,
          tracedActions: Array.from(
            { length: 25 },
            (_, i) => `config1_${i}:action`
          ), // Reduced from 50
          outputDirectory: './traces1',
          verbosity: 'standard',
        },
      };

      const config2 = {
        actionTracing: {
          enabled: true,
          tracedActions: Array.from(
            { length: 35 },
            (_, i) => `config2_${i}:action`
          ), // Reduced from 75
          outputDirectory: './traces2',
          verbosity: 'detailed',
        },
      };

      // Load initial config
      mockTraceConfigLoader.loadConfig.mockResolvedValueOnce(config1);
      const loader = createLoader();
      await loader.loadConfig();

      // Test performance with first config
      loader.resetStatistics();
      const start1 = performance.now();
      for (let i = 0; i < PERFORMANCE_ITERATIONS; i++) {
        await loader.shouldTraceAction('config1_12:action');
      }
      const duration1 = performance.now() - start1;
      const avgTime1 = duration1 / PERFORMANCE_ITERATIONS;

      expect(avgTime1).toBeLessThan(1);

      // Reload with new config
      mockTraceConfigLoader.loadConfig.mockResolvedValueOnce(config2);
      await loader.reloadConfig();

      // Test performance with reloaded config
      loader.resetStatistics();
      const start2 = performance.now();
      for (let i = 0; i < PERFORMANCE_ITERATIONS; i++) {
        await loader.shouldTraceAction('config2_17:action');
      }
      const duration2 = performance.now() - start2;
      const avgTime2 = duration2 / PERFORMANCE_ITERATIONS;

      expect(avgTime2).toBeLessThan(1);

      // Performance should remain consistent
      const performanceDifference = Math.abs(avgTime2 - avgTime1);
      expect(performanceDifference).toBeLessThan(0.5); // Should be within 0.5ms
    });
  });

  describe('Configuration & Data Processing Performance', () => {
    it('should efficiently access config methods and filter data by verbosity', async () => {
      const detailedConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: ['*'],
          verbosity: 'verbose',
          includeComponentData: true,
          includePrerequisites: false,
          includeTargets: true,
          outputDirectory: './traces',
          rotationPolicy: 'count',
          maxTraceFiles: 100,
          maxFileAge: 3600,
        },
      };

      const loader = createLoader(detailedConfig);
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

      // Test configuration method access performance
      let start = performance.now();
      for (let i = 0; i < PERFORMANCE_ITERATIONS; i++) {
        await loader.getVerbosityLevel();
        await loader.getInclusionConfig();
        await loader.getOutputDirectory();
        await loader.getRotationConfig();
      }
      let duration = performance.now() - start;
      const avgConfigTime = duration / (PERFORMANCE_ITERATIONS * 4); // 4 method calls per iteration
      expect(avgConfigTime).toBeLessThan(0.1); // Should be very fast since config is cached

      // Test data filtering performance
      start = performance.now();
      for (let i = 0; i < PERFORMANCE_ITERATIONS; i++) {
        const filtered = await loader.filterDataByVerbosity(testData);
        expect(filtered).toBeDefined();
        expect(filtered.actionId).toBe('core:test');
      }
      duration = performance.now() - start;
      const avgFilterTime = duration / PERFORMANCE_ITERATIONS;
      expect(avgFilterTime).toBeLessThan(1); // Less than 1ms per filter operation
    });

    it('should provide computed statistics efficiently', async () => {
      const loader = createLoader(testFixtures.configs.mixedPatterns);
      await loader.loadConfig();

      // Generate statistics data
      const lookupIterations = 500; // Reduced from 1000
      for (let i = 0; i < lookupIterations; i++) {
        await loader.shouldTraceAction('exact5:action5');
        await loader.shouldTraceAction('wildcard2:action');
      }

      // Test statistics access performance
      const start = performance.now();
      for (let i = 0; i < PERFORMANCE_ITERATIONS; i++) {
        const stats = loader.getStatistics();
        expect(stats.totalLookups).toBe(lookupIterations * 2);
      }
      const duration = performance.now() - start;
      const avgTime = duration / PERFORMANCE_ITERATIONS;

      expect(avgTime).toBeLessThan(1.0); // Should be fast despite computational work (Date.now(), calculations, object creation)
    });
  });

  describe('TTL Cache Performance', () => {
    it('should measure TTL check overhead', async () => {
      const { mockTraceConfigLoader, mockLogger, mockValidator } = testFixtures;

      const mockConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go'],
          outputDirectory: './traces',
          verbosity: 'standard',
        },
      };

      mockTraceConfigLoader.loadConfig.mockResolvedValue(mockConfig);
      mockValidator.validate.mockResolvedValue({ isValid: true });

      const loader = new ActionTraceConfigLoader({
        traceConfigLoader: mockTraceConfigLoader,
        logger: mockLogger,
        validator: mockValidator,
        cacheTtl: 60000, // Default 1 minute
      });

      // Load initial config
      await loader.loadConfig();

      // Measure TTL check performance
      const iterations = 1000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        await loader.loadConfig(); // Should be cache hits with TTL checks
      }

      const duration = performance.now() - start;
      const avgTimePerCheck = (duration * 1000) / iterations; // Convert to microseconds

      expect(avgTimePerCheck).toBeLessThan(100); // <100μs per check (realistic for JavaScript timing precision)
      expect(mockTraceConfigLoader.loadConfig).toHaveBeenCalledTimes(1); // Only initial load
    });

    it('should have minimal TTL check overhead and efficient cache behavior', async () => {
      const { mockTraceConfigLoader, mockLogger, mockValidator } = testFixtures;

      const mockConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go', 'core:attack'],
          outputDirectory: './traces',
          verbosity: 'standard',
          includeComponentData: true,
          includePrerequisites: true,
          includeTargets: true,
          maxTraceFiles: 100,
          rotationPolicy: 'age',
          maxFileAge: 86400,
        },
      };

      mockTraceConfigLoader.loadConfig.mockResolvedValue(mockConfig);

      // Test with TTL enabled
      const ttlLoader = new ActionTraceConfigLoader({
        traceConfigLoader: mockTraceConfigLoader,
        logger: mockLogger,
        validator: mockValidator,
        cacheTtl: 60000, // 1 minute
      });

      // Test without TTL (disabled caching)
      const noCacheLoader = new ActionTraceConfigLoader({
        traceConfigLoader: mockTraceConfigLoader,
        logger: mockLogger,
        validator: mockValidator,
        cacheTtl: 0, // Disabled
      });

      // Load initial config for TTL loader
      await ttlLoader.loadConfig();
      expect(mockTraceConfigLoader.loadConfig).toHaveBeenCalledTimes(1);

      // Measure TTL cache hit performance
      mockTraceConfigLoader.loadConfig.mockClear();
      const ttlStart = performance.now();
      for (let i = 0; i < TTL_ITERATIONS; i++) {
        await ttlLoader.loadConfig(); // All should be cache hits
      }
      const ttlDuration = performance.now() - ttlStart;
      const avgTtlTime = ttlDuration / TTL_ITERATIONS;

      expect(avgTtlTime).toBeLessThan(0.1); // <0.1ms per cached operation
      expect(mockTraceConfigLoader.loadConfig).not.toHaveBeenCalled(); // Should use cache

      // Compare with no-cache performance for context
      mockTraceConfigLoader.loadConfig.mockClear();
      const noCacheStart = performance.now();
      for (let i = 0; i < TTL_ITERATIONS; i++) {
        await noCacheLoader.loadConfig();
      }
      const noCacheDuration = performance.now() - noCacheStart;

      // TTL caching should be significantly faster
      const speedup = noCacheDuration / ttlDuration;
      // Performance expectation is conservative (2x) due to mock overhead variability
      // In production, actual speedup is typically 5-10x, but mocks add non-deterministic overhead
      expect(speedup).toBeGreaterThan(2); // At least 2x faster with caching

      // Test statistics with TTL information
      const stats = ttlLoader.getStatistics();
      expect(stats.cacheTtl).toBe(60000);
      expect(stats.cacheStatus).toBe('valid');
      expect(stats.cacheAge).toBeGreaterThanOrEqual(0);
    });

    it('should handle cache expiration and reload efficiently', async () => {
      const { mockTraceConfigLoader, mockLogger, mockValidator } = testFixtures;

      const expiredLoader = new ActionTraceConfigLoader({
        traceConfigLoader: mockTraceConfigLoader,
        logger: mockLogger,
        validator: mockValidator,
        cacheTtl: 50, // Very short TTL for testing
      });

      mockTraceConfigLoader.loadConfig.mockResolvedValue(
        testFixtures.configs.exactMatches
      );

      // Load initial config
      await expiredLoader.loadConfig();
      expect(mockTraceConfigLoader.loadConfig).toHaveBeenCalledTimes(1);

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 75));

      // Measure reload performance after expiration
      const reloadStart = performance.now();
      await expiredLoader.loadConfig(); // Should trigger reload
      const reloadDuration = performance.now() - reloadStart;

      // Reload should still be reasonably fast
      expect(reloadDuration).toBeLessThan(10); // <10ms for reload operation

      // Verify it actually reloaded
      expect(mockTraceConfigLoader.loadConfig).toHaveBeenCalledTimes(2);
    });
  });

  describe('Lookup Performance Optimizations', () => {
    it('should use O(1) exact matching with Set', async () => {
      const { mockTraceConfigLoader, mockLogger, mockValidator } = testFixtures;

      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: ['movement:go', 'core:attack', 'core:examine'],
          outputDirectory: './traces',
        },
      });
      mockValidator.validate.mockResolvedValue({ isValid: true });

      const loader = new ActionTraceConfigLoader({
        traceConfigLoader: mockTraceConfigLoader,
        logger: mockLogger,
        validator: mockValidator,
      });

      // Load config to build optimized structures
      await loader.loadConfig();

      // Test that exact matches are fast
      const start = performance.now();
      const result = await loader.shouldTraceAction('movement:go');
      const duration = performance.now() - start;

      expect(result).toBe(true);
      expect(duration).toBeLessThan(1); // <1ms requirement
    });

    it('should handle wildcard patterns efficiently with pre-compiled regex', async () => {
      const { mockTraceConfigLoader, mockLogger, mockValidator } = testFixtures;

      mockTraceConfigLoader.loadConfig.mockResolvedValue({
        actionTracing: {
          enabled: true,
          tracedActions: ['core:*', 'custom:*', 'mod1:*', 'mod2:*'],
          outputDirectory: './traces',
        },
      });
      mockValidator.validate.mockResolvedValue({ isValid: true });

      const loader = new ActionTraceConfigLoader({
        traceConfigLoader: mockTraceConfigLoader,
        logger: mockLogger,
        validator: mockValidator,
      });

      // Load config to build optimized structures
      await loader.loadConfig();

      // Test multiple wildcard matches
      const start = performance.now();
      const results = await Promise.all([
        loader.shouldTraceAction('core:something'),
        loader.shouldTraceAction('custom:anything'),
        loader.shouldTraceAction('mod1:action'),
        loader.shouldTraceAction('mod2:behavior'),
        loader.shouldTraceAction('nonexistent:action'),
      ]);
      const duration = performance.now() - start;

      expect(results).toEqual([true, true, true, true, false]);
      expect(duration).toBeLessThan(5); // Should be very fast even with multiple patterns
    });

    it('should maintain performance with complex patterns', async () => {
      const { mockTraceConfigLoader, mockLogger, mockValidator } = testFixtures;

      const patterns = [
        ...Array.from({ length: 100 }, (_, i) => `mod${i}:action${i}`),
        ...Array.from({ length: 50 }, (_, i) => `wildcard${i}:*`),
        ...Array.from({ length: 25 }, (_, i) => `prefix${i}:action*`),
        ...Array.from({ length: 25 }, (_, i) => `*_suffix${i}`),
      ];

      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: patterns,
          outputDirectory: './traces',
          verbosity: 'standard',
        },
      };

      mockTraceConfigLoader.loadConfig.mockResolvedValue(config);
      mockValidator.validate.mockResolvedValue({ isValid: true });

      const loader = new ActionTraceConfigLoader({
        traceConfigLoader: mockTraceConfigLoader,
        logger: mockLogger,
        validator: mockValidator,
      });

      await loader.loadConfig();

      const testActions = [
        'mod50:action50',
        'wildcard25:anything',
        'prefix10:action_test',
        'core:action_suffix15',
      ];

      const start = performance.now();

      for (let i = 0; i < 1000; i++) {
        const action = testActions[i % testActions.length];
        await loader.shouldTraceAction(action);
      }

      const duration = performance.now() - start;
      const avgTime = duration / 1000;

      expect(avgTime).toBeLessThan(1); // Less than 1ms per check
    });

    it('should detect and log slow lookup performance', async () => {
      const mockLogger = {
        warn: jest.fn(),
        debug: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
      };
      const { mockTraceConfigLoader, mockValidator } = testFixtures;

      const loaderWithMockLogger = new ActionTraceConfigLoader({
        traceConfigLoader: mockTraceConfigLoader,
        logger: mockLogger,
        validator: mockValidator,
      });

      const config = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:*', 'test:action*'],
          outputDirectory: './traces',
          verbosity: 'standard',
        },
      };

      mockTraceConfigLoader.loadConfig.mockResolvedValue(config);
      mockValidator.validate.mockResolvedValue({ isValid: true });

      // Mock performance.now to simulate slow lookups
      const originalPerformanceNow = performance.now;
      let callCount = 0;
      const mockPerformanceNow = jest.fn(() => {
        callCount++;
        // First call (start time) = 0, second call (end time) = 2ms to simulate slow lookup
        if (callCount % 2 === 1) {
          return 0; // Start time
        } else {
          return 2; // End time (2ms duration - considered slow)
        }
      });

      performance.now = mockPerformanceNow;

      try {
        // Perform a lookup that should be detected as slow
        await loaderWithMockLogger.shouldTraceAction('core:slow_action');

        // Should warn about slow lookup
        expect(mockLogger.warn).toHaveBeenCalledWith(
          'Slow action lookup detected',
          expect.objectContaining({
            duration: '2.000ms',
            totalLookups: 1,
            slowLookupRate: '100.00%',
          })
        );

        // Verify performance statistics are updated
        const stats = loaderWithMockLogger.getStatistics();
        expect(stats.slowLookups).toBe(1);
        expect(stats.slowestLookup).toBe(2);
        expect(stats.slowLookupRate).toBe(100);
      } finally {
        // Restore original performance.now
        performance.now = originalPerformanceNow;
      }
    });
  });
});
