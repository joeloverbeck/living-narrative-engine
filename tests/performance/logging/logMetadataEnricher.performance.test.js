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

  beforeEach(() => {
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

      // Should process 1000 entries quickly
      expect(metrics.totalTime).toBeLessThan(500); // Less than 500ms

      // Calculate operations per second
      const opsPerSecond = iterations / (metrics.totalTime / 1000);
      expect(opsPerSecond).toBeGreaterThan(2000); // Should handle 2k+ ops/sec
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
      expect(metrics.totalTime).toBeLessThan(50); // Should be fast
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

      if (opsPerMsValues.length > 1) {
        const avgOpsPerMs =
          opsPerMsValues.reduce((a, b) => a + b, 0) / opsPerMsValues.length;

        // All values should be within reasonable range of average
        opsPerMsValues.forEach((ops) => {
          if (avgOpsPerMs > 0) {
            const deviation = Math.abs(ops - avgOpsPerMs) / avgOpsPerMs;
            expect(deviation).toBeLessThan(2.0); // Allow 200% variance for different load patterns
          }
        });
      }
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
        expect(result.totalTime).toBeLessThan(500); // Less than 500ms for 1000 operations
      });
    });
  });

  describe('Memory Usage Benchmarks', () => {
    it('should maintain efficient memory usage during high volume enrichment', async () => {
      enricher = new LogMetadataEnricher({ level: 'full' });

      const iterations = 2000;

      // Warmup
      for (let i = 0; i < 100; i++) {
        enricher.enrichLogEntrySync({ level: 'info', message: 'warmup' });
      }

      const baselineMemory = process.memoryUsage().heapUsed;
      const benchmark = performanceTracker.startBenchmark('memory-usage', {
        trackMemory: true,
      });

      for (let i = 0; i < iterations; i++) {
        const logEntry = {
          level: 'info',
          message: `Memory test ${i}`,
          timestamp: new Date().toISOString(),
        };

        enricher.enrichLogEntrySync(logEntry, [{ index: i }]);
      }

      const metrics = benchmark.end();
      const afterMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = afterMemory - baselineMemory;

      // Should not consume excessive memory (allow more for test environment)
      const bytesPerOperation = memoryIncrease / iterations;
      expect(bytesPerOperation).toBeLessThan(20000); // Less than 20KB per operation

      // Should complete efficiently
      expect(metrics.totalTime).toBeLessThan(1000);
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

      // All operations should be reasonably fast (adjusted for test environment)
      expect(operations.minimal).toBeLessThan(200);
      expect(operations.standard).toBeLessThan(300);
      expect(operations.full).toBeLessThan(400);

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
