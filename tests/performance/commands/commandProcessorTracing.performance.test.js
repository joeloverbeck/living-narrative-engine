import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import CommandProcessorTracingTestBed from '../../common/commands/commandProcessorTracingTestBed.js';

describe('CommandProcessor Tracing Performance', () => {
  let testBed;

  beforeEach(() => {
    testBed = new CommandProcessorTracingTestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should have minimal impact on action execution', async () => {
    testBed.configureTracing(['core:performance_test']);

    const actor = testBed.createActor('player-1');
    const turnAction = {
      actionDefinitionId: 'core:performance_test',
      commandString: 'performance test',
    };

    // Measure with tracing
    const startWithTracing = performance.now();
    await testBed.commandProcessor.dispatchAction(actor, turnAction);
    const withTracingDuration = performance.now() - startWithTracing;

    // Verify first execution was traced
    const traces = await testBed.getWrittenTraces();
    expect(traces).toHaveLength(1);

    // Clear traces for second test
    testBed.clearTraces();

    // Measure without tracing
    testBed.disableTracing();
    const startWithoutTracing = performance.now();
    await testBed.commandProcessor.dispatchAction(actor, turnAction);
    const withoutTracingDuration = performance.now() - startWithoutTracing;

    // Verify second execution was not traced
    const tracesAfterDisable = await testBed.getWrittenTraces();
    expect(tracesAfterDisable).toHaveLength(0);

    // Tracing overhead should be minimal
    const overhead = withTracingDuration - withoutTracingDuration;
    expect(overhead).toBeLessThan(10); // <10ms overhead
  });

  it('should handle high-volume tracing efficiently', async () => {
    testBed.configureTracing(['*']);

    const actor = testBed.createActor('player-1');
    const actionCount = 100;

    const startTime = performance.now();

    // Execute many actions concurrently
    const promises = [];
    for (let i = 0; i < actionCount; i++) {
      promises.push(
        testBed.commandProcessor.dispatchAction(actor, {
          actionDefinitionId: `core:batch${i}`,
          commandString: `batch action ${i}`,
        })
      );
    }

    const results = await Promise.all(promises);
    const duration = performance.now() - startTime;

    // All should succeed
    results.forEach((result) => expect(result.success).toBe(true));

    // All should be traced
    const traces = await testBed.getWrittenTraces();
    expect(traces).toHaveLength(actionCount);

    // Performance should be reasonable
    const averageTime = duration / actionCount;
    expect(averageTime).toBeLessThan(5); // <5ms per action average
  });
});
