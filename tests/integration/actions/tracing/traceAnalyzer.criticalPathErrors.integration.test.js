import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { TraceAnalyzer } from '../../../../src/actions/tracing/traceAnalyzer.js';
import { StructuredTrace } from '../../../../src/actions/tracing/structuredTrace.js';

/**
 * Advances the mocked performance clock.
 *
 * @param {{ current: number }} clock
 * @param {number} ms
 */
function advanceTime(clock, ms) {
  clock.current += ms;
}

describe('TraceAnalyzer critical path error propagation (real structured trace)', () => {
  /** @type {StructuredTrace} */
  let trace;
  /** @type {{ current: number }} */
  let clock;
  /** @type {jest.SpiedFunction<typeof performance.now>} */
  let performanceSpy;

  beforeEach(() => {
    clock = { current: 0 };
    performanceSpy = jest
      .spyOn(performance, 'now')
      .mockImplementation(() => clock.current);
    trace = new StructuredTrace();
  });

  afterEach(() => {
    performanceSpy.mockRestore();
  });

  it('flags critical path operations that raised errors', () => {
    const root = trace.startSpan('ActionPipeline');

    advanceTime(clock, 5);
    const discovery = trace.startSpan('DiscoveryPhase');
    advanceTime(clock, 15);
    trace.endSpan(discovery);

    advanceTime(clock, 3);
    const execution = trace.startSpan('ExecutionPhase');
    advanceTime(clock, 8);

    const commandDispatch = trace.startSpan('CommandDispatch');
    advanceTime(clock, 30);
    commandDispatch.setError(new Error('dispatch failed'));
    trace.endSpan(commandDispatch);

    advanceTime(clock, 4);
    execution.setError(new Error('execution crashed'));
    trace.endSpan(execution);

    advanceTime(clock, 2);
    const cleanup = trace.startSpan('Cleanup');
    advanceTime(clock, 6);
    trace.endSpan(cleanup);

    advanceTime(clock, 3);
    trace.endSpan(root);

    const analyzer = new TraceAnalyzer(trace);

    const comprehensive = analyzer.getComprehensiveAnalysis();
    expect(comprehensive.criticalPath.operations).toEqual([
      'ActionPipeline',
      'ExecutionPhase',
      'CommandDispatch',
    ]);

    const errorAnalysis = analyzer.getErrorAnalysis();
    expect(errorAnalysis.totalErrors).toBe(2);
    expect(errorAnalysis.criticalPathErrors).toHaveLength(2);
    expect(errorAnalysis.criticalPathErrors).toEqual([
      'ExecutionPhase',
      'CommandDispatch',
    ]);

    const commandSummary = errorAnalysis.errorsByOperation.find(
      (entry) => entry.operation === 'CommandDispatch'
    );
    expect(commandSummary).toMatchObject({ errorCount: 1 });
  });
});
