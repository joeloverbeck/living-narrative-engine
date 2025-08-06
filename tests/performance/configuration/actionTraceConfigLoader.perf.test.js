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

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ActionTraceConfigLoader from '../../../src/configuration/actionTraceConfigLoader.js';

describe('ActionTraceConfigLoader Performance', () => {
  let loader;
  let mockTraceConfigLoader;
  let mockLogger;
  let mockValidator;

  beforeEach(async () => {
    // Force garbage collection to stabilize memory state
    if (global.gc) {
      global.gc();
    }

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

    // Performance test stabilization: allow JIT to warm up
    await new Promise((resolve) => setTimeout(resolve, 10));
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

  describe('TTL Performance Impact', () => {
    // Note: TTL (Time-To-Live) cache performance tests measure:
    // 1. Cache hit performance with timestamp validation overhead
    // 2. Performance consistency across different TTL configurations
    // 3. Cache expiration detection and reload performance
    // These tests account for JavaScript timing precision limitations
    it('should measure TTL check overhead in cache hits', async () => {
      const mockConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go', 'core:attack'],
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
      mockValidator.validate.mockResolvedValue({ isValid: true });

      // Create loader with TTL enabled
      const ttlLoader = new ActionTraceConfigLoader({
        traceConfigLoader: mockTraceConfigLoader,
        logger: mockLogger,
        validator: mockValidator,
        cacheTtl: 60000, // 1 minute
      });

      // Load initial config
      await ttlLoader.loadConfig();
      expect(mockTraceConfigLoader.loadConfig).toHaveBeenCalledTimes(1);

      // Measure TTL check performance
      const iterations = 10000;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        await ttlLoader.loadConfig(); // All should be cache hits with TTL checks
      }

      const duration = performance.now() - start;
      const avgTimePerCheck = (duration * 1000000) / iterations; // Convert to nanoseconds

      // TTL check should add minimal overhead
      expect(avgTimePerCheck).toBeLessThan(10000); // <10μs per check (being realistic for JS)
      expect(mockTraceConfigLoader.loadConfig).toHaveBeenCalledTimes(1); // Only initial load
    });

    it('should compare performance with and without TTL', async () => {
      const mockConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: Array.from(
            { length: 50 },
            (_, i) => `mod${i}:action${i}`
          ),
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
      mockValidator.validate.mockResolvedValue({ isValid: true });

      // Test without TTL (disabled caching)
      const noCacheLoader = new ActionTraceConfigLoader({
        traceConfigLoader: mockTraceConfigLoader,
        logger: mockLogger,
        validator: mockValidator,
        cacheTtl: 0, // Disabled
      });

      // Test with TTL
      const ttlLoader = new ActionTraceConfigLoader({
        traceConfigLoader: mockTraceConfigLoader,
        logger: mockLogger,
        validator: mockValidator,
        cacheTtl: 60000, // 1 minute
      });

      const iterations = 1000;

      // Warm up and measure no-cache performance
      mockTraceConfigLoader.loadConfig.mockClear();
      const noCacheStart = performance.now();

      for (let i = 0; i < iterations; i++) {
        await noCacheLoader.loadConfig();
      }

      const noCacheDuration = performance.now() - noCacheStart;

      // Warm up and measure TTL cache performance
      mockTraceConfigLoader.loadConfig.mockClear();
      await ttlLoader.loadConfig(); // Initial load
      const ttlCacheStart = performance.now();

      for (let i = 0; i < iterations; i++) {
        await ttlLoader.loadConfig(); // Should all be cache hits
      }

      const ttlCacheDuration = performance.now() - ttlCacheStart;

      // TTL caching should be significantly faster than reloading every time
      // Note: Speedup varies based on system load, but caching should provide meaningful benefit
      const speedup = noCacheDuration / ttlCacheDuration;
      expect(speedup).toBeGreaterThan(5); // At least 5x faster with caching (realistic for variable conditions)

      // TTL cache should have minimal per-operation time
      const avgTtlTime = ttlCacheDuration / iterations;
      expect(avgTtlTime).toBeLessThan(0.1); // <0.1ms per cached operation
    });

    it('should measure performance with various TTL values', async () => {
      const mockConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go'],
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
      mockValidator.validate.mockResolvedValue({ isValid: true });

      const ttlValues = [1000, 5000, 30000, 60000, 300000]; // Various TTL values
      const results = [];

      for (const ttl of ttlValues) {
        const testLoader = new ActionTraceConfigLoader({
          traceConfigLoader: mockTraceConfigLoader,
          logger: mockLogger,
          validator: mockValidator,
          cacheTtl: ttl,
        });

        // Load initial config
        await testLoader.loadConfig();

        // Warm up for this TTL configuration
        for (let warmup = 0; warmup < 100; warmup++) {
          await testLoader.loadConfig();
        }

        // Take multiple samples for statistical stability
        const samples = [];
        const iterations = 1000;

        for (let sample = 0; sample < 5; sample++) {
          const start = performance.now();

          for (let i = 0; i < iterations; i++) {
            await testLoader.loadConfig();
          }

          const duration = performance.now() - start;
          const avgTime = duration / iterations;
          samples.push(avgTime);

          await new Promise((resolve) => setTimeout(resolve, 10));
        }

        // Use median of samples for stability
        samples.sort((a, b) => a - b);
        const medianTime = samples[Math.floor(samples.length / 2)];

        results.push({ ttl, avgTime: medianTime });
      }

      // All TTL values should have similar performance (timestamp comparison is constant time)
      results.forEach(({ ttl, avgTime }) => {
        expect(avgTime).toBeLessThan(0.1); // <0.1ms per operation regardless of TTL
      });

      // Performance should be consistent across different TTL values
      // Note: JavaScript performance timing has inherent variability due to:
      // - JIT compilation effects
      // - Garbage collection interference
      // - System load and concurrent test execution
      const times = results.map((r) => r.avgTime);
      const maxTime = Math.max(...times);
      const minTime = Math.min(...times);
      const variation = (maxTime - minTime) / minTime;

      expect(variation).toBeLessThan(2.0); // <200% variation between different TTL values (realistic for micro-benchmarks)
    });

    it('should measure cache expiration and reload performance', async () => {
      const mockConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go'],
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
      mockValidator.validate.mockResolvedValue({ isValid: true });

      const expiredLoader = new ActionTraceConfigLoader({
        traceConfigLoader: mockTraceConfigLoader,
        logger: mockLogger,
        validator: mockValidator,
        cacheTtl: 50, // Very short TTL for testing
      });

      // Load initial config
      await expiredLoader.loadConfig();

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

    it('should measure statistics performance with TTL information', async () => {
      const mockConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:go'],
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
      mockValidator.validate.mockResolvedValue({ isValid: true });

      const ttlLoader = new ActionTraceConfigLoader({
        traceConfigLoader: mockTraceConfigLoader,
        logger: mockLogger,
        validator: mockValidator,
        cacheTtl: 60000,
      });

      // Load config to populate cache
      await ttlLoader.loadConfig();

      // Extended warm-up for statistics performance measurement
      for (let warmup = 0; warmup < 1000; warmup++) {
        ttlLoader.getStatistics();
      }

      // Stabilize timing with additional warm-up and GC
      if (global.gc) {
        global.gc();
      }
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Measure statistics performance with TTL calculations using multiple samples
      const iterations = 10000;
      const samples = [];

      // Take multiple timing samples for statistical analysis
      for (let sample = 0; sample < 10; sample++) {
        const start = performance.now();

        for (let i = 0; i < iterations; i++) {
          const stats = ttlLoader.getStatistics();
          expect(stats.cacheTtl).toBe(60000);
          expect(stats.cacheStatus).toBe('valid');
          expect(stats.cacheAge).toBeGreaterThanOrEqual(0);
        }

        const duration = performance.now() - start;
        const avgTime = (duration * 1000000) / iterations; // Convert to nanoseconds
        samples.push(avgTime);

        // Brief pause between samples to avoid interference
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      // Statistical analysis: use median for robustness against outliers
      samples.sort((a, b) => a - b);
      const medianTime = samples[Math.floor(samples.length / 2)];
      const p95Time = samples[Math.floor(samples.length * 0.95)];

      // Statistics with TTL calculations should still be very fast
      // Note: Using median reduces impact of timing outliers from GC, system load, etc.
      // P95 threshold catches performance regressions while allowing realistic variance
      expect(medianTime).toBeLessThan(200000); // <200μs median (typical case)
      expect(p95Time).toBeLessThan(500000); // <500μs P95 (outlier tolerance)
    });
  });
});
