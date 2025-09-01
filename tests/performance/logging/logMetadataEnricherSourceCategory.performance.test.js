/**
 * @file Performance benchmark tests for LogMetadataEnricher source category detection
 * @see src/logging/logMetadataEnricher.js
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createPerformanceTestBed } from '../../common/performanceTestBed.js';
import LogMetadataEnricher from '../../../src/logging/logMetadataEnricher.js';

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

describe('LogMetadataEnricher Source Category - Performance Benchmarks', () => {
  let performanceTestBed;
  let performanceTracker;
  let enricher;
  let mockErrorConstructor;
  let timingMultipliers;

  const BASELINE_THRESHOLDS = {
    // Performance thresholds for source category detection
    categoryDetection: 2, // 2ms per operation for category detection
    largeStackProcessing: 5, // 5ms for handling large stack traces
  };

  beforeEach(() => {
    // Get environment-specific timing multipliers
    timingMultipliers = getTimingMultipliers();

    performanceTestBed = createPerformanceTestBed();
    performanceTracker = performanceTestBed.createPerformanceTracker();

    // Create a proper mock Error constructor that the enricher will actually use
    mockErrorConstructor = jest.fn();
    
    enricher = new LogMetadataEnricher({
      level: 'standard',
      enableSource: true,
      enablePerformance: true,
      enableBrowser: false,
      ErrorConstructor: mockErrorConstructor, // Pass our mock to the constructor
    });
  });

  afterEach(() => {
    performanceTestBed.cleanup();
  });

  describe('Source Category Detection Performance', () => {
    it('should detect source category within 2ms', () => {
      const stack = `Error
    at LogMetadataEnricher.enrichLogEntry (/src/logging/logMetadataEnricher.js:150:5)
    at RemoteLogger.log (/src/logging/remoteLogger.js:120:10)
    at ConsoleLogger.info (/src/logging/consoleLogger.js:45:8)
    at TestClass.method (/home/user/project/src/actions/userActions.js:10:15)
    at Module._compile (module.js:456:26)`;

      mockErrorConstructor.mockImplementation(() => ({ stack }));

      const iterations = 1000;
      const logEntry = {
        level: 'info',
        message: 'Performance test',
        timestamp: Date.now(),
      };

      const benchmark = performanceTracker.startBenchmark('source-category-detection');

      for (let i = 0; i < iterations; i++) {
        enricher.enrichLogEntrySync(logEntry);
      }

      const metrics = benchmark.end();
      const avgTime = metrics.totalTime / iterations;

      // Should be under 2ms per call (with environment adjustment)
      const timeThreshold = BASELINE_THRESHOLDS.categoryDetection * timingMultipliers.timeoutMultiplier;
      expect(avgTime).toBeLessThan(timeThreshold);
    });

    it('should efficiently handle large stack traces', () => {
      // Create a large stack trace with 100 frames, starting with internal logging frames
      const frames = [
        '    at LogMetadataEnricher.enrichLogEntry (/src/logging/logMetadataEnricher.js:150:5)',
        '    at RemoteLogger.log (/src/logging/remoteLogger.js:120:10)',
        '    at ConsoleLogger.info (/src/logging/consoleLogger.js:45:8)',
        '    at TestClass.method (/home/user/project/src/actions/userActions.js:100:15)', // This will be the first non-internal frame processed at index 4
      ];
      for (let i = 0; i < 100; i++) {
        frames.push(`    at function${i} (file${i}.js:${i}:10)`);
      }
      
      const largeStack = `Error\n${frames.join('\n')}`;

      mockErrorConstructor.mockImplementation(() => ({ stack: largeStack }));

      const logEntry = {
        level: 'info',
        message: 'Large stack test',
        timestamp: Date.now(),
      };

      const benchmark = performanceTracker.startBenchmark('large-stack-processing');
      const enriched = enricher.enrichLogEntrySync(logEntry);
      const metrics = benchmark.end();

      expect(enriched.sourceCategory).toBe('actions');
      
      // Should handle large stacks quickly (with environment adjustment)
      const timeThreshold = BASELINE_THRESHOLDS.largeStackProcessing * timingMultipliers.timeoutMultiplier;
      expect(metrics.totalTime).toBeLessThan(timeThreshold);
    });
  });

  describe('Category Detection Scalability', () => {
    it('should perform category detection efficiently across different categories', () => {
      const testCases = [
        {
          path: '/home/user/project/src/actions/userActions.js:10:15',
          category: 'actions',
        },
        {
          path: '/home/user/project/src/logic/operationHandlers/modifyContextArrayHandler.js:50:10',
          category: 'logic',
        },
        {
          path: '/home/user/project/src/entities/managers/EntityQueryManager.js:125:8',
          category: 'entities',
        },
        {
          path: '/home/user/project/src/domUI/renderers/portraitModalRenderer.js:200:15',
          category: 'domUI',
        },
        {
          path: '/home/user/project/src/scopeDsl/nodes/filterResolver.js:75:20',
          category: 'scopeDsl',
        },
      ];

      testCases.forEach(({ path, category }) => {
        const stack = `Error
    at LogMetadataEnricher.enrichLogEntry (/src/logging/logMetadataEnricher.js:150:5)
    at RemoteLogger.log (/src/logging/remoteLogger.js:120:10)
    at ConsoleLogger.info (/src/logging/consoleLogger.js:45:8)
    at TestClass.method (${path})`;

        mockErrorConstructor.mockImplementation(() => ({ stack }));

        const logEntry = {
          level: 'info',
          message: `Test from ${category}`,
          timestamp: Date.now(),
        };

        const iterations = 500;
        const benchmark = performanceTracker.startBenchmark(`category-${category}`);

        for (let i = 0; i < iterations; i++) {
          const enriched = enricher.enrichLogEntrySync(logEntry);
          expect(enriched.sourceCategory).toBe(category);
        }

        const metrics = benchmark.end();
        const avgTime = metrics.totalTime / iterations;
        
        // Each category should be detected efficiently
        const categoryTimeThreshold = BASELINE_THRESHOLDS.categoryDetection * timingMultipliers.timeoutMultiplier;
        expect(avgTime).toBeLessThan(categoryTimeThreshold);
      });
    });
  });
});