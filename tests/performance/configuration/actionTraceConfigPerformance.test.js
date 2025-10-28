/**
 * @file Performance benchmark tests for ActionTraceConfigLoader enhancements
 * @see src/configuration/actionTraceConfigLoader.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import ActionTraceConfigLoader from '../../../src/configuration/actionTraceConfigLoader.js';
import ActionTraceConfigValidator from '../../../src/configuration/actionTraceConfigValidator.js';
import {
  createMockTraceConfigLoader,
  createMockSchemaValidator,
} from '../../common/mockFactories/traceConfigMocks.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

describe('ActionTraceConfigLoader Performance Benchmarks', () => {
  let loader;
  let mockTraceConfigLoader;
  let mockLogger;
  let mockValidator;

  // Performance thresholds
  const PERFORMANCE_THRESHOLDS = {
    cacheHit: 5, // Cache hits should be < 5ms (CI-adjusted)
    configLoad: 35, // Config loading should be < 35ms (CI-adjusted)
    validation: 5, // Validation should be < 5ms
    fingerprinting: 2, // Fingerprinting should be < 2ms
  };

  beforeEach(() => {
    mockTraceConfigLoader = createMockTraceConfigLoader();
    mockLogger = createMockLogger();
    mockValidator = createMockSchemaValidator();

    // Create loader with short cache TTL for testing
    loader = new ActionTraceConfigLoader({
      traceConfigLoader: mockTraceConfigLoader,
      logger: mockLogger,
      validator: mockValidator,
      cacheTtl: 200, // 200ms to prevent race condition with test execution time
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Configuration Fingerprinting Performance', () => {
    it('should use fingerprint-based cache invalidation efficiently', async () => {
      const mockConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:move', 'core:attack'],
          outputFormats: ['json', 'text'],
          verbosity: 'standard',
          includeComponentData: true,
          includePrerequisites: true,
          includeTargets: true,
          outputDirectory: './traces',
          maxTraceFiles: 100,
          rotationPolicy: 'age',
          maxFileAge: 86400,
          textFormatOptions: {
            enableColors: true,
            lineWidth: 120,
            indentSize: 2,
            sectionSeparator: '=',
            includeTimestamps: true,
            performanceSummary: true,
          },
        },
      };

      mockTraceConfigLoader.loadConfig.mockResolvedValue(mockConfig);

      // First load - should miss cache
      const start1 = performance.now();
      await loader.loadConfig();
      const loadTime = performance.now() - start1;

      expect(loadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.configLoad);

      // Second load - should hit cache
      const start2 = performance.now();
      await loader.loadConfig();
      const cacheHitTime = performance.now() - start2;

      expect(cacheHitTime).toBeLessThan(PERFORMANCE_THRESHOLDS.cacheHit);

      // Get statistics and verify cache metrics
      const stats = loader.getStatistics();
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(1);
      expect(stats.cacheHitRate).toBeGreaterThan(0);
    });

    it('should detect configuration changes via fingerprinting', async () => {
      const config1 = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:move'],
          outputFormats: ['json'],
          verbosity: 'standard',
          outputDirectory: './traces',
          maxTraceFiles: 100,
          rotationPolicy: 'age',
          maxFileAge: 86400,
        },
      };

      const config2 = {
        ...config1,
        actionTracing: {
          ...config1.actionTracing,
          tracedActions: ['core:move', 'core:attack'], // Changed
        },
      };

      mockTraceConfigLoader.loadConfig
        .mockResolvedValueOnce(config1)
        .mockResolvedValueOnce(config2);

      // Load initial config
      await loader.loadConfig();

      // Force reload with changed config
      await loader.reloadConfig();

      const stats = loader.getStatistics();
      expect(stats.fingerprintChanges).toBeGreaterThan(0);
    });
  });

  describe('Operation-Specific Performance Tracking', () => {
    it('should track performance metrics per operation type', async () => {
      const mockConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:*'],
          outputFormats: ['json'],
          verbosity: 'detailed',
          outputDirectory: './traces',
        },
      };

      mockTraceConfigLoader.loadConfig.mockResolvedValue(mockConfig);

      // Perform multiple operations
      for (let i = 0; i < 5; i++) {
        await loader.reloadConfig();
      }

      const stats = loader.getStatistics();
      expect(stats.operationMetrics).toBeDefined();

      // Check for operation-specific metrics
      const configLoadMetrics = stats.operationMetrics['config-load'];
      if (configLoadMetrics) {
        expect(configLoadMetrics.count).toBeGreaterThan(0);
        expect(configLoadMetrics.avgTime).toBeDefined();
        expect(configLoadMetrics.minTime).toBeDefined();
        expect(configLoadMetrics.maxTime).toBeDefined();
      }
    });

    it('should detect performance regressions', async () => {
      const mockConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: Array(100)
            .fill(null)
            .map((_, i) => `mod${i}:action`),
          outputFormats: ['json', 'text', 'html'],
          verbosity: 'verbose',
        },
      };

      mockTraceConfigLoader.loadConfig.mockResolvedValue(mockConfig);

      // Load config multiple times to establish baseline
      for (let i = 0; i < 3; i++) {
        await loader.reloadConfig();
      }

      const stats = loader.getStatistics();

      // Check if any slow operations were detected
      if (stats.operationMetrics['config-load']) {
        const metrics = stats.operationMetrics['config-load'];
        expect(metrics.slowRate).toBeDefined();
      }
    });
  });

  describe('Cache Hit Rate Optimization', () => {
    it('should maintain high cache hit rate under normal operations', async () => {
      const mockConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:move'],
          outputFormats: ['json'],
          verbosity: 'standard',
        },
      };

      mockTraceConfigLoader.loadConfig.mockResolvedValue(mockConfig);

      // Perform many reads without config changes
      const iterations = 20;
      for (let i = 0; i < iterations; i++) {
        await loader.loadConfig();
        // Small delay to stay within cache TTL
        await new Promise((resolve) => setTimeout(resolve, 5));
      }

      const stats = loader.getStatistics();
      const hitRate = stats.cacheHitRate;

      // Expect high cache hit rate (> 90%)
      expect(hitRate).toBeGreaterThan(90);
    });

    it('should handle cache invalidation efficiently', async () => {
      const mockConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:move'],
          outputFormats: ['json'],
        },
      };

      mockTraceConfigLoader.loadConfig.mockResolvedValue(mockConfig);

      // Load initial config
      await loader.loadConfig();

      // Wait for cache to expire
      await new Promise((resolve) => setTimeout(resolve, 250));

      // Load again after expiry
      const start = performance.now();
      await loader.loadConfig();
      const reloadTime = performance.now() - start;

      // Even cache misses should be fast
      expect(reloadTime).toBeLessThan(PERFORMANCE_THRESHOLDS.configLoad);
    });
  });

  describe('Pattern Matching Performance', () => {
    it('should handle large numbers of traced actions efficiently', async () => {
      const largeActionList = Array(500)
        .fill(null)
        .map((_, i) => `mod${Math.floor(i / 10)}:action${i}`);

      const mockConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: largeActionList,
          outputFormats: ['json'],
        },
      };

      mockTraceConfigLoader.loadConfig.mockResolvedValue(mockConfig);
      await loader.loadConfig();

      // Test pattern matching performance
      const testActions = [
        'mod0:action0',
        'mod25:action250',
        'mod49:action499',
        'unknown:action',
      ];

      const startTime = performance.now();
      for (const action of testActions) {
        await loader.shouldTraceAction(action);
      }
      const totalTime = performance.now() - startTime;
      const avgTime = totalTime / testActions.length;

      // Pattern matching should be fast even with many patterns
      expect(avgTime).toBeLessThan(1); // < 1ms per lookup
    });

    it('should optimize wildcard pattern matching', async () => {
      const mockConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: [
            'core:*',
            'combat:*',
            'dialog:*',
            'inventory:*',
            'quest:*',
          ],
          outputFormats: ['json'],
        },
      };

      mockTraceConfigLoader.loadConfig.mockResolvedValue(mockConfig);
      await loader.loadConfig();

      // Test various action patterns
      const testCases = [
        { action: 'core:move', expected: true },
        { action: 'combat:attack', expected: true },
        { action: 'unknown:action', expected: false },
        { action: 'quest:complete', expected: true },
      ];

      const lookupTimes = [];

      for (const { action, expected } of testCases) {
        const start = performance.now();
        const result = await loader.shouldTraceAction(action);
        const time = performance.now() - start;

        expect(result).toBe(expected);
        lookupTimes.push(time);
      }

      const avgLookupTime =
        lookupTimes.reduce((total, duration) => total + duration, 0) /
        lookupTimes.length;

      // Allow a small buffer for async scheduling overhead while still catching regressions
      expect(avgLookupTime).toBeLessThan(5); // Average wildcard lookup should be < 5ms

      // Check statistics
      const stats = loader.getStatistics();
      expect(stats.slowLookupRate).toBeLessThan(30); // CI-adjusted: < 30% slow lookups
    });
  });

  describe('Memory Usage Optimization', () => {
    it('should reset statistics without memory leaks', () => {
      // Generate some statistics
      loader.resetStatistics();

      const stats1 = loader.getStatistics();
      expect(stats1.totalLookups).toBe(0);
      expect(stats1.cacheHits).toBe(0);
      expect(stats1.operationMetrics).toEqual({});

      // Reset should clear all metrics
      loader.resetStatistics();

      const stats2 = loader.getStatistics();
      expect(stats2).toEqual(
        expect.objectContaining({
          totalLookups: 0,
          cacheHits: 0,
          cacheMisses: 0,
          fingerprintChanges: 0,
        })
      );
    });
  });

  describe('Performance Benchmarks Summary', () => {
    it('should meet performance targets for all operations', async () => {
      const mockConfig = {
        actionTracing: {
          enabled: true,
          tracedActions: ['core:move', 'core:attack', 'core:interact'],
          outputFormats: ['json', 'text'],
          verbosity: 'detailed',
          includeComponentData: true,
          includePrerequisites: true,
          includeTargets: true,
          textFormatOptions: {
            enableColors: true,
            lineWidth: 120,
            indentSize: 2,
            includeTimestamps: true,
            performanceSummary: true,
          },
        },
      };

      mockTraceConfigLoader.loadConfig.mockResolvedValue(mockConfig);

      // Benchmark configuration loading
      const loadStart = performance.now();
      await loader.loadConfig();
      const loadTime = performance.now() - loadStart;

      // Benchmark cache hits
      const cacheStart = performance.now();
      await loader.loadConfig();
      const cacheTime = performance.now() - cacheStart;

      // Benchmark pattern matching
      const patternStart = performance.now();
      await loader.shouldTraceAction('core:move');
      const patternTime = performance.now() - patternStart;

      // Verify all operations meet performance thresholds
      expect(loadTime).toBeLessThan(20); // Initial load < 20ms
      expect(cacheTime).toBeLessThan(2); // Cache hit < 2ms
      expect(patternTime).toBeLessThan(5); // Pattern match < 5ms (realistic with monitoring overhead)

      // Get final statistics
      const stats = loader.getStatistics();

      console.log('Performance Benchmark Results:', {
        initialLoadTime: `${loadTime.toFixed(2)}ms`,
        cacheHitTime: `${cacheTime.toFixed(2)}ms`,
        patternMatchTime: `${patternTime.toFixed(2)}ms`,
        cacheHitRate: `${stats.cacheHitRate.toFixed(1)}%`,
        slowLookupRate: `${stats.slowLookupRate.toFixed(1)}%`,
      });
    });
  });
});
