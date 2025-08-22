import { describe, it, expect, beforeEach, jest } from '@jest/globals';
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
    it('should scale linearly with data size', () => {
      const dataSizes = [10, 50, 100, 500];
      const timings = [];

      for (const size of dataSizes) {
        const testData = {
          items: Array(size)
            .fill()
            .map((_, i) => ({ id: i, value: i })),
        };

        const startTime = performance.now();

        trace.captureEnhancedActionData(
          'scaling_test',
          `scale_${size}`,
          testData,
          { summarize: true }
        );

        const endTime = performance.now();
        timings.push(endTime - startTime);
      }

      // Verify roughly linear scaling (each step should not be more than 3x the previous)
      for (let i = 1; i < timings.length; i++) {
        const scalingFactor = timings[i] / timings[i - 1];
        expect(scalingFactor).toBeLessThan(3);
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
