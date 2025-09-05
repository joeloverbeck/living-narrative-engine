import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import CommandProcessorTracingTestBed from '../../common/commands/commandProcessorTracingTestBed.js';

describe('CommandProcessor Tracing Integration', () => {
  let testBed;

  beforeEach(() => {
    testBed = new CommandProcessorTracingTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should create complete trace for traced action execution', async () => {
    // Configure to trace 'core:go' actions
    testBed.configureTracing(['core:go']);

    const actor = testBed.createActor('player-1');
    const turnAction = {
      actionDefinitionId: 'core:go',
      commandString: 'go north',
      parameters: { direction: 'north' },
    };

    // Execute action
    const result = await testBed.commandProcessor.dispatchAction(
      actor,
      turnAction
    );

    // Verify execution succeeded
    expect(result.success).toBe(true);

    // Verify trace was created and written
    const traces = await testBed.getWrittenTraces();
    expect(traces).toHaveLength(1);

    const trace = traces[0];
    expect(trace.metadata.actionId).toBe('core:go');
    expect(trace.metadata.actorId).toBe('player-1');
    expect(trace.execution.phases.length).toBeGreaterThanOrEqual(3);
    expect(trace.eventPayload).toBeDefined();
    expect(trace.result.success).toBe(true);
  });

  it('should handle multiple concurrent traced actions', async () => {
    testBed.configureTracing(['core:*']);

    const actor = testBed.createActor('player-1');
    const actions = [
      { actionDefinitionId: 'core:go', commandString: 'go north' },
      { actionDefinitionId: 'core:look', commandString: 'look around' },
      { actionDefinitionId: 'core:inventory', commandString: 'inventory' },
    ];

    // Execute actions concurrently
    const results = await Promise.all(
      actions.map((action) =>
        testBed.commandProcessor.dispatchAction(actor, action)
      )
    );

    // Verify all succeeded
    results.forEach((result) => {
      expect(result.success).toBe(true);
    });

    // Verify all traces were written
    const traces = await testBed.getWrittenTraces();
    expect(traces).toHaveLength(3);

    // Verify each trace has correct action ID
    const actionIds = traces.map((trace) => trace.metadata.actionId);
    expect(actionIds).toContain('core:go');
    expect(actionIds).toContain('core:look');
    expect(actionIds).toContain('core:inventory');
  });

  it('should integrate with real EventDispatchService', async () => {
    testBed.configureTracing(['core:test']);
    testBed.setupRealEventDispatchService();

    const actor = testBed.createActor('player-1');
    const turnAction = {
      actionDefinitionId: 'core:test',
      commandString: 'test action',
    };

    const result = await testBed.commandProcessor.dispatchAction(
      actor,
      turnAction
    );

    expect(result.success).toBe(true);

    const traces = await testBed.getWrittenTraces();
    expect(traces).toHaveLength(1);

    // Verify event payload contains real event data
    const trace = traces[0];
    expect(trace.eventPayload.eventName).toBe('core:attempt_action');
    expect(trace.eventPayload.actorId).toBe('player-1');
    expect(trace.eventPayload.actionId).toBe('core:test');
  });

  it('should handle error scenarios with complete tracing', async () => {
    testBed.configureTracing(['core:fail']);

    // Configure dispatch to fail
    testBed.eventDispatchService.dispatchWithErrorHandling.mockRejectedValue(
      new Error('Simulated dispatch failure')
    );

    const actor = testBed.createActor('player-1');
    const turnAction = {
      actionDefinitionId: 'core:fail',
      commandString: 'fail action',
    };

    const result = await testBed.commandProcessor.dispatchAction(
      actor,
      turnAction
    );

    expect(result.success).toBe(false);

    const traces = await testBed.getWrittenTraces();
    expect(traces).toHaveLength(1);

    const trace = traces[0];
    expect(trace.metadata.actionId).toBe('core:fail');
    expect(trace.error).toBeDefined();
    expect(trace.error.message).toBe('Simulated dispatch failure');
  });

  it('should respect trace filtering patterns', async () => {
    // Only trace 'core:go' actions
    testBed.configureTracing(['core:go']);

    const actor = testBed.createActor('player-1');

    // Execute multiple actions
    await testBed.commandProcessor.dispatchAction(actor, {
      actionDefinitionId: 'core:go',
      commandString: 'go north',
    });

    await testBed.commandProcessor.dispatchAction(actor, {
      actionDefinitionId: 'core:look',
      commandString: 'look around',
    });

    await testBed.commandProcessor.dispatchAction(actor, {
      actionDefinitionId: 'custom:action',
      commandString: 'custom action',
    });

    // Only 'core:go' should be traced
    const traces = await testBed.getWrittenTraces();
    expect(traces).toHaveLength(1);
    expect(traces[0].metadata.actionId).toBe('core:go');
  });

  it('should capture execution timing accurately', async () => {
    testBed.configureTracing(['core:timed']);

    // Add artificial delay to dispatch
    testBed.eventDispatchService.dispatchWithErrorHandling.mockImplementation(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
        return true;
      }
    );

    const actor = testBed.createActor('player-1');
    const turnAction = {
      actionDefinitionId: 'core:timed',
      commandString: 'timed action',
    };

    const startTime = Date.now();
    await testBed.commandProcessor.dispatchAction(actor, turnAction);
    const totalDuration = Date.now() - startTime;

    const rawTraces = testBed.getRawTraces();
    expect(rawTraces).toHaveLength(1);

    const trace = rawTraces[0];
    expect(trace.duration).toBeGreaterThanOrEqual(45); // Allow for some timing variance
    expect(trace.duration).toBeLessThanOrEqual(totalDuration + 5); // Allow for small overhead
  });

  it('should handle multi-target actions with full tracing', async () => {
    testBed.configureTracing(['core:give']);

    const actor = testBed.createActor('player-1');
    const turnAction = {
      actionDefinitionId: 'core:give',
      commandString: 'give sword to guard',
      resolvedParameters: {
        isMultiTarget: true,
        targetIds: {
          primary: ['item-sword'],
          secondary: ['npc-guard'],
        },
      },
    };

    const result = await testBed.commandProcessor.dispatchAction(
      actor,
      turnAction
    );

    expect(result.success).toBe(true);

    const traces = await testBed.getWrittenTraces();
    expect(traces).toHaveLength(1);

    const trace = traces[0];
    const payload = trace.eventPayload;

    // Verify multi-target structure
    expect(payload.targets).toBeDefined();
    expect(payload.targets.primary).toBeDefined();
    expect(payload.targets.primary.entityId).toBe('item-sword');
    expect(payload.targets.secondary).toBeDefined();
    expect(payload.targets.secondary.entityId).toBe('npc-guard');
  });

  it('should accumulate statistics correctly', async () => {
    testBed.configureTracing(['*']);

    const actor = testBed.createActor('player-1');

    // Execute several actions
    for (let i = 0; i < 5; i++) {
      await testBed.commandProcessor.dispatchAction(actor, {
        actionDefinitionId: `core:action${i}`,
        commandString: `action ${i}`,
      });
    }

    // Check statistics
    const stats = testBed.actionTraceOutputService.getStatistics();
    expect(stats.totalWrites).toBe(5);
    expect(stats.totalErrors).toBe(0);
    expect(stats.errorRate).toBe(0);
  });

});
