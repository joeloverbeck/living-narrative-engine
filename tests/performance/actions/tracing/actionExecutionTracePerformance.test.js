/**
 * @file Performance tests for action execution tracing
 * @description Tests focused on performance metrics, timing accuracy, and throughput
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import CommandProcessorTracingTestBed from '../../../common/commands/commandProcessorTracingTestBed.js';

describe('Action Tracing - Performance Tests', () => {
  let testBed;
  const testOutputDir = './test-execution-traces';

  beforeEach(async () => {
    testBed = new CommandProcessorTracingTestBed();
    await testBed.initialize();
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('Timing and Performance Tracking', () => {
    it('should capture accurate execution timing', async () => {
      await testBed.configureTracing({
        enabled: true,
        tracedActions: ['movement:go'],
      });

      const actor = testBed.createActor('player-1');
      const turnAction = testBed.createTurnAction('movement:go', {
        commandString: 'go north',
      });

      // Add artificial delay to test timing accuracy
      testBed.addExecutionDelay(50); // 50ms delay

      const startTime = performance.now();
      const result = await testBed.dispatchAction(actor, turnAction);
      const endTime = performance.now();
      const actualDuration = endTime - startTime;

      expect(result.success).toBe(true);

      await testBed.waitForTraceOutput();
      const trace = await testBed.getLatestTrace('movement:go');

      // Check timing values are present and reasonable
      expect(trace.execution.startTime).toBeGreaterThan(0);
      expect(trace.execution.endTime).toBeGreaterThan(
        trace.execution.startTime
      );

      // Use looser tolerance for timing
      expect(trace.execution.duration).toBeGreaterThan(45); // At least most of the delay
      expect(trace.execution.duration).toBeLessThan(actualDuration + 20); // Allow for overhead
    });

    it('should measure dispatch overhead', async () => {
      const actor = testBed.createActor('player-1');
      const turnAction = testBed.createTurnAction('movement:go', {
        commandString: 'go north',
      });

      // Measure execution without tracing
      await testBed.configureTracing({ enabled: false });
      const startWithoutTracing = performance.now();
      await testBed.dispatchAction(actor, turnAction);
      const durationWithoutTracing = performance.now() - startWithoutTracing;

      // Measure execution with tracing
      await testBed.configureTracing({
        enabled: true,
        tracedActions: ['movement:go'],
      });

      const startWithTracing = performance.now();
      await testBed.dispatchAction(actor, turnAction);
      const durationWithTracing = performance.now() - startWithTracing;

      // Tracing overhead should be minimal
      const overhead = durationWithTracing - durationWithoutTracing;
      expect(overhead).toBeLessThan(10); // <10ms overhead
    });

    it('should handle high-frequency action execution', async () => {
      await testBed.configureTracing({
        enabled: true,
        tracedActions: ['*'],
      });

      const actor = testBed.createActor('player-1');
      const actionCount = 20; // Reduced for test speed

      const startTime = performance.now();

      // Execute many actions sequentially
      for (let i = 0; i < actionCount; i++) {
        await testBed.dispatchAction(actor, {
          actionDefinitionId: `core:action${i}`,
          commandString: `action ${i}`,
        });
      }

      const duration = performance.now() - startTime;

      // Verify all actions were traced
      const traces = await testBed.getWrittenTraces();
      expect(traces).toHaveLength(actionCount);

      // Performance should be reasonable
      const averageTime = duration / actionCount;
      expect(averageTime).toBeLessThan(20); // <20ms per action average
    });
  });

  describe('Payload Performance', () => {
    it('should handle large payloads efficiently', async () => {
      await testBed.configureTracing({
        enabled: true,
        tracedActions: ['core:complex_action'],
        verbosity: 'detailed',
      });

      const actor = testBed.createActor('player-1', {
        components: ['core:inventory', 'core:stats'],
        data: {
          'core:inventory': { items: testBed.createLargeInventory(100) },
          'core:stats': testBed.createComplexStats(),
        },
      });

      const turnAction = testBed.createTurnAction('core:complex_action', {
        commandString: 'perform complex action',
        parameters: testBed.createComplexParameters(),
      });

      const startTime = performance.now();
      const result = await testBed.dispatchAction(actor, turnAction);
      const duration = performance.now() - startTime;

      expect(result.success).toBe(true);

      await testBed.waitForTraceOutput();
      const trace = await testBed.getLatestTrace('core:complex_action');

      expect(trace.eventPayload).toBeDefined();
      expect(duration).toBeLessThan(200); // Should handle large payloads quickly

      // Verify payload contains expected data
      expect(trace.eventPayload.actorId).toBe('player-1');
      expect(trace.turnAction.parameters).toBeDefined();
    });
  });

  describe('Stress Testing', () => {
    it('should handle stress test with many concurrent actions', async () => {
      await testBed.configureTracing({
        enabled: true,
        tracedActions: ['*'],
      });

      const actor = testBed.createActor('player-1');
      const concurrentCount = 10;

      const startTime = performance.now();

      // Execute many actions concurrently
      const promises = [];
      for (let i = 0; i < concurrentCount; i++) {
        promises.push(
          testBed.dispatchAction(actor, {
            actionDefinitionId: `core:concurrent${i}`,
            commandString: `concurrent action ${i}`,
          })
        );
      }

      const results = await Promise.all(promises);
      const duration = performance.now() - startTime;

      // All should succeed
      results.forEach((result) => expect(result.success).toBe(true));

      // All should be traced
      await testBed.waitForTraceOutput(500);
      const traces = await testBed.getWrittenTraces();
      expect(traces).toHaveLength(concurrentCount);

      // Performance should be reasonable
      const averageTime = duration / concurrentCount;
      expect(averageTime).toBeLessThan(50); // <50ms per action average
    });
  });
});
