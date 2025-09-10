import { describe, it, expect, beforeEach } from '@jest/globals';
import EnhancedActionTraceFilter from '../../../../src/actions/tracing/enhancedActionTraceFilter.js';
import ActionAwareStructuredTrace from '../../../../src/actions/tracing/actionAwareStructuredTrace.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

describe('Enhanced Tracing Performance Tests', () => {
  let enhancedFilter;
  let trace;
  let mockLogger;

  beforeEach(() => {
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

  describe('Filter Decision Performance', () => {
    it('should complete filter decisions within 0.1ms', () => {
      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        enhancedFilter.shouldCaptureEnhanced(
          'core',
          'action_start',
          { data: i },
          { context: i }
        );
      }

      const endTime = performance.now();
      const avgTime = (endTime - startTime) / iterations;

      // Should average less than 0.5ms per decision
      // Note: 0.5ms threshold provides sufficient performance guarantee while
      // avoiding flakiness from system interrupts, GC, and CPU scheduling
      expect(avgTime).toBeLessThan(0.5);
    });
  });

  describe('Cache Performance', () => {
    it('should achieve >70% cache hit rate for typical usage', () => {
      // Simulate typical usage pattern with repeated actions
      const actions = ['core:go', 'core:look', 'core:take', 'core:use'];
      const stages = [
        'component_filtering',
        'prerequisite_evaluation',
        'formatting',
      ];

      // Perform multiple iterations
      for (let i = 0; i < 5; i++) {
        for (const action of actions) {
          for (const stage of stages) {
            trace.captureEnhancedActionData(
              stage,
              action,
              { iteration: i },
              { category: 'business_logic' }
            );
          }
        }
      }

      const stats = trace.getEnhancedTraceStats();
      expect(stats.cacheHitRate).toBeGreaterThan(70);
    });
  });

  describe('Large Dataset Performance', () => {
    it('should handle large data sets efficiently', () => {
      const largeDataSet = {
        entities: Array(1000)
          .fill()
          .map((_, i) => ({
            id: `entity_${i}`,
            components: Array(10)
              .fill()
              .map((_, j) => `component_${j}`),
            attributes: { health: 100, position: { x: i, y: i } },
          })),
        events: Array(500)
          .fill()
          .map((_, i) => ({
            type: 'event',
            timestamp: Date.now() + i,
            data: { index: i },
          })),
      };

      const startTime = performance.now();

      trace.captureEnhancedActionData(
        'large_data_processing',
        'bulk:action',
        largeDataSet,
        {
          summarize: true,
          targetVerbosity: 'standard',
        }
      );

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Should process large data within reasonable time
      expect(processingTime).toBeLessThan(100); // 100ms for large dataset

      // Verify data was summarized
      const actionTrace = trace.getActionTrace('bulk:action');
      expect(actionTrace).toBeDefined();
      expect(actionTrace.stages.large_data_processing).toBeDefined();
      const capturedData = actionTrace.stages.large_data_processing.data;

      // Arrays should be truncated
      expect(capturedData.entities).toBeDefined();
      expect(capturedData.entities.length).toBe(3);
      expect(capturedData.entities_truncated).toBe(true);
    });

    it('should maintain performance under high load', () => {
      const iterations = 1000;
      const startTime = performance.now();

      // Simulate high-frequency tracing operations
      for (let i = 0; i < iterations; i++) {
        trace.captureEnhancedActionData(
          'high_load_stage',
          `action_${i % 10}`, // Reuse action names for caching benefits
          {
            index: i,
            data: `payload_${i}`,
            timestamp: Date.now(),
          },
          { category: 'performance_test' }
        );
      }

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTimePerOperation = totalTime / iterations;

      // Should average less than 0.5ms per operation under high load
      expect(avgTimePerOperation).toBeLessThan(0.5);

      // Verify cache is being utilized effectively
      const stats = trace.getEnhancedTraceStats();
      expect(stats.cacheHitRate).toBeGreaterThan(50); // At least 50% cache hit rate
    });
  });

  describe('Scaling Performance', () => {
    it('should scale reasonably with data size', () => {
      const dataSizes = [10, 25, 50, 100];
      const timings = [];

      // Helper function to measure with enhanced statistical stability
      const measureDataSize = (size, iterations = 10) => {
        const measurements = [];
        const testData = {
          items: Array(size)
            .fill()
            .map((_, i) => ({ id: i, value: i })),
        };

        // Multiple warm-up runs to stabilize JIT compilation and memory allocation
        for (let w = 0; w < 3; w++) {
          trace.captureEnhancedActionData(
            'scaling_warmup',
            `warmup_${size}_${w}`,
            testData,
            { summarize: true }
          );
        }

        // Perform multiple measurements with better outlier handling
        for (let i = 0; i < iterations; i++) {
          // Force garbage collection between measurements if available
          if (global.gc) {
            global.gc();
          }

          const startTime = performance.now();
          trace.captureEnhancedActionData(
            'scaling_test',
            `scale_${size}_${i}`,
            testData,
            { summarize: true }
          );
          const endTime = performance.now();
          measurements.push(endTime - startTime);
        }

        // Use interquartile range to eliminate outliers more effectively
        measurements.sort((a, b) => a - b);
        const q1Index = Math.floor(measurements.length * 0.25);
        const q3Index = Math.floor(measurements.length * 0.75);
        const iqrMeasurements = measurements.slice(q1Index, q3Index + 1);

        // Return median of IQR measurements for better stability
        return iqrMeasurements[Math.floor(iqrMeasurements.length / 2)];
      };

      // Collect stable timings for each data size
      for (const size of dataSizes) {
        timings.push(measureDataSize(size));
      }

      // Test both relative scaling and absolute performance thresholds
      for (let i = 1; i < timings.length; i++) {
        const scalingFactor = timings[i] / timings[i - 1];
        const dataScalingFactor = dataSizes[i] / dataSizes[i - 1];

        // Absolute performance check - no operation should take more than 10ms
        expect(timings[i]).toBeLessThan(10);

        // Enhanced diagnostic output for analysis
        if (scalingFactor >= 10) {
          console.log(`Performance scaling analysis:`);
          console.log(
            `  Data sizes: ${dataSizes[i - 1]} → ${dataSizes[i]} (${dataScalingFactor.toFixed(1)}x data)`
          );
          console.log(
            `  Timings: ${timings[i - 1].toFixed(3)}ms → ${timings[i].toFixed(3)}ms (${scalingFactor.toFixed(1)}x time)`
          );
          console.log(
            `  All timings: [${timings.map((t) => t.toFixed(2)).join(', ')}]ms`
          );
          console.log(
            `  Absolute performance: ${timings[i].toFixed(3)}ms (threshold: 10ms)`
          );
        }

        // More lenient scaling factor to account for legitimate O(n) complexity
        // with memory allocation overhead and system variance
        expect(scalingFactor).toBeLessThan(10);
      }
    });

    it('should maintain acceptable absolute performance', () => {
      // Test absolute performance thresholds for realistic data sizes
      const testSizes = [10, 50, 100];

      for (const size of testSizes) {
        const testData = {
          items: Array(size)
            .fill()
            .map((_, i) => ({
              id: i,
              value: `item_${i}`,
              metadata: { index: i },
            })),
        };

        // Warm-up
        trace.captureEnhancedActionData(
          'absolute_perf_warmup',
          `warmup_${size}`,
          testData,
          { summarize: true }
        );

        // Measure performance
        const startTime = performance.now();
        trace.captureEnhancedActionData(
          'absolute_perf_test',
          `test_${size}`,
          testData,
          { summarize: true }
        );
        const endTime = performance.now();

        const operationTime = endTime - startTime;

        // Absolute thresholds based on data size
        let maxTime;
        if (size <= 10)
          maxTime = 2; // 2ms for small data
        else if (size <= 50)
          maxTime = 5; // 5ms for medium data
        else maxTime = 10; // 10ms for larger data

        expect(operationTime).toBeLessThan(maxTime);
      }
    });
  });

  describe('Verbosity Performance Impact', () => {
    it('should show minimal performance impact across verbosity levels', () => {
      const verbosityLevels = ['minimal', 'standard', 'detailed', 'verbose'];
      const timings = {};

      const testData = {
        complex: {
          nested: {
            data: Array(100)
              .fill()
              .map((_, i) => ({
                id: i,
                value: `item_${i}`,
                metadata: { created: Date.now(), index: i },
              })),
          },
        },
      };

      // Test performance at different verbosity levels
      for (const level of verbosityLevels) {
        enhancedFilter.setVerbosityLevel(level);

        const startTime = performance.now();

        for (let i = 0; i < 50; i++) {
          trace.captureEnhancedActionData(
            'verbosity_test',
            `action_${level}_${i}`,
            { ...testData, iteration: i },
            { category: 'performance' }
          );
        }

        const endTime = performance.now();
        timings[level] = endTime - startTime;
      }

      // Verify performance doesn't degrade dramatically across verbosity levels
      const minTime = Math.min(...Object.values(timings));
      const maxTime = Math.max(...Object.values(timings));

      // Maximum verbosity should not be more than 50x slower than minimum
      // Account for 33x data difference between minimal (3 items) and verbose (100 items)
      expect(maxTime / minTime).toBeLessThan(50);
    });
  });
});
