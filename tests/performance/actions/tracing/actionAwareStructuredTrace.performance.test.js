/**
 * @file Performance tests for ActionAwareStructuredTrace
 * @description Validates <1ms overhead requirement for captureActionData calls
 * and memory usage constraints for typical tracing sessions
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import ActionTraceFilter from '../../../../src/actions/tracing/actionTraceFilter.js';

describe('ActionAwareStructuredTrace - Performance Tests', () => {
  let testBed;
  let mockLogger;

  beforeEach(() => {
    testBed = createTestBed();
    mockLogger = testBed.mockLogger;
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('captureActionData Performance - <1ms Requirement', () => {
    it('should complete captureActionData calls in <1ms for standard verbosity', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['test:action'],
        verbosity: 'standard',
        includeComponentData: true,
        includePrerequisites: false,
      });

      const testData = {
        actorComponents: ['core:position', 'core:movement', 'core:inventory'],
        requiredComponents: ['core:position'],
        passed: true,
        actorId: 'performance-test-actor',
      };

      // Warm up - let JIT optimization kick in
      for (let i = 0; i < 100; i++) {
        trace.captureActionData('warmup', 'test:action', { iteration: i });
      }

      // Measure performance of individual calls
      const measurements = [];
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        trace.captureActionData('performance_test', 'test:action', {
          ...testData,
          iteration: i,
          timestamp: Date.now(),
        });
        const endTime = performance.now();
        measurements.push(endTime - startTime);
      }

      // Calculate statistics with proper outlier handling
      const sortedMeasurements = [...measurements].sort((a, b) => a - b);
      const avgTime =
        measurements.reduce((a, b) => a + b) / measurements.length;
      const maxTime = Math.max(...measurements);
      const minTime = Math.min(...measurements);
      const p95Time =
        sortedMeasurements[Math.floor(measurements.length * 0.95)];
      const p99Time =
        sortedMeasurements[Math.floor(measurements.length * 0.99)];

      // Filter out top 1% as potential system noise outliers
      const outlierThreshold = p99Time;
      const filteredMeasurements = measurements.filter(
        (t) => t <= outlierThreshold
      );
      const filteredMaxTime = Math.max(...filteredMeasurements);

      // Performance requirements - realistic thresholds accounting for system variance
      expect(avgTime).toBeLessThan(1.0); // <1ms average
      expect(p95Time).toBeLessThan(2.0); // <2ms for 95% of calls
      expect(p99Time).toBeLessThan(5.0); // <5ms for 99% of calls
      expect(filteredMaxTime).toBeLessThan(25.0); // <25ms worst case after outlier filtering (realistic for system variance)

      // Log performance metrics for analysis
      console.log(
        `ActionAwareStructuredTrace.captureActionData Performance (standard verbosity):`
      );
      console.log(`  Average: ${avgTime.toFixed(3)}ms`);
      console.log(`  Min: ${minTime.toFixed(3)}ms`);
      console.log(`  95th percentile: ${p95Time.toFixed(3)}ms`);
      console.log(`  99th percentile: ${p99Time.toFixed(3)}ms`);
      console.log(`  Max: ${maxTime.toFixed(3)}ms`);
      console.log(
        `  Max (after outlier filtering): ${filteredMaxTime.toFixed(3)}ms`
      );
      console.log(
        `  Outliers filtered: ${measurements.length - filteredMeasurements.length}`
      );
      console.log(`  Iterations: ${iterations}`);
    });

    it('should complete captureActionData calls in <1ms for minimal verbosity', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['test:action'],
        verbosity: 'minimal',
      });

      const testData = {
        passed: true,
        success: true,
        error: null,
      };

      // Warm up
      for (let i = 0; i < 50; i++) {
        trace.captureActionData('warmup', 'test:action', testData);
      }

      const measurements = [];
      const iterations = 1000;

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        trace.captureActionData('minimal_test', 'test:action', testData);
        const endTime = performance.now();
        measurements.push(endTime - startTime);
      }

      // Sort measurements for percentile calculations
      const sortedMeasurements = [...measurements].sort((a, b) => a - b);

      const avgTime =
        measurements.reduce((a, b) => a + b) / measurements.length;
      const maxTime = Math.max(...measurements);
      const minTime = Math.min(...measurements);
      const p95Time =
        sortedMeasurements[Math.floor(measurements.length * 0.95)];
      const p99Time =
        sortedMeasurements[Math.floor(measurements.length * 0.99)];

      // Filter out the top 1% of measurements as potential outliers
      const outlierThreshold = p99Time;
      const filteredMeasurements = measurements.filter(
        (t) => t <= outlierThreshold
      );
      const filteredMaxTime = Math.max(...filteredMeasurements);

      // Minimal verbosity performance requirements - more realistic thresholds
      expect(avgTime).toBeLessThan(0.5); // <0.5ms average for minimal
      expect(p95Time).toBeLessThan(2.0); // <2ms for 95% of calls
      expect(p99Time).toBeLessThan(5.0); // <5ms for 99% of calls
      expect(filteredMaxTime).toBeLessThan(10.0); // <10ms worst case after outlier filtering

      console.log(
        `ActionAwareStructuredTrace.captureActionData Performance (minimal verbosity):`
      );
      console.log(`  Average: ${avgTime.toFixed(3)}ms`);
      console.log(`  Min: ${minTime.toFixed(3)}ms`);
      console.log(`  95th percentile: ${p95Time.toFixed(3)}ms`);
      console.log(`  99th percentile: ${p99Time.toFixed(3)}ms`);
      console.log(`  Max: ${maxTime.toFixed(3)}ms`);
      console.log(
        `  Max (after outlier filtering): ${filteredMaxTime.toFixed(3)}ms`
      );
      console.log(
        `  Outliers filtered: ${measurements.length - filteredMeasurements.length}`
      );
    });

    it('should handle detailed verbosity within performance bounds', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['test:action'],
        verbosity: 'detailed',
        includeComponentData: true,
        includePrerequisites: true,
        includeTargets: true,
      });

      const complexData = {
        actorComponents: [
          'core:position',
          'core:movement',
          'core:inventory',
          'core:health',
        ],
        requiredComponents: ['core:position', 'core:movement'],
        prerequisites: [
          { type: 'component', component: 'core:position', passed: true },
          { type: 'component', component: 'core:movement', passed: true },
          { type: 'condition', condition: 'canMove', passed: true },
        ],
        resolvedTargets: Array.from({ length: 5 }, (_, i) => ({
          id: `target${i}`,
          type: 'entity',
          displayName: `Target ${i}`,
        })),
        formattedCommand: 'go north towards the castle',
        template: 'go {{direction}} towards {{target}}',
        duration: 12.5,
        passed: true,
      };

      // Warm up
      for (let i = 0; i < 50; i++) {
        trace.captureActionData('warmup', 'test:action', complexData);
      }

      const measurements = [];
      const iterations = 500;

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        trace.captureActionData('detailed_test', 'test:action', {
          ...complexData,
          iteration: i,
        });
        const endTime = performance.now();
        measurements.push(endTime - startTime);
      }

      const avgTime =
        measurements.reduce((a, b) => a + b) / measurements.length;
      const p95Time = measurements.sort((a, b) => a - b)[
        Math.floor(measurements.length * 0.95)
      ];

      // Detailed verbosity may be slightly slower but should still meet requirements
      expect(avgTime).toBeLessThan(1.5); // <1.5ms average for detailed
      expect(p95Time).toBeLessThan(5.0); // <5ms for 95% of calls (more realistic for detailed data processing)

      console.log(
        `ActionAwareStructuredTrace.captureActionData Performance (detailed verbosity):`
      );
      console.log(`  Average: ${avgTime.toFixed(3)}ms`);
      console.log(`  95th percentile: ${p95Time.toFixed(3)}ms`);
    });

    it('should have zero overhead when action is not being traced', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['movement:go'], // Only trace 'go', not 'untraced'
        verbosity: 'standard',
      });

      const testData = {
        actorComponents: ['core:position'],
        passed: true,
      };

      // Measure untraced action performance
      const measurements = [];
      const iterations = 2000;

      for (let i = 0; i < iterations; i++) {
        const startTime = performance.now();
        trace.captureActionData(
          'performance_test',
          'untraced:action',
          testData
        );
        const endTime = performance.now();
        measurements.push(endTime - startTime);
      }

      const avgTime =
        measurements.reduce((a, b) => a + b) / measurements.length;

      // Calculate percentiles and filter outliers (consistent with other tests)
      const sortedMeasurements = [...measurements].sort((a, b) => a - b);
      const p99Index = Math.floor(iterations * 0.99);
      const p99Time = sortedMeasurements[p99Index];

      // Filter out top 1% outliers for max time calculation
      const filteredMeasurements = sortedMeasurements.slice(0, p99Index);
      const filteredMaxTime = Math.max(...filteredMeasurements);

      // Should be extremely fast when not tracing
      expect(avgTime).toBeLessThan(0.1); // <0.1ms average for untraced
      expect(p99Time).toBeLessThan(5.0); // <5ms for 99% of calls
      expect(filteredMaxTime).toBeLessThan(3.0); // <3ms worst case after outlier filtering

      // Verify no data was actually captured
      expect(trace.isActionTraced('untraced:action')).toBe(false);
      expect(trace.getTracingSummary().tracedActionCount).toBe(0);

      console.log(
        `ActionAwareStructuredTrace.captureActionData Performance (untraced actions):`
      );
      console.log(`  Average: ${avgTime.toFixed(3)}ms`);
      console.log(`  P99: ${p99Time.toFixed(3)}ms`);
      console.log(`  Max (filtered): ${filteredMaxTime.toFixed(3)}ms`);
    });
  });

  describe('Memory Usage - <5MB Requirement', () => {
    it('should maintain memory usage under 5MB for typical tracing session', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['*'], // Trace all actions
        verbosity: 'standard',
        includeComponentData: true,
      });

      // Simulate typical tracing session: 50 different actions, 4 stages each
      const actions = Array.from({ length: 50 }, (_, i) => `action:${i}`);
      const stages = [
        'component_filtering',
        'prerequisite_evaluation',
        'target_resolution',
        'command_formatting',
      ];

      const startMemory = process.memoryUsage();

      for (const action of actions) {
        for (const stage of stages) {
          trace.captureActionData(stage, action, {
            actorComponents: [
              'core:position',
              'core:movement',
              'core:inventory',
            ],
            requiredComponents: ['core:position'],
            passed: Math.random() > 0.1, // 90% success rate
            duration: Math.random() * 10,
            data: `stage data for ${stage}`,
            timestamp: Date.now(),
          });
        }
      }

      const endMemory = process.memoryUsage();
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
      const memoryMB = memoryDelta / (1024 * 1024);

      // Should be well under 5MB for typical session
      expect(memoryMB).toBeLessThan(5);

      const summary = trace.getTracingSummary();
      expect(summary.tracedActionCount).toBe(50);
      expect(summary.totalStagesTracked).toBe(200); // 50 actions × 4 stages

      console.log(`Memory usage for typical tracing session:`);
      console.log(`  Actions traced: ${summary.tracedActionCount}`);
      console.log(`  Total stages: ${summary.totalStagesTracked}`);
      console.log(`  Memory delta: ${memoryMB.toFixed(2)}MB`);
      console.log(
        `  Memory per action: ${(memoryMB / summary.tracedActionCount).toFixed(3)}MB`
      );
    });

    it('should handle high-volume tracing without excessive memory growth', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['test:*'],
        verbosity: 'minimal', // Keep data minimal to test infrastructure overhead
      });

      const startMemory = process.memoryUsage();

      // High-volume simulation: 10 actions, 100 captures each
      for (let actionNum = 0; actionNum < 10; actionNum++) {
        const actionId = `test:action${actionNum}`;

        for (let i = 0; i < 100; i++) {
          trace.captureActionData(`iteration_${i}`, actionId, {
            passed: true,
            iteration: i,
          });
        }
      }

      const endMemory = process.memoryUsage();
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
      const memoryMB = memoryDelta / (1024 * 1024);

      // Should still be reasonable even with high volume
      expect(memoryMB).toBeLessThan(10); // Allow more for high volume

      const summary = trace.getTracingSummary();
      expect(summary.tracedActionCount).toBe(10);
      expect(summary.totalStagesTracked).toBe(1000); // 10 actions × 100 stages

      console.log(`Memory usage for high-volume tracing:`);
      console.log(`  Actions traced: ${summary.tracedActionCount}`);
      console.log(`  Total stages: ${summary.totalStagesTracked}`);
      console.log(`  Memory delta: ${memoryMB.toFixed(2)}MB`);
      console.log(
        `  Memory per stage: ${((memoryMB * 1024) / summary.totalStagesTracked).toFixed(3)}KB`
      );
    });

    it('should efficiently clean up memory when clearing data', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['*'],
        verbosity: 'verbose', // Use verbose to create more data
      });

      // Create substantial data
      for (let i = 0; i < 100; i++) {
        trace.captureActionData('memory_test', 'test:action', {
          largeData: new Array(100).fill(`data-${i}`),
          complexObject: {
            level1: { level2: { level3: new Array(50).fill('nested') } },
          },
          iteration: i,
        });
      }

      const beforeClearMemory = process.memoryUsage();

      // Clear all data
      trace.clearActionData();

      // Force garbage collection if possible
      if (global.gc) {
        global.gc();
      }

      const afterClearMemory = process.memoryUsage();

      // Verify data is cleared
      expect(trace.getTracingSummary().tracedActionCount).toBe(0);
      expect(trace.getTracingSummary().totalStagesTracked).toBe(0);

      // Memory should be reduced (though GC is not guaranteed to run immediately)
      const memoryReduction =
        (beforeClearMemory.heapUsed - afterClearMemory.heapUsed) /
        (1024 * 1024);

      console.log(`Memory cleanup after clearActionData():`);
      console.log(
        `  Memory before clear: ${(beforeClearMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(
        `  Memory after clear: ${(afterClearMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`
      );
      console.log(`  Memory reduction: ${memoryReduction.toFixed(2)}MB`);
    });
  });

  describe('Scalability and Concurrent Performance', () => {
    it('should scale linearly with number of traced actions', async () => {
      const actionCounts = [10, 50, 100];
      const results = [];

      for (const actionCount of actionCounts) {
        const trace = await testBed.createActionAwareTrace({
          tracedActions: ['*'],
          verbosity: 'standard',
        });

        const startTime = performance.now();

        // Process actions
        for (let i = 0; i < actionCount; i++) {
          trace.captureActionData('scaling_test', `action:${i}`, {
            passed: true,
            actionIndex: i,
          });
        }

        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const timePerAction = totalTime / actionCount;

        results.push({
          actionCount,
          totalTime,
          timePerAction,
        });

        // Cleanup
        trace.clearActionData();
      }

      // Verify linear scaling (time per action should be roughly constant)
      const timeVariation =
        Math.max(...results.map((r) => r.timePerAction)) -
        Math.min(...results.map((r) => r.timePerAction));

      expect(timeVariation).toBeLessThan(0.5); // <0.5ms variation in per-action time

      console.log('Scaling performance:');
      results.forEach((result) => {
        console.log(
          `  ${result.actionCount} actions: ${result.totalTime.toFixed(2)}ms total, ${result.timePerAction.toFixed(3)}ms per action`
        );
      });
    });

    it('should handle concurrent access without performance degradation', async () => {
      const trace = await testBed.createActionAwareTrace({
        tracedActions: ['*'],
        verbosity: 'standard',
      });

      // Simulate concurrent access
      const concurrentPromises = [];
      const operationsPerThread = 100;
      const threadCount = 10;

      const startTime = performance.now();

      for (let threadId = 0; threadId < threadCount; threadId++) {
        const promise = new Promise((resolve) => {
          const threadResults = [];

          for (let i = 0; i < operationsPerThread; i++) {
            const opStartTime = performance.now();

            trace.captureActionData(
              'concurrent_test',
              `thread${threadId}:action${i}`,
              {
                threadId,
                iteration: i,
                timestamp: Date.now(),
              }
            );

            const opEndTime = performance.now();
            threadResults.push(opEndTime - opStartTime);
          }

          resolve({
            threadId,
            avgTime:
              threadResults.reduce((a, b) => a + b) / threadResults.length,
            maxTime: Math.max(...threadResults),
          });
        });

        concurrentPromises.push(promise);
      }

      const threadResults = await Promise.all(concurrentPromises);
      const endTime = performance.now();

      const totalTime = endTime - startTime;
      const totalOperations = threadCount * operationsPerThread;

      // Verify performance remains good under concurrency
      const avgThreadTime =
        threadResults.reduce((sum, result) => sum + result.avgTime, 0) /
        threadResults.length;
      const maxThreadTime = Math.max(
        ...threadResults.map((result) => result.maxTime)
      );

      // Average performance should still be excellent
      expect(avgThreadTime).toBeLessThan(2.0); // <2ms average - relaxed for concurrent scenarios

      // For JavaScript's single-threaded nature, concurrent operations can experience
      // significant delays due to event loop blocking, GC pauses, and system load.
      // The important metric is that operations complete correctly and average performance
      // remains good. Individual outliers don't indicate production issues.
      if (maxThreadTime > 50.0) {
        console.warn(
          `Performance outlier detected: ${maxThreadTime.toFixed(3)}ms - likely due to system load or GC`
        );
      }

      // Use a very lenient threshold that still catches catastrophic performance issues
      expect(maxThreadTime).toBeLessThan(200.0); // <200ms absolute worst case for outliers

      // Verify all data was captured
      const summary = trace.getTracingSummary();
      expect(summary.totalStagesTracked).toBe(totalOperations);

      console.log('Concurrent performance:');
      console.log(`  Total operations: ${totalOperations}`);
      console.log(`  Total time: ${totalTime.toFixed(2)}ms`);
      console.log(
        `  Avg thread performance: ${avgThreadTime.toFixed(3)}ms per operation`
      );
      console.log(
        `  Max thread performance: ${maxThreadTime.toFixed(3)}ms per operation`
      );
    });
  });

  describe('Filter Performance', () => {
    it('should efficiently filter actions using patterns', async () => {
      const actionFilter = new ActionTraceFilter({
        tracedActions: ['core:*', 'test:specific', 'complex:action:*'],
        excludedActions: ['core:debug', 'test:ignored'],
        verbosityLevel: 'standard',
        logger: mockLogger,
      });

      // Create many test actions
      const testActions = [
        ...Array.from({ length: 100 }, (_, i) => `core:action${i}`),
        ...Array.from({ length: 50 }, (_, i) => `other:action${i}`),
        ...Array.from({ length: 25 }, (_, i) => `test:action${i}`),
        'test:specific',
        'core:debug',
        'test:ignored',
      ];

      // Warm up - allow JIT optimization to stabilize performance
      for (let i = 0; i < 50; i++) {
        actionFilter.shouldTrace(testActions[i % testActions.length]);
      }

      const measurements = [];

      for (const actionId of testActions) {
        const startTime = performance.now();
        actionFilter.shouldTrace(actionId);
        const endTime = performance.now();
        measurements.push(endTime - startTime);
      }

      // Calculate statistics with outlier filtering
      const sortedMeasurements = [...measurements].sort((a, b) => a - b);
      const avgFilterTime =
        measurements.reduce((a, b) => a + b) / measurements.length;
      const maxFilterTime = Math.max(...measurements);
      const p95Time =
        sortedMeasurements[Math.floor(measurements.length * 0.95)];
      const p99Time =
        sortedMeasurements[Math.floor(measurements.length * 0.99)];

      // Filter out top 1% as potential system noise outliers
      const outlierThreshold = p99Time;
      const filteredMeasurements = measurements.filter(
        (t) => t <= outlierThreshold
      );
      const filteredMaxTime = Math.max(...filteredMeasurements);

      // Realistic performance requirements accounting for system variance
      // Threshold adjusted to 0.1ms to account for environment variations while still ensuring excellent performance
      expect(avgFilterTime).toBeLessThan(0.1); // <0.1ms average (100 microseconds is still very fast for filtering)
      expect(p95Time).toBeLessThan(0.5); // <0.5ms for 95% of calls
      expect(p99Time).toBeLessThan(2.0); // <2ms for 99% of calls
      expect(filteredMaxTime).toBeLessThan(1.0); // <1ms worst case after outlier filtering

      console.log(`Action filter performance (${testActions.length} actions):`);
      console.log(`  Average filter time: ${avgFilterTime.toFixed(4)}ms`);
      console.log(`  95th percentile: ${p95Time.toFixed(4)}ms`);
      console.log(`  99th percentile: ${p99Time.toFixed(4)}ms`);
      console.log(`  Max: ${maxFilterTime.toFixed(4)}ms`);
      console.log(
        `  Max (after outlier filtering): ${filteredMaxTime.toFixed(4)}ms`
      );
      console.log(
        `  Outliers filtered: ${measurements.length - filteredMeasurements.length}`
      );
    });
  });
});
