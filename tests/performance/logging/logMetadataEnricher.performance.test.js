/**
 * @file Performance benchmark tests for LogMetadataEnricher
 * @see src/logging/logMetadataEnricher.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { createPerformanceTestBed } from '../../common/performanceTestBed.js';

/**
 * Helper to determine environment-appropriate timing multipliers
 *
 * @returns {object} Timing multipliers for test environment
 */
function getTimingMultipliers() {
  const isCI = !!(
    process.env.CI ||
    process.env.CONTINUOUS_INTEGRATION ||
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.JENKINS_URL
  );

  return {
    // CI environments are generally slower and less predictable
    timeoutMultiplier: isCI ? 3.0 : 1.5,
    // Allow more variance in CI for consistent operations
    opsVarianceMultiplier: isCI ? 0.5 : 0.8,
  };
}
import LogMetadataEnricher from '../../../src/logging/logMetadataEnricher.js';

// Mock browser APIs
const mockNavigator = {
  userAgent: 'Mozilla/5.0 (Test Browser)',
  language: 'en-US',
  platform: 'MacIntel',
  cookieEnabled: true,
  onLine: true,
  doNotTrack: '1',
};

const mockWindow = {
  location: {
    href: 'http://localhost:8080/test',
  },
  innerWidth: 1920,
  innerHeight: 1080,
};

const mockScreen = {
  width: 2560,
  height: 1440,
  availWidth: 2560,
  availHeight: 1400,
  colorDepth: 24,
  pixelDepth: 24,
};

const mockPerformance = {
  now: jest.fn(() => 1234.56),
  memory: {
    usedJSHeapSize: 10485760, // 10MB
    totalJSHeapSize: 20971520, // 20MB
    jsHeapSizeLimit: 2147483648, // 2GB
  },
  getEntriesByType: jest.fn((type) => {
    if (type === 'navigation') {
      return [
        {
          domContentLoadedEventEnd: 500,
          loadEventEnd: 800,
          responseEnd: 300,
          requestStart: 100,
        },
      ];
    }
    return [];
  }),
};

// Store original globals
const originalWindow = global.window;
const originalNavigator = global.navigator;
const originalScreen = global.screen;
const originalPerformance = global.performance;
const originalRequestIdleCallback = global.requestIdleCallback;

