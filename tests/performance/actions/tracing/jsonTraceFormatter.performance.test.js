/**
 * @file Performance tests for JsonTraceFormatter
 * @description Validates formatting efficiency and performance characteristics
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { JsonTraceFormatter } from '../../../../src/actions/tracing/jsonTraceFormatter.js';
import ActionTraceFilter from '../../../../src/actions/tracing/actionTraceFilter.js';
import { createMockLogger } from '../../../common/mockFactories/loggerMocks.js';

describe('JsonTraceFormatter Performance', () => {
  let formatter;
  let logger;
  let actionTraceFilter;

  beforeEach(() => {
    logger = createMockLogger();
    actionTraceFilter = new ActionTraceFilter({
      enabled: true,
      tracedActions: ['*'],
      excludedActions: [],
      verbosityLevel: 'standard',
      inclusionConfig: {
        componentData: false,
        prerequisites: false,
        targets: false,
      },
      logger,
    });

    formatter = new JsonTraceFormatter({
      logger,
      actionTraceFilter,
    });
  });

  describe('Large Trace Formatting Performance', () => {
    it('should handle large traces with 100 actions in <100ms', () => {
      const largeTracedActions = new Map();

      // Create a large number of actions
      for (let i = 0; i < 100; i++) {
        largeTracedActions.set(`action${i}`, {
          actionId: `action${i}`,
          actorId: `actor${i}`,
          startTime: Date.now() + i * 100,
          stages: {
            stage1: { timestamp: Date.now() + i * 100 },
            stage2: { timestamp: Date.now() + i * 100 + 50 },
          },
        });
      }

      const mockTrace = {
        getTracedActions: jest.fn(() => largeTracedActions),
        getSpans: jest.fn(() => []),
      };

      const startTime = performance.now();
      const result = JSON.parse(formatter.format(mockTrace));
      const duration = performance.now() - startTime;

      console.log(
        `Large trace (100 actions) formatting: ${duration.toFixed(2)}ms`
      );

      expect(result.actions).toBeDefined();
      expect(Object.keys(result.actions)).toHaveLength(100);
      expect(result.summary.totalActions).toBe(100);

      // Should complete in reasonable time (less than 100ms)
      expect(duration).toBeLessThan(100);
    });

    it('should handle very large traces with 1000 actions in <500ms', () => {
      const veryLargeTracedActions = new Map();

      // Create a very large number of actions
      for (let i = 0; i < 1000; i++) {
        veryLargeTracedActions.set(`action${i}`, {
          actionId: `action${i}`,
          actorId: `actor${i % 10}`,
          startTime: Date.now() + i * 10,
          stages: {
            component_filtering: {
              timestamp: Date.now() + i * 10,
              data: { candidateCount: i % 20 },
            },
            prerequisite_evaluation: {
              timestamp: Date.now() + i * 10 + 5,
              data: { passed: i % 2 === 0 },
            },
          },
        });
      }

      const mockTrace = {
        getTracedActions: jest.fn(() => veryLargeTracedActions),
        getSpans: jest.fn(() => []),
      };

      const startTime = performance.now();
      const result = JSON.parse(formatter.format(mockTrace));
      const duration = performance.now() - startTime;

      console.log(
        `Very large trace (1000 actions) formatting: ${duration.toFixed(2)}ms`
      );

      expect(result.actions).toBeDefined();
      expect(Object.keys(result.actions)).toHaveLength(1000);
      expect(result.summary.totalActions).toBe(1000);

      // Should complete in reasonable time (less than 500ms)
      expect(duration).toBeLessThan(500);
    });

    it('should maintain performance with complex nested data structures', () => {
      const complexTracedActions = new Map();

      // Create actions with complex nested data
      for (let i = 0; i < 50; i++) {
        complexTracedActions.set(`complex${i}`, {
          actionId: `complex${i}`,
          actorId: `actor${i}`,
          startTime: Date.now() + i * 100,
          stages: {
            component_filtering: {
              timestamp: Date.now() + i * 100,
              data: {
                actorComponents: Array(20)
                  .fill(null)
                  .map((_, j) => `component${j}`),
                requiredComponents: Array(10)
                  .fill(null)
                  .map((_, j) => `required${j}`),
                candidateCount: i * 2,
                metadata: {
                  nested: {
                    level1: {
                      level2: {
                        level3: {
                          data: Array(5)
                            .fill(null)
                            .map((_, j) => ({ id: j, value: `value${j}` })),
                        },
                      },
                    },
                  },
                },
              },
            },
            target_resolution: {
              timestamp: Date.now() + i * 100 + 50,
              data: {
                targetCount: (i % 5) + 1,
                isLegacy: false,
                resolvedTargets: Object.fromEntries(
                  Array((i % 5) + 1)
                    .fill(null)
                    .map((_, j) => [`target${j}`, `entity${i}_${j}`])
                ),
              },
            },
          },
        });
      }

      const mockTrace = {
        getTracedActions: jest.fn(() => complexTracedActions),
        getSpans: jest.fn(() => []),
      };

      actionTraceFilter.setVerbosityLevel('verbose');
      actionTraceFilter.updateInclusionConfig({
        componentData: true,
        prerequisites: true,
        targets: true,
      });

      const startTime = performance.now();
      const result = JSON.parse(formatter.format(mockTrace));
      const duration = performance.now() - startTime;

      console.log(
        `Complex nested data (50 actions) formatting: ${duration.toFixed(2)}ms`
      );

      expect(result.actions).toBeDefined();
      expect(Object.keys(result.actions)).toHaveLength(50);

      // Should handle complex data efficiently (less than 200ms for 50 complex actions)
      expect(duration).toBeLessThan(200);
    });

    it('should scale linearly with number of actions', () => {
      const measurements = [];
      const sizes = [10, 50, 100, 200, 500];

      // Warm-up run to stabilize performance measurements
      for (let warmup = 0; warmup < 3; warmup++) {
        const warmupTrace = new Map();
        for (let i = 0; i < 50; i++) {
          warmupTrace.set(`warmup${i}`, {
            actionId: `warmup${i}`,
            actorId: `actor${i % 3}`,
            startTime: Date.now(),
            stages: { formatting: { timestamp: Date.now() } },
          });
        }
        formatter.format({ 
          getTracedActions: () => warmupTrace, 
          getSpans: () => [] 
        });
      }

      for (const size of sizes) {
        const tracedActions = new Map();

        for (let i = 0; i < size; i++) {
          tracedActions.set(`action${i}`, {
            actionId: `action${i}`,
            actorId: `actor${i % 5}`,
            startTime: Date.now() + i * 10,
            stages: {
              formatting: {
                timestamp: Date.now() + i * 10,
                data: { formattedCommand: `command${i}` },
              },
            },
          });
        }

        const mockTrace = {
          getTracedActions: jest.fn(() => tracedActions),
          getSpans: jest.fn(() => []),
        };

        // Take median of 3 measurements to reduce environmental noise
        const durations = [];
        for (let run = 0; run < 3; run++) {
          const startTime = performance.now();
          formatter.format(mockTrace);
          const duration = performance.now() - startTime;
          durations.push(duration);
        }
        
        durations.sort((a, b) => a - b);
        const medianDuration = durations[1]; // Middle value
        
        measurements.push({ size, duration: medianDuration });
        console.log(`Trace size ${size}: ${medianDuration.toFixed(2)}ms (median of 3 runs)`);
      }

      // Check that performance scales reasonably (not exponentially)
      // The ratio of time increase should be roughly proportional to size increase
      const ratio100to10 = measurements[2].duration / measurements[0].duration;
      const sizeRatio = measurements[2].size / measurements[0].size; // 100/10 = 10

      console.log(
        `Performance ratio (100 vs 10 actions): ${ratio100to10.toFixed(2)}x for ${sizeRatio}x size increase`
      );

      // Performance should not degrade exponentially
      // Increased threshold to 30x to account for environmental variability
      // (GC timing, system load, measurement precision)
      // Linear scaling would be 10x, so 30x allows for reasonable variance
      expect(ratio100to10).toBeLessThan(30);
    });

    it('should handle frequent format calls efficiently', () => {
      const tracedActions = new Map();

      // Create a moderate-sized trace
      for (let i = 0; i < 20; i++) {
        tracedActions.set(`action${i}`, {
          actionId: `action${i}`,
          actorId: `actor${i % 3}`,
          startTime: Date.now() + i * 50,
          stages: {
            formatting: { timestamp: Date.now() + i * 50 },
          },
        });
      }

      const mockTrace = {
        getTracedActions: jest.fn(() => tracedActions),
        getSpans: jest.fn(() => []),
      };

      const iterations = 100;
      const startTime = performance.now();

      for (let i = 0; i < iterations; i++) {
        formatter.format(mockTrace);
      }

      const duration = performance.now() - startTime;
      const avgDuration = duration / iterations;

      console.log(`${iterations} format calls total: ${duration.toFixed(2)}ms`);
      console.log(`Average per call: ${avgDuration.toFixed(2)}ms`);

      // Average duration per call should be very low
      expect(avgDuration).toBeLessThan(10);
    });
  });

  describe('Memory Efficiency', () => {
    it('should not leak memory with repeated large trace formatting', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      for (let iteration = 0; iteration < 10; iteration++) {
        const largeTracedActions = new Map();

        // Create large traces repeatedly
        for (let i = 0; i < 500; i++) {
          largeTracedActions.set(`action${i}`, {
            actionId: `action${i}`,
            actorId: `actor${i}`,
            startTime: Date.now() + i * 10,
            stages: {
              stage1: { timestamp: Date.now() + i * 10 },
              stage2: { timestamp: Date.now() + i * 10 + 5 },
            },
          });
        }

        const mockTrace = {
          getTracedActions: jest.fn(() => largeTracedActions),
          getSpans: jest.fn(() => []),
        };

        formatter.format(mockTrace);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // Convert to MB

      console.log(
        `Memory increase after 10 iterations: ${memoryIncrease.toFixed(2)} MB`
      );

      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncrease).toBeLessThan(50);
    });
  });
});
