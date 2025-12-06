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
    const actor = testBed.createActor('player-1');
    const turnAction = {
      actionDefinitionId: 'core:performance_test',
      commandString: 'performance test',
    };
    const iterationCount = 5;

    const measureAverageDuration = async (enableTracing) => {
      if (enableTracing) {
        testBed.configureTracing(['core:performance_test']);
      } else {
        testBed.disableTracing();
      }

      testBed.clearTraces();

      // Warm up to avoid cold start skew
      await testBed.commandProcessor.dispatchAction(actor, turnAction);
      testBed.clearTraces();

      let totalDuration = 0;
      for (let i = 0; i < iterationCount; i++) {
        const start = performance.now();
        await testBed.commandProcessor.dispatchAction(actor, turnAction);
        totalDuration += performance.now() - start;
      }

      const traces = await testBed.getWrittenTraces();
      if (enableTracing) {
        expect(traces.length).toBeGreaterThanOrEqual(iterationCount);
      } else {
        expect(traces).toHaveLength(0);
      }

      testBed.clearTraces();

      return totalDuration / iterationCount;
    };

    const withTracingDuration = await measureAverageDuration(true);
    const withoutTracingDuration = await measureAverageDuration(false);

    // Tracing overhead should be minimal (averaged to reduce flake)
    const overhead = withTracingDuration - withoutTracingDuration;
    expect(overhead).toBeLessThan(15);
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