describe('LogMetadataEnricher - Performance Benchmarks', () => {
  let performanceTestBed;
  let performanceTracker;
  let enricher;
  let timingMultipliers;

  const BASELINE_THRESHOLDS = {
    // Conservative thresholds for 1000 operations accounting for environment variance
    metadataEnrichment: 2000, // 2000ms for 1000 operations allows for system load
    largeMetadata: 200, // 200ms for single large object processing
    opsPerSecond: 250, // Minimum 250 ops/second (conservative baseline)
    memoryPerOperation: 50000, // 50KB per operation (realistic for V8 heap behavior)
  };

  beforeEach(() => {
    // Get environment-specific timing multipliers
    timingMultipliers = getTimingMultipliers();

    // Setup global mocks
    global.window = mockWindow;
    global.navigator = mockNavigator;
    global.screen = mockScreen;
    global.performance = mockPerformance;
    global.requestIdleCallback = jest.fn((callback) => {
      setTimeout(() => callback({ timeRemaining: () => 50 }), 0);
      return 1;
    });

    // Reset mock function calls
    mockPerformance.now.mockClear();
    mockPerformance.getEntriesByType.mockClear();

    performanceTestBed = createPerformanceTestBed();
    performanceTracker = performanceTestBed.createPerformanceTracker();
  });

  afterEach(() => {
    // Restore original globals
    global.window = originalWindow;
    global.navigator = originalNavigator;
    global.screen = originalScreen;
    global.performance = originalPerformance;
    global.requestIdleCallback = originalRequestIdleCallback;

    performanceTestBed.cleanup();
  });

  describe('Metadata Enrichment Performance', () => {
    it('should enrich metadata quickly', () => {
      enricher = new LogMetadataEnricher({ level: 'standard' });

      const iterations = 1000;
      const benchmark = performanceTracker.startBenchmark(
        'metadata-enrichment-speed'
      );

      for (let i = 0; i < iterations; i++) {
        const logEntry = {
          level: 'info',
          message: `Test message ${i}`,
        };

        enricher.enrichLogEntrySync(logEntry);
      }

      const metrics = benchmark.end();

      // Should process 1000 entries within reasonable time
      const timeThreshold =
        BASELINE_THRESHOLDS.metadataEnrichment *
        timingMultipliers.timeoutMultiplier;
      expect(metrics.totalTime).toBeLessThan(timeThreshold);

      // Calculate operations per second with environment-aware expectations
      const opsPerSecond = iterations / (metrics.totalTime / 1000);
      const minOpsPerSecond =
        BASELINE_THRESHOLDS.opsPerSecond *
        timingMultipliers.opsVarianceMultiplier;
      expect(opsPerSecond).toBeGreaterThan(minOpsPerSecond);
    });

    it('should handle large metadata efficiently', () => {
      enricher = new LogMetadataEnricher({ level: 'standard' });

      const largeArgs = new Array(100).fill({
        data: 'Large object with lots of data',
        nested: {
          more: 'data',
          array: new Array(50).fill('item'),
        },
      });

      const logEntry = {
        level: 'info',
        message: 'Test with large metadata',
      };

      const benchmark = performanceTracker.startBenchmark(
        'large-metadata-handling'
      );
      const enriched = enricher.enrichLogEntrySync(logEntry, largeArgs);
      const metrics = benchmark.end();

      expect(enriched.metadata.originalArgs).toEqual(largeArgs);
      const largeMetadataThreshold =
        BASELINE_THRESHOLDS.largeMetadata * timingMultipliers.timeoutMultiplier;
      expect(metrics.totalTime).toBeLessThan(largeMetadataThreshold);
    });
  });

  describe('Scalability Tests', () => {
    it('should maintain linear performance scaling', () => {
      enricher = new LogMetadataEnricher({ level: 'full' });

      const testSizes = [100, 500, 1000, 2000];
      const timings = [];

      for (const size of testSizes) {
        const benchmark = performanceTracker.startBenchmark(`scale-${size}`);

        for (let i = 0; i < size; i++) {
          const logEntry = {
            level: 'info',
            message: `Scale test ${i}`,
            timestamp: new Date().toISOString(),
          };

          enricher.enrichLogEntrySync(logEntry);
        }

        const metrics = benchmark.end();
        timings.push({
          size,
          duration: metrics.totalTime,
          opsPerMs: size / metrics.totalTime,
        });
      }

      // Performance should scale roughly linearly
      const opsPerMsValues = timings
        .map((t) => t.opsPerMs)
        .filter((ops) => isFinite(ops) && ops > 0);

      // Should have valid performance measurements for multiple test sizes
      expect(opsPerMsValues.length).toBeGreaterThan(1);

      const avgOpsPerMs =
        opsPerMsValues.reduce((a, b) => a + b, 0) / opsPerMsValues.length;

      // Average operations per millisecond should be meaningful
      expect(avgOpsPerMs).toBeGreaterThan(0);

      // Allow more variance in CI environments for stability
      const maxDeviation = timingMultipliers.timeoutMultiplier > 2 ? 3.0 : 2.0;

      // All values should be within reasonable range of average (test scaling consistency)
      opsPerMsValues.forEach((ops) => {
        const deviation = Math.abs(ops - avgOpsPerMs) / avgOpsPerMs;
        expect(deviation).toBeLessThan(maxDeviation);
      });
    });
  });

  describe('Configuration Level Performance', () => {
    it('should perform efficiently at different configuration levels', () => {
      const levels = ['minimal', 'standard', 'full'];
      const results = [];

      for (const level of levels) {
        enricher = new LogMetadataEnricher({ level });

        const iterations = 1000;
        const benchmark = performanceTracker.startBenchmark(`level-${level}`);

        for (let i = 0; i < iterations; i++) {
          const logEntry = {
            level: 'info',
            message: `Level test ${i}`,
          };

          enricher.enrichLogEntrySync(logEntry);
        }

        const metrics = benchmark.end();
        results.push({
          level,
          totalTime: metrics.totalTime,
          opsPerMs: iterations / metrics.totalTime,
        });
      }

      // Minimal should generally be fastest, full should generally be slowest
      // Allow some variance in test environment
      expect(results[0].opsPerMs).toBeGreaterThan(results[2].opsPerMs * 0.8);

      // All levels should still be reasonably fast
      results.forEach((result) => {
        const configThreshold =
          BASELINE_THRESHOLDS.metadataEnrichment *
          timingMultipliers.timeoutMultiplier;
        expect(result.totalTime).toBeLessThan(configThreshold);
      });
    });
  });


  describe('Performance Baseline', () => {
    it('should establish performance baseline for regression testing', () => {
      const operations = {
        minimal: 0,
        standard: 0,
        full: 0,
      };

      const iterations = 1000;

      // Test each configuration level
      ['minimal', 'standard', 'full'].forEach((level) => {
        enricher = new LogMetadataEnricher({ level });

        const benchmark = performanceTracker.startBenchmark(
          `baseline-${level}`
        );

        for (let i = 0; i < iterations; i++) {
          const logEntry = {
            level: 'info',
            message: `Baseline test ${i}`,
            timestamp: new Date().toISOString(),
          };

          if (level === 'full') {
            // Include complex metadata for full level
            enricher.enrichLogEntrySync(logEntry, [
              { data: 'test', nested: { value: i } },
            ]);
          } else {
            enricher.enrichLogEntrySync(logEntry);
          }
        }

        operations[level] = benchmark.end().totalTime;
      });

      // All operations should be reasonably fast (environment-adjusted thresholds)
      const baselineMultiplier = timingMultipliers.timeoutMultiplier;
      expect(operations.minimal).toBeLessThan(400 * baselineMultiplier);
      expect(operations.standard).toBeLessThan(600 * baselineMultiplier);
      expect(operations.full).toBeLessThan(800 * baselineMultiplier);

      // Log baselines for future reference
      // In a real CI/CD setup, these could be stored and compared
      // console.log('LogMetadataEnricher Performance baselines:', {
      //   minimal: operations.minimal,
      //   standard: operations.standard,
      //   full: operations.full,
      //   timestamp: new Date().toISOString()
      // });
    });
  });
});
