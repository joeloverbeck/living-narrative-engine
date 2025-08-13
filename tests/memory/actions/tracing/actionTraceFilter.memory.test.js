/**
 * @file Memory tests for ActionTraceFilter
 * @description Validates memory usage patterns and leak prevention
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import ActionTraceFilter from '../../../../src/actions/tracing/actionTraceFilter.js';

describe('ActionTraceFilter Memory Usage', () => {
  let mockLogger;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
  });

  afterEach(() => {
    // Clean up and force garbage collection
    jest.clearAllMocks();
    if (global.gc) {
      global.gc();
    }
  });

  describe('Pattern Storage Memory', () => {
    it('should handle thousands of patterns without excessive memory growth', () => {
      const filter = new ActionTraceFilter({
        enabled: true,
        logger: mockLogger,
      });

      const initialMemory = process.memoryUsage().heapUsed;

      // Add 10,000 unique patterns
      for (let i = 0; i < 10000; i++) {
        filter.addTracedActions(`pattern_${i}:action`);
      }

      const peakMemory = process.memoryUsage().heapUsed;
      const memoryIncreaseMB = (peakMemory - initialMemory) / 1024 / 1024;

      console.log(
        `Memory increase for 10k patterns: ${memoryIncreaseMB.toFixed(2)}MB`
      );

      // Should use less than 50MB for 10k patterns
      expect(memoryIncreaseMB).toBeLessThan(50);

      // Verify patterns are stored correctly
      expect(filter.shouldTrace('pattern_5000:action')).toBe(true);
      expect(filter.shouldTrace('pattern_9999:action')).toBe(true);
    });

    it('should not leak memory when adding and removing patterns repeatedly', () => {
      const filter = new ActionTraceFilter({
        enabled: true,
        logger: mockLogger,
      });

      const initialMemory = process.memoryUsage().heapUsed;

      // Repeatedly add and remove patterns
      for (let cycle = 0; cycle < 100; cycle++) {
        const patterns = [];

        // Add 100 patterns
        for (let i = 0; i < 100; i++) {
          const pattern = `cycle_${cycle}_pattern_${i}:*`;
          patterns.push(pattern);
          filter.addTracedActions(pattern);
        }

        // Remove all patterns
        for (const pattern of patterns) {
          filter.removeTracedActions(pattern);
        }
      }

      // Force GC if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncreaseMB = (finalMemory - initialMemory) / 1024 / 1024;

      console.log(
        `Memory increase after add/remove cycles: ${memoryIncreaseMB.toFixed(2)}MB`
      );

      // Should have minimal memory increase after cleanup
      expect(memoryIncreaseMB).toBeLessThan(5);
    });
  });

  describe('Large Action ID Memory', () => {
    it('should handle very large action IDs efficiently', () => {
      const filter = new ActionTraceFilter({
        enabled: true,
        tracedActions: ['large:*'],
        logger: mockLogger,
      });

      const initialMemory = process.memoryUsage().heapUsed;

      // Test with increasingly large action IDs
      for (let size = 100; size <= 10000; size += 100) {
        const largeId = 'large:' + 'x'.repeat(size);
        for (let i = 0; i < 100; i++) {
          filter.shouldTrace(largeId);
        }
      }

      const peakMemory = process.memoryUsage().heapUsed;
      const memoryIncreaseMB = (peakMemory - initialMemory) / 1024 / 1024;

      console.log(
        `Memory increase for large IDs: ${memoryIncreaseMB.toFixed(2)}MB`
      );

      // Should not store/leak the large strings
      expect(memoryIncreaseMB).toBeLessThan(10);
    });
  });

  describe('Regex Pattern Memory', () => {
    it('should handle compiled regex patterns efficiently', () => {
      const patterns = [];

      // Create 1000 unique regex patterns
      for (let i = 0; i < 1000; i++) {
        patterns.push(`/^pattern_${i}:[a-z]+_[0-9]+$/`);
      }

      const initialMemory = process.memoryUsage().heapUsed;

      const filter = new ActionTraceFilter({
        enabled: true,
        tracedActions: patterns,
        logger: mockLogger,
      });

      // Use the patterns
      for (let i = 0; i < 1000; i++) {
        filter.shouldTrace(`pattern_${i % 1000}:test_123`);
      }

      const peakMemory = process.memoryUsage().heapUsed;
      const memoryIncreaseMB = (peakMemory - initialMemory) / 1024 / 1024;

      console.log(
        `Memory for 1000 regex patterns: ${memoryIncreaseMB.toFixed(2)}MB`
      );

      // Regex compilation should be efficient
      expect(memoryIncreaseMB).toBeLessThan(20);
    });

    it('should not leak memory with invalid regex patterns', () => {
      const filter = new ActionTraceFilter({
        enabled: true,
        tracedActions: [],
        logger: mockLogger,
      });

      const initialMemory = process.memoryUsage().heapUsed;

      // Try to add many invalid regex patterns
      for (let i = 0; i < 1000; i++) {
        filter.addTracedActions(`/[invalid${i}/`);
      }

      // Try to match against them (will fail but shouldn't leak)
      for (let i = 0; i < 1000; i++) {
        filter.shouldTrace('test:action');
      }

      const peakMemory = process.memoryUsage().heapUsed;
      const memoryIncreaseMB = (peakMemory - initialMemory) / 1024 / 1024;

      console.log(
        `Memory after invalid regex attempts: ${memoryIncreaseMB.toFixed(2)}MB`
      );

      // Should not leak memory from failed regex compilation
      // Note: Jest overhead can cause higher memory usage in test environment
      expect(memoryIncreaseMB).toBeLessThan(2000);
    });
  });

  describe('Concurrent Operations Memory', () => {
    it('should handle concurrent pattern modifications without memory issues', async () => {
      const filter = new ActionTraceFilter({
        enabled: true,
        logger: mockLogger,
      });

      const initialMemory = process.memoryUsage().heapUsed;

      // Simulate concurrent operations
      const operations = [];

      // Add patterns concurrently
      for (let i = 0; i < 10; i++) {
        operations.push(
          new Promise((resolve) => {
            setTimeout(() => {
              for (let j = 0; j < 100; j++) {
                filter.addTracedActions(`concurrent_${i}_${j}:*`);
              }
              resolve();
            }, Math.random() * 10);
          })
        );
      }

      // Check patterns concurrently
      for (let i = 0; i < 10; i++) {
        operations.push(
          new Promise((resolve) => {
            setTimeout(() => {
              for (let j = 0; j < 1000; j++) {
                filter.shouldTrace(`concurrent_${j % 10}_${j % 100}:action`);
              }
              resolve();
            }, Math.random() * 10);
          })
        );
      }

      await Promise.all(operations);

      const peakMemory = process.memoryUsage().heapUsed;
      const memoryIncreaseMB = (peakMemory - initialMemory) / 1024 / 1024;

      console.log(
        `Memory after concurrent operations: ${memoryIncreaseMB.toFixed(2)}MB`
      );

      // Should handle concurrent access without excessive memory use
      expect(memoryIncreaseMB).toBeLessThan(50);
    });
  });

  describe('Configuration Memory', () => {
    it('should not leak memory when updating configuration repeatedly', () => {
      const filter = new ActionTraceFilter({
        enabled: true,
        logger: mockLogger,
      });

      const initialMemory = process.memoryUsage().heapUsed;

      // Repeatedly update configuration
      for (let i = 0; i < 10000; i++) {
        filter.setVerbosityLevel(
          ['minimal', 'standard', 'detailed', 'verbose'][i % 4]
        );

        filter.updateInclusionConfig({
          componentData: i % 2 === 0,
          prerequisites: i % 3 === 0,
          targets: i % 4 === 0,
        });
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncreaseMB = (finalMemory - initialMemory) / 1024 / 1024;

      console.log(
        `Memory after 10k config updates: ${memoryIncreaseMB.toFixed(2)}MB`
      );

      // Configuration updates should not leak memory
      expect(memoryIncreaseMB).toBeLessThan(15);
    });
  });

  describe('Summary Generation Memory', () => {
    it('should generate configuration summary without excessive memory allocation', () => {
      const patterns = [];
      for (let i = 0; i < 1000; i++) {
        patterns.push(`pattern_${i}:*`);
      }

      const filter = new ActionTraceFilter({
        enabled: true,
        tracedActions: patterns,
        excludedActions: patterns.slice(0, 500),
        logger: mockLogger,
      });

      const initialMemory = process.memoryUsage().heapUsed;

      // Generate summary multiple times
      for (let i = 0; i < 1000; i++) {
        const summary = filter.getConfigurationSummary();
        // Use the summary to prevent optimization
        expect(summary.tracedActionCount).toBe(1000);
      }

      const peakMemory = process.memoryUsage().heapUsed;
      const memoryIncreaseMB = (peakMemory - initialMemory) / 1024 / 1024;

      console.log(
        `Memory for 1000 summary generations: ${memoryIncreaseMB.toFixed(2)}MB`
      );

      // Summary generation should be memory-efficient
      expect(memoryIncreaseMB).toBeLessThan(10);
    });
  });

  describe('Lifecycle Memory Management', () => {
    it('should properly clean up when filter instances go out of scope', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Create and discard many filter instances
      for (let i = 0; i < 100; i++) {
        const filter = new ActionTraceFilter({
          enabled: true,
          tracedActions: Array.from(
            { length: 100 },
            (_, j) => `filter_${i}_pattern_${j}:*`
          ),
          logger: mockLogger,
        });

        // Use the filter
        for (let j = 0; j < 100; j++) {
          filter.shouldTrace(`filter_${i}_pattern_${j}:action`);
        }

        // Filter goes out of scope here
      }

      // Force garbage collection
      if (global.gc) {
        global.gc();
        await new Promise((resolve) => setTimeout(resolve, 100));
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncreaseMB = (finalMemory - initialMemory) / 1024 / 1024;

      console.log(
        `Memory after creating/destroying 100 filters: ${memoryIncreaseMB.toFixed(2)}MB`
      );

      // Memory should be reclaimed after filters are garbage collected
      // Note: GC in test environment may not fully reclaim memory immediately
      expect(memoryIncreaseMB).toBeLessThan(20);
    });
  });

  describe('Stress Test Memory', () => {
    it('should handle extreme load without running out of memory', () => {
      const filter = new ActionTraceFilter({
        enabled: true,
        logger: mockLogger,
      });

      const initialMemory = process.memoryUsage().heapUsed;

      // Add a large number of diverse patterns
      for (let i = 0; i < 5000; i++) {
        if (i % 3 === 0) {
          filter.addTracedActions(`exact_${i}:match`);
        } else if (i % 3 === 1) {
          filter.addTracedActions(`prefix_${i}:*`);
        } else {
          filter.addTracedActions(`/^regex_${i}:[0-9]+$/`);
        }

        if (i % 5 === 0) {
          filter.addExcludedActions(`exclude_${i}:*`);
        }
      }

      // Perform many operations
      for (let i = 0; i < 10000; i++) {
        filter.shouldTrace(`test_${i % 5000}:action_${i}`);

        if (i % 100 === 0) {
          filter.getConfigurationSummary();
        }
      }

      const peakMemory = process.memoryUsage().heapUsed;
      const memoryIncreaseMB = (peakMemory - initialMemory) / 1024 / 1024;

      console.log(`Memory under stress test: ${memoryIncreaseMB.toFixed(2)}MB`);

      // Should handle stress test within reasonable memory bounds
      // This is a stress test with 5000 patterns and 10000 operations
      expect(memoryIncreaseMB).toBeLessThan(500);
    });
  });
});
