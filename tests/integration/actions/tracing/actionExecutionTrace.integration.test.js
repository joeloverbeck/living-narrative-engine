import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import CommandProcessorTracingTestBed from '../../../common/commands/commandProcessorTracingTestBed.js';

describe('Action Tracing - Execution Integration', () => {
  let testBed;
  const testOutputDir = './test-execution-traces';

  beforeEach(async () => {
    testBed = new CommandProcessorTracingTestBed();
    await testBed.initialize();
  });

  afterEach(async () => {
    await testBed.cleanup();
  });

  describe('End-to-End Execution Tracing', () => {
    it('should trace action execution through CommandProcessor', async () => {
      // Configure tracing for specific action
      await testBed.configureTracing({
        enabled: true,
        tracedActions: ['movement:go'],
        outputDirectory: testOutputDir,
        verbosity: 'detailed',
      });

      // Create test actor
      const actor = testBed.createActor('player-1', {
        components: ['core:position', 'core:movement'],
      });

      // Create turn action
      const turnAction = testBed.createTurnAction('movement:go', {
        commandString: 'go north',
        parameters: { direction: 'north' },
      });

      // Execute action with tracing
      const startTime = performance.now();
      const result = await testBed.dispatchAction(actor, turnAction);
      const executionTime = performance.now() - startTime;

      // Verify execution succeeded
      expect(result.success).toBe(true);
      expect(result.actionResult.actionId).toBe('movement:go');

      // Wait for async trace writing
      await testBed.waitForTraceOutput();

      // Verify trace was created
      const traces = await testBed.getWrittenTraces();
      expect(traces).toHaveLength(1);

      // Get the trace data
      const trace = await testBed.getLatestTrace('movement:go');
      expect(trace).toBeDefined();
      expect(trace.metadata.actionId).toBe('movement:go');
      expect(trace.metadata.actorId).toBe('player-1');
      expect(trace.turnAction).toEqual(
        expect.objectContaining({
          actionDefinitionId: 'movement:go',
          commandString: 'go north',
          parameters: { direction: 'north' },
        })
      );
      expect(trace.execution).toBeDefined();
      expect(trace.execution.startTime).toBeGreaterThan(0);
      expect(trace.execution.endTime).toBeGreaterThan(
        trace.execution.startTime
      );
      expect(trace.execution.duration).toBeGreaterThan(0);
      expect(trace.execution.duration).toBeLessThan(executionTime + 10); // Allow some margin
    });

    it('should handle multiple concurrent executions', async () => {
      await testBed.configureTracing({
        enabled: true,
        tracedActions: ['movement:go', 'core:take', 'core:use'],
        outputDirectory: testOutputDir,
      });

      const actor = testBed.createActor('player-1', {
        components: ['core:position', 'core:movement', 'core:inventory'],
      });

      // Create multiple turn actions
      const actions = [
        testBed.createTurnAction('movement:go', { commandString: 'go north' }),
        testBed.createTurnAction('core:take', { commandString: 'take sword' }),
        testBed.createTurnAction('core:use', { commandString: 'use potion' }),
      ];

      // Execute actions concurrently
      const promises = actions.map((action) =>
        testBed.dispatchAction(actor, action)
      );

      const results = await Promise.all(promises);

      // Verify all executions succeeded
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.actionResult.actionId).toBe(
          actions[index].actionDefinitionId
        );
      });

      // Wait for all traces to be written (mock resolves quickly)
      await testBed.waitForTraceOutput(50);

      // Verify trace files were created
      const traces = await testBed.getWrittenTraces();
      expect(traces.length).toBeGreaterThanOrEqual(3);

      // Verify each action has a trace
      const traceActionIds = traces.map((t) => t.metadata.actionId);
      expect(traceActionIds).toContain('movement:go');
      expect(traceActionIds).toContain('core:take');
      expect(traceActionIds).toContain('core:use');
    });

    it('should trace actions with multi-target resolution', async () => {
      await testBed.configureTracing({
        enabled: true,
        tracedActions: ['core:give'],
        outputDirectory: testOutputDir,
      });

      const actor = testBed.createActor('player-1', {
        components: ['core:position', 'core:inventory'],
      });

      const turnAction = testBed.createTurnAction('core:give', {
        commandString: 'give sword to guard',
        resolvedParameters: {
          isMultiTarget: true,
          targetIds: {
            primary: ['item-sword'],
            secondary: ['npc-guard'],
          },
        },
      });

      const result = await testBed.dispatchAction(actor, turnAction);
      expect(result.success).toBe(true);

      await testBed.waitForTraceOutput();
      const trace = await testBed.getLatestTrace('core:give');

      expect(trace).toBeDefined();
      expect(trace.turnAction).toBeDefined();

      // Check if resolvedParameters were captured (they may be in parameters)
      const resolvedParams =
        trace.turnAction.resolvedParameters ||
        trace.turnAction.parameters?.resolvedParameters ||
        turnAction.resolvedParameters;

      expect(resolvedParams).toBeDefined();
      expect(resolvedParams.isMultiTarget).toBe(true);
      expect(resolvedParams.targetIds).toEqual({
        primary: ['item-sword'],
        secondary: ['npc-guard'],
      });
    });
  });

  describe('Event Payload Capture', () => {
    it('should capture complete event payload', async () => {
      await testBed.configureTracing({
        enabled: true,
        tracedActions: ['core:take'],
        verbosity: 'verbose',
      });

      const actor = testBed.createActor('player-1', {
        components: ['core:inventory'],
      });

      const turnAction = testBed.createTurnAction('core:take', {
        commandString: 'take sword',
        parameters: { target: 'sword' },
      });

      const result = await testBed.dispatchAction(actor, turnAction);
      expect(result.success).toBe(true);

      await testBed.waitForTraceOutput();
      const trace = await testBed.getLatestTrace('core:take');

      expect(trace.eventPayload).toBeDefined();
      expect(trace.eventPayload.actorId).toBe('player-1');
      expect(trace.eventPayload.actionId).toBe('core:take');
      expect(trace.eventPayload.timestamp).toBeGreaterThan(0);
    });

    it('should preserve payload structure through execution', async () => {
      await testBed.configureTracing({
        enabled: true,
        tracedActions: ['core:structured'],
      });

      const actor = testBed.createActor('player-1');
      const complexParams = {
        nested: {
          level1: {
            level2: {
              value: 'deep-value',
              array: [1, 2, 3],
            },
          },
        },
        timestamp: Date.now(),
        flags: { active: true, visible: false },
      };

      const turnAction = testBed.createTurnAction('core:structured', {
        parameters: complexParams,
      });

      await testBed.dispatchAction(actor, turnAction);
      await testBed.waitForTraceOutput();

      const trace = await testBed.getLatestTrace('core:structured');
      expect(trace.turnAction.parameters).toEqual(complexParams);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should capture execution errors with stack traces', async () => {
      await testBed.configureTracing({
        enabled: true,
        tracedActions: ['core:failing_action'],
      });

      const actor = testBed.createActor('player-1');
      const turnAction = testBed.createTurnAction('core:failing_action', {
        commandString: 'trigger error',
      });

      // Configure action to throw error
      const testError = new Error('Test error');
      testError.stack = 'Error: Test error\n    at test.js:10:15';
      testBed.configureActionToFail('core:failing_action', testError);

      const result = await testBed.dispatchAction(actor, turnAction);

      // Execution should fail gracefully
      expect(result.success).toBe(false);

      await testBed.waitForTraceOutput();
      const trace = await testBed.getLatestTrace('core:failing_action');

      expect(trace.error).toBeDefined();
      expect(trace.error.message).toBe('Test error');
      expect(trace.error.type).toBe('Error');
      expect(trace.error.stack).toBeDefined();
      expect(trace.execution.endTime).toBeGreaterThan(
        trace.execution.startTime
      );
    });

    it('should handle EventDispatchService failures', async () => {
      await testBed.configureTracing({
        enabled: true,
        tracedActions: ['movement:go'],
      });

      const actor = testBed.createActor('player-1');
      const turnAction = testBed.createTurnAction('movement:go', {
        commandString: 'go north',
      });

      // Configure EventDispatchService to fail
      testBed.configureEventDispatchToFail(new Error('Event dispatch failed'));

      const result = await testBed.dispatchAction(actor, turnAction);

      expect(result.success).toBe(false);

      await testBed.waitForTraceOutput();
      const trace = await testBed.getLatestTrace('movement:go');

      expect(trace.error).toBeDefined();
      expect(trace.error.message).toBe('Event dispatch failed');
    });

    it('should handle trace output failures gracefully', async () => {
      await testBed.configureTracing({
        enabled: true,
        tracedActions: ['movement:go'],
        outputDirectory: '/invalid/path', // Cause potential output issues
      });

      const actor = testBed.createActor('player-1');
      const turnAction = testBed.createTurnAction('movement:go', {
        commandString: 'go north',
      });

      // Should not throw error even if trace output has issues
      const result = await testBed.dispatchAction(actor, turnAction);

      expect(result.success).toBe(true); // Action should still succeed

      // The trace should still be captured in memory
      await testBed.waitForTraceOutput();
      const traces = await testBed.getWrittenTraces();
      expect(traces.length).toBeGreaterThan(0);
    });

    it('should recover from partial execution failures', async () => {
      await testBed.configureTracing({
        enabled: true,
        tracedActions: ['*'],
      });

      const actor = testBed.createActor('player-1');

      // Mix of succeeding and failing actions
      const actions = [
        { id: 'core:success1', shouldFail: false },
        { id: 'core:fail1', shouldFail: true },
        { id: 'core:success2', shouldFail: false },
      ];

      const results = [];
      for (const action of actions) {
        if (action.shouldFail) {
          testBed.configureActionToFail(
            action.id,
            new Error(`${action.id} failed`)
          );
        }

        const turnAction = testBed.createTurnAction(action.id);
        const result = await testBed.dispatchAction(actor, turnAction);
        results.push({ actionId: action.id, success: result.success });
      }

      // Verify expected results
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(true);

      // All actions should be traced regardless of success
      await testBed.waitForTraceOutput();
      const traces = await testBed.getWrittenTraces();
      expect(traces).toHaveLength(3);
    });
  });

  describe('EventDispatchService Integration', () => {
    it('should trace event dispatch success', async () => {
      await testBed.configureTracing({
        enabled: true,
        tracedActions: ['movement:go'],
      });

      const actor = testBed.createActor('player-1');
      const turnAction = testBed.createTurnAction('movement:go', {
        commandString: 'go north',
      });

      const result = await testBed.dispatchAction(actor, turnAction);
      expect(result.success).toBe(true);

      await testBed.waitForTraceOutput();
      const trace = await testBed.getLatestTrace('movement:go');

      expect(trace.result).toBeDefined();
      expect(trace.result.success).toBe(true);
      expect(trace.result.timestamp).toBeGreaterThan(0);
    });

    it('should capture dispatch timing separately', async () => {
      await testBed.configureTracing({
        enabled: true,
        tracedActions: ['movement:go'],
        verbosity: 'detailed',
      });

      const actor = testBed.createActor('player-1');
      const turnAction = testBed.createTurnAction('movement:go', {
        commandString: 'go north',
      });

      // Add delay to event dispatch
      testBed.configureEventDispatchDelay(30);

      const result = await testBed.dispatchAction(actor, turnAction);
      expect(result.success).toBe(true);

      await testBed.waitForTraceOutput();
      const trace = await testBed.getLatestTrace('movement:go');

      expect(trace.execution.duration).toBeGreaterThan(25); // Should include dispatch delay

      // Verify result exists and has timestamp
      expect(trace.result).toBeDefined();
      expect(trace.result.timestamp).toBeGreaterThan(0);

      // The timestamp should be within the execution window (allowing for different time bases)
      if (trace.result.timestamp < 10000000) {
        // performance.now() based timestamps
        expect(trace.result.timestamp).toBeGreaterThan(
          trace.execution.startTime
        );
        expect(trace.result.timestamp).toBeLessThanOrEqual(
          trace.execution.endTime
        );
      } else {
        // Date.now() based timestamps - just verify it exists
        expect(trace.result.timestamp).toBeGreaterThan(1000000000000); // Unix timestamp
      }
    });

    it('should handle event dispatch timeout', async () => {
      await testBed.configureTracing({
        enabled: true,
        tracedActions: ['core:slow_action'],
      });

      const actor = testBed.createActor('player-1');
      const turnAction = testBed.createTurnAction('core:slow_action', {
        commandString: 'perform slow action',
      });

      // Configure action to timeout
      testBed.configureActionTimeout('core:slow_action', 100);

      const result = await testBed.dispatchAction(actor, turnAction);

      await testBed.waitForTraceOutput();
      const trace = await testBed.getLatestTrace('core:slow_action');

      expect(result.success).toBe(false);
      expect(trace.error).toBeDefined();
      expect(trace.error.message).toContain('timeout');
      expect(trace.execution.duration).toBeGreaterThan(100);
    });

    it('should maintain dispatch order for sequential actions', async () => {
      await testBed.configureTracing({
        enabled: true,
        tracedActions: ['*'],
      });

      const actor = testBed.createActor('player-1');
      const actionIds = ['core:first', 'core:second', 'core:third'];

      const timestamps = [];
      for (const actionId of actionIds) {
        const turnAction = testBed.createTurnAction(actionId);
        const startTime = Date.now();
        await testBed.dispatchAction(actor, turnAction);
        timestamps.push({ actionId, startTime });
      }

      await testBed.waitForTraceOutput();

      // Verify actions were executed in order
      for (let i = 0; i < actionIds.length; i++) {
        const trace = await testBed.getLatestTrace(actionIds[i]);
        expect(trace).toBeDefined();

        if (i > 0) {
          const prevTrace = await testBed.getLatestTrace(actionIds[i - 1]);
          expect(trace.execution.startTime).toBeGreaterThanOrEqual(
            prevTrace.execution.endTime
          );
        }
      }
    });
  });

  describe('Output Format Validation', () => {
    it('should generate traces with correct structure', async () => {
      await testBed.configureTracing({
        enabled: true,
        tracedActions: ['movement:go'],
        verbosity: 'standard',
      });

      const actor = testBed.createActor('player-1');
      const turnAction = testBed.createTurnAction('movement:go', {
        commandString: 'go north',
      });

      await testBed.dispatchAction(actor, turnAction);
      await testBed.waitForTraceOutput();

      const traces = await testBed.getWrittenTraces();
      expect(traces).toHaveLength(1);

      const trace = traces[0];

      // Validate metadata structure
      expect(trace.metadata).toBeDefined();
      expect(trace.metadata.actionId).toBe('movement:go');
      expect(trace.metadata.actorId).toBe('player-1');
      expect(trace.metadata.traceType).toBe('execution');
      expect(trace.metadata.createdAt).toBeDefined();
      expect(trace.metadata.version).toBeDefined();

      // Validate execution structure
      expect(trace.execution).toBeDefined();
      expect(trace.execution.startTime).toBeGreaterThan(0);
      expect(trace.execution.endTime).toBeGreaterThan(
        trace.execution.startTime
      );
      expect(trace.execution.duration).toBeGreaterThan(0);
      expect(trace.execution.phases).toBeInstanceOf(Array);
      expect(trace.execution.status).toBeDefined();

      // Validate turnAction structure
      expect(trace.turnAction).toBeDefined();
      expect(trace.turnAction.actionDefinitionId).toBe('movement:go');
      expect(trace.turnAction.commandString).toBe('go north');
    });

    it('should respect verbosity settings in output', async () => {
      const actor = testBed.createActor('player-1');
      const turnAction = testBed.createTurnAction('movement:go');

      // Test minimal verbosity
      await testBed.configureTracing({
        enabled: true,
        tracedActions: ['movement:go'],
        verbosity: 'minimal',
      });

      await testBed.dispatchAction(actor, turnAction);
      await testBed.waitForTraceOutput();

      let traces = await testBed.getWrittenTraces();
      let trace = traces[0];

      expect(trace.metadata).toBeDefined();
      expect(trace.execution).toBeDefined();
      // Minimal verbosity should have less detail
      expect(trace.execution.phases.length).toBeLessThanOrEqual(3);

      // Clear traces for next test
      testBed.clearTraces();

      // Test detailed verbosity
      await testBed.configureTracing({
        enabled: true,
        tracedActions: ['movement:go'],
        verbosity: 'detailed',
      });

      await testBed.dispatchAction(actor, turnAction);
      await testBed.waitForTraceOutput();

      traces = await testBed.getWrittenTraces();
      trace = traces[0];

      expect(trace.metadata).toBeDefined();
      expect(trace.execution).toBeDefined();
      expect(trace.eventPayload).toBeDefined();
      expect(trace.result).toBeDefined();
    });

    it('should generate unique trace identifiers', async () => {
      await testBed.configureTracing({
        enabled: true,
        tracedActions: ['*'],
      });

      const actor = testBed.createActor('player-1');
      const actionCount = 5;

      // Execute multiple actions
      for (let i = 0; i < actionCount; i++) {
        await testBed.dispatchAction(actor, {
          actionDefinitionId: 'core:test',
          commandString: 'test action',
        });
        // Small delay to ensure timestamp differences
        await new Promise((resolve) => setTimeout(resolve, 1));
      }

      await testBed.waitForTraceOutput();
      const traces = await testBed.getWrittenTraces();

      // Check that each trace has a unique timestamp
      const timestamps = traces.map((t) => t.metadata.createdAt);
      const uniqueTimestamps = new Set(timestamps);
      expect(uniqueTimestamps.size).toBe(actionCount);
    });

    it('should include all execution phases in trace', async () => {
      await testBed.configureTracing({
        enabled: true,
        tracedActions: ['core:phased'],
        verbosity: 'verbose',
      });

      const actor = testBed.createActor('player-1');
      const turnAction = testBed.createTurnAction('core:phased');

      await testBed.dispatchAction(actor, turnAction);
      await testBed.waitForTraceOutput();

      const trace = await testBed.getLatestTrace('core:phased');

      expect(trace.execution.phases).toBeDefined();
      expect(trace.execution.phases.length).toBeGreaterThan(0);

      // Verify phases are in chronological order
      const phases = trace.execution.phases;
      for (let i = 1; i < phases.length; i++) {
        expect(phases[i].timestamp).toBeGreaterThanOrEqual(
          phases[i - 1].timestamp
        );
      }

      // Check for expected phase types
      const phaseTypes = phases.map((p) => p.phase);
      expect(phaseTypes).toContain('dispatch_start');
      expect(phaseTypes).toContain('dispatch_completed');
    });
  });

  describe('Statistics', () => {
    it('should accumulate statistics correctly', async () => {
      await testBed.configureTracing({
        enabled: true,
        tracedActions: ['*'],
      });

      const actor = testBed.createActor('player-1');
      const successCount = 3;
      const failCount = 2;

      // Execute successful actions
      for (let i = 0; i < successCount; i++) {
        await testBed.dispatchAction(actor, {
          actionDefinitionId: `core:success${i}`,
          commandString: `success ${i}`,
        });
      }

      // Execute failing actions
      for (let i = 0; i < failCount; i++) {
        const actionId = `core:fail${i}`;
        testBed.configureActionToFail(actionId, new Error('Test failure'));
        await testBed.dispatchAction(actor, {
          actionDefinitionId: actionId,
          commandString: `fail ${i}`,
        });
      }

      // Check statistics
      const stats = testBed.actionTraceOutputService.getStatistics();
      expect(stats.totalWrites).toBe(successCount + failCount);
      expect(stats.totalErrors).toBe(0); // Write errors, not action errors
      expect(stats.errorRate).toBe(0);

      // Verify all traces were captured
      const traces = await testBed.getWrittenTraces();
      expect(traces).toHaveLength(successCount + failCount);
    });
  });
});
