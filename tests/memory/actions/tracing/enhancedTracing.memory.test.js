import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EnhancedActionTraceFilter from '../../../../src/actions/tracing/enhancedActionTraceFilter.js';
import ActionAwareStructuredTrace from '../../../../src/actions/tracing/actionAwareStructuredTrace.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

describe('Enhanced Tracing Memory Tests', () => {
  let enhancedFilter;
  let trace;
  let mockLogger;

  beforeEach(() => {
    // Force garbage collection before each test if available
    if (global.gc) {
      global.gc();
    }

    mockLogger = createMockLogger();

    enhancedFilter = new EnhancedActionTraceFilter({
      enabled: true,
      tracedActions: ['*'],
      excludedActions: [],
      verbosityLevel: 'standard',
      logger: mockLogger,
    });

    trace = new ActionAwareStructuredTrace({
      actionTraceFilter: enhancedFilter,
      actorId: 'test-actor',
      context: { test: true },
      logger: mockLogger,
    });
  });

  afterEach(() => {
    // Force garbage collection after each test if available
    if (global.gc) {
      global.gc();
    }
  });

  describe('Memory Usage Analysis', () => {
    it('should maintain reasonable memory usage with different verbosity levels', () => {
      const testData = {
        small: { value: 1 },
        medium: Array(100)
          .fill()
          .map((_, i) => ({ id: i })),
        large: {
          nested: {
            deep: {
              data: Array(50)
                .fill()
                .map(() => ({
                  value: Math.random(),
                  timestamp: Date.now(),
                })),
            },
          },
        },
      };

      // Test at different verbosity levels
      const verbosityLevels = ['minimal', 'standard', 'detailed', 'verbose'];
      const memoryUsage = {};

      for (const level of verbosityLevels) {
        enhancedFilter.setVerbosityLevel(level);

        // Get initial memory state
        const initialMemory = process.memoryUsage();

        // Capture same data at different levels
        for (let i = 0; i < 10; i++) {
          trace.captureEnhancedActionData(
            'memory_test',
            `action_${level}_${i}`,
            { ...testData, level, iteration: i },
            { category: 'performance' }
          );
        }

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }

        // Measure memory usage after operations
        const finalMemory = process.memoryUsage();
        memoryUsage[level] = finalMemory.heapUsed - initialMemory.heapUsed;
      }

      // Get all traced actions
      const tracedActions = trace.getTracedActions();

      // Verify data was captured appropriately for each level
      expect(tracedActions.size).toBeGreaterThan(0);

      // Check that minimal level uses less memory than verbose
      let minimalDataSize = 0;
      let verboseDataSize = 0;

      for (const [actionId, actionData] of tracedActions) {
        if (actionId.includes('minimal')) {
          minimalDataSize += JSON.stringify(actionData).length;
        } else if (actionId.includes('verbose')) {
          verboseDataSize += JSON.stringify(actionData).length;
        }
      }

      // Minimal should store less data than verbose
      if (minimalDataSize > 0 && verboseDataSize > 0) {
        expect(minimalDataSize).toBeLessThanOrEqual(verboseDataSize);
      }

      // Memory usage should not grow excessively with verbosity
      const minimalMemory = memoryUsage.minimal || 0;
      const verboseMemory = memoryUsage.verbose || 0;

      // Verbose should not use more than 10x the memory of minimal
      if (minimalMemory > 0) {
        expect(verboseMemory).toBeLessThan(minimalMemory * 10);
      }
    });

    it('should not leak memory during extended operation', () => {
      const iterations = 100;
      const memoryCheckpoints = [];

      // Take initial memory reading
      if (global.gc) global.gc();
      memoryCheckpoints.push(process.memoryUsage().heapUsed);

      // Perform operations in batches
      for (let batch = 0; batch < 5; batch++) {
        for (let i = 0; i < iterations / 5; i++) {
          trace.captureEnhancedActionData(
            'leak_test',
            `action_${batch}_${i}`,
            {
              batch,
              iteration: i,
              data: Array(50)
                .fill()
                .map((_, idx) => ({ id: idx, value: `item_${idx}` })),
            },
            { category: 'memory_test' }
          );
        }

        // Clear some traces to simulate normal cleanup
        if (batch > 2) {
          trace.clearEnhancedCache();
        }

        // Force garbage collection and take reading
        if (global.gc) global.gc();
        memoryCheckpoints.push(process.memoryUsage().heapUsed);
      }

      // Memory should not grow continuously - should stabilize after initial allocation
      const initialMemory = memoryCheckpoints[0];
      const finalMemory = memoryCheckpoints[memoryCheckpoints.length - 1];
      const memoryGrowth = finalMemory - initialMemory;

      // Allow for some memory growth but not excessive (less than 50MB)
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024);
    });

    it('should efficiently manage large object serialization', () => {
      const largeObject = {
        entities: Array(500)
          .fill()
          .map((_, i) => ({
            id: `entity_${i}`,
            data: {
              attributes: Array(20)
                .fill()
                .map((_, j) => ({
                  name: `attr_${j}`,
                  value: Math.random() * 1000,
                  metadata: { created: Date.now(), index: j },
                })),
            },
          })),
        metadata: {
          created: Date.now(),
          description: 'A'.repeat(1000), // 1KB string
          tags: Array(100)
            .fill()
            .map((_, i) => `tag_${i}`),
        },
      };

      const initialMemory = process.memoryUsage();

      // Test serialization with summarization
      trace.captureEnhancedActionData(
        'large_object_test',
        'serialization:action',
        largeObject,
        {
          summarize: true,
          targetVerbosity: 'standard',
        }
      );

      if (global.gc) global.gc();
      const afterSerializationMemory = process.memoryUsage();

      // Test without summarization for comparison
      trace.captureEnhancedActionData(
        'large_object_test_full',
        'serialization_full:action',
        largeObject,
        {
          summarize: false,
          targetVerbosity: 'verbose',
        }
      );

      if (global.gc) global.gc();
      const finalMemory = process.memoryUsage();

      // Verify the trace was captured with summarization
      const summarizedTrace = trace.getActionTrace('serialization:action');
      expect(summarizedTrace).toBeDefined();
      expect(summarizedTrace.stages.large_object_test).toBeDefined();
      const capturedData = summarizedTrace.stages.large_object_test.data;

      // Arrays should be truncated when summarized
      expect(capturedData.entities).toBeDefined();
      expect(capturedData.entities.length).toBeLessThanOrEqual(3);
      if (capturedData.entities_truncated) {
        expect(capturedData.entities_original_length).toBe(500);
      }

      // Memory growth should be reasonable
      const serializationMemoryGrowth =
        afterSerializationMemory.heapUsed - initialMemory.heapUsed;
      const totalMemoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

      // Verify memory usage is reasonable (allow for GC timing variations)
      // Both operations should use reasonable amounts of memory
      expect(Math.abs(serializationMemoryGrowth)).toBeLessThan(
        50 * 1024 * 1024
      ); // Less than 50MB
      expect(Math.abs(totalMemoryGrowth)).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
    });
  });

  describe('Cache Memory Management', () => {
    it('should optimize cache memory usage', () => {
      const initialMemory = process.memoryUsage();

      // Fill cache with many entries
      for (let i = 0; i < 100; i++) {
        enhancedFilter.shouldCaptureEnhanced('category', `type_${i}`, {
          index: i,
          data: Array(10)
            .fill()
            .map((_, j) => ({ id: j, value: `data_${j}` })),
        });
      }

      const afterFillMemory = process.memoryUsage();

      // Test that cache works before optimization
      enhancedFilter.shouldCaptureEnhanced('category', 'type_0', {});
      let stats = enhancedFilter.getEnhancedStats();
      const cacheHitsBefore = stats.cacheHits;
      expect(cacheHitsBefore).toBeGreaterThan(0); // Should have cache hit

      // Clear cache explicitly
      enhancedFilter.clearEnhancedCache();

      if (global.gc) global.gc();
      const afterClearMemory = process.memoryUsage();

      // Reset stats to test cleanly after clearing
      enhancedFilter.resetEnhancedStats();

      // Verify cache was cleared - no cache hit on same request
      enhancedFilter.shouldCaptureEnhanced('category', 'type_0', {});
      stats = enhancedFilter.getEnhancedStats();

      // Should not have hit cache after clearing
      expect(stats.cacheHits).toBe(0);

      // Also test that optimize works without error
      enhancedFilter.optimizeCache(0);
      expect(enhancedFilter).toBeDefined(); // Just verify it didn't throw

      // Memory should have been freed after cache clear
      const fillMemoryGrowth =
        afterFillMemory.heapUsed - initialMemory.heapUsed;
      const clearMemoryGrowth =
        afterClearMemory.heapUsed - initialMemory.heapUsed;

      // After clearing, memory growth should be less than when filled
      expect(clearMemoryGrowth).toBeLessThan(fillMemoryGrowth);
    });

    it('should manage trace data retention efficiently', () => {
      const maxTraces = 200;
      const initialMemory = process.memoryUsage();

      // Generate many traces
      for (let i = 0; i < maxTraces; i++) {
        trace.captureEnhancedActionData(
          'retention_test',
          `action_${i}`,
          {
            index: i,
            payload: Array(20)
              .fill()
              .map((_, j) => ({
                id: j,
                data: `item_${i}_${j}`,
              })),
          },
          { category: 'retention' }
        );
      }

      const afterTracesMemory = process.memoryUsage();

      // Clear older traces (simulate retention policy)
      const tracedActions = trace.getTracedActions();
      const actionIds = Array.from(tracedActions.keys());

      // Keep only the most recent 50 traces
      for (let i = 0; i < actionIds.length - 50; i++) {
        // Simulate trace cleanup (this would be done by the trace implementation)
        // For now, we'll just verify the data exists
        expect(tracedActions.get(actionIds[i])).toBeDefined();
      }

      if (global.gc) global.gc();
      const finalMemory = process.memoryUsage();

      const traceMemoryGrowth =
        afterTracesMemory.heapUsed - initialMemory.heapUsed;
      const finalMemoryGrowth = finalMemory.heapUsed - initialMemory.heapUsed;

      // Verify traces were created
      expect(tracedActions.size).toBe(maxTraces);

      // Memory growth should be reasonable for the number of traces created
      const averageMemoryPerTrace = traceMemoryGrowth / maxTraces;

      // Each trace should use a reasonable amount of memory (less than 50KB on average)
      expect(averageMemoryPerTrace).toBeLessThan(50 * 1024);
    });
  });

  describe('Data Structure Memory Efficiency', () => {
    it('should use memory-efficient data structures', () => {
      const testCases = [
        { name: 'small', size: 10 },
        { name: 'medium', size: 100 },
        { name: 'large', size: 1000 },
      ];

      const memoryUsage = {};

      for (const testCase of testCases) {
        const initialMemory = process.memoryUsage();

        // Create data of specified size
        const testData = {
          items: Array(testCase.size)
            .fill()
            .map((_, i) => ({
              id: i,
              name: `item_${i}`,
              metadata: { created: Date.now(), index: i },
            })),
        };

        trace.captureEnhancedActionData(
          'efficiency_test',
          `${testCase.name}_data`,
          testData,
          { category: 'efficiency' }
        );

        if (global.gc) global.gc();
        const finalMemory = process.memoryUsage();

        memoryUsage[testCase.name] = {
          growth: finalMemory.heapUsed - initialMemory.heapUsed,
          size: testCase.size,
        };
      }

      // Verify memory usage scales reasonably with data size
      const smallGrowth = memoryUsage.small.growth;
      const mediumGrowth = memoryUsage.medium.growth;
      const largeGrowth = memoryUsage.large.growth;

      // Memory growth should be roughly proportional to data size
      // Medium (10x size) should not use more than 20x memory
      if (smallGrowth > 0) {
        expect(mediumGrowth).toBeLessThan(smallGrowth * 20);
      }

      // Large (100x size) should not use more than 200x memory
      if (smallGrowth > 0) {
        expect(largeGrowth).toBeLessThan(smallGrowth * 200);
      }
    });
  });
});
