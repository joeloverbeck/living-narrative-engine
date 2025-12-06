/**
 * @file Integration tests for TraceAnalyzer working with real StructuredTrace spans
 * @see src/actions/tracing/traceAnalyzer.js
 * @see src/actions/tracing/structuredTrace.js
 */

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
import Span from '../../../../src/actions/tracing/span.js';

/**
 * Advances the mocked performance clock
 *
 * @param clock
 * @param {number} ms
 */
function advanceTime(clock, ms) {
  clock.current += ms;
}

describe('TraceAnalyzer & StructuredTrace integration', () => {
  /** @type {jest.SpiedFunction<typeof performance.now>} */
  let performanceSpy;
  /** @type {{ current: number }} */
  let clock;
  /** @type {StructuredTrace} */
  let trace;

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

  /**
   * Builds a realistic trace graph with nested spans, errors and concurrency
   */
  function buildActionPipelineTrace() {
    const root = trace.startSpan('ActionPipeline');
    root.setAttributes({ stage: 'full-run' });

    advanceTime(clock, 10);

    const discovery = trace.startSpan('DiscoveryPhase');
    discovery.setAttributes({ candidates: 12 });
    advanceTime(clock, 45);
    trace.endSpan(discovery);

    advanceTime(clock, 5);

    const prerequisites = trace.startSpan('PrerequisiteEvaluation');
    prerequisites.setAttributes({ evaluated: 5 });
    advanceTime(clock, 12);

    const targetResolution = trace.startSpan('TargetResolution');
    targetResolution.setAttributes({ scope: 'actors', attempt: 1 });
    advanceTime(clock, 33);
    targetResolution.setError(new Error('target resolution failed'));
    trace.endSpan(targetResolution);

    advanceTime(clock, 4);
    trace.endSpan(prerequisites);

    advanceTime(clock, 7);

    const execution = trace.startSpan('ExecutionPhase');
    execution.setAttributes({ actor: 'hero', target: 'antagonist' });
    advanceTime(clock, 20);

    const commandDispatch = trace.startSpan('CommandDispatch');
    commandDispatch.setAttributes({ command: 'attack', span: 'cmd-42' });
    advanceTime(clock, 40);
    trace.endSpan(commandDispatch);

    advanceTime(clock, 5);

    const cleanup = trace.startSpan('Cleanup');
    cleanup.setAttributes({ reason: 'post-run tidy' });
    advanceTime(clock, 10);
    trace.endSpan(cleanup);

    advanceTime(clock, 3);

    const notification = trace.startSpan('NotificationDispatch');
    notification.setAttributes({ subscribers: 3 });
    advanceTime(clock, 12);
    trace.endSpan(notification);

    advanceTime(clock, 5);
    trace.endSpan(execution);

    advanceTime(clock, 9);

    const summary = trace.startSpan('SummaryGeneration');
    summary.setAttributes({ nodes: 8 });
    advanceTime(clock, 22);
    trace.endSpan(summary);

    advanceTime(clock, 2);

    const fallback = trace.startSpan('FallbackOperation');
    fallback.setAttributes({ reason: 'missing resource' });
    advanceTime(clock, 15);
    fallback.setError(new TypeError('configuration missing value'));
    trace.endSpan(fallback);

    advanceTime(clock, 5);
    trace.endSpan(root);
  }

  it('performs comprehensive analysis across real trace data', () => {
    buildActionPipelineTrace();

    const analyzer = new TraceAnalyzer(trace);
    const analysis = analyzer.getComprehensiveAnalysis();

    expect(analysis.criticalPath.operations).toEqual([
      'ActionPipeline',
      'ExecutionPhase',
      'CommandDispatch',
    ]);
    expect(analysis.criticalPath.bottleneckOperations).toEqual([
      'ActionPipeline',
      'ExecutionPhase',
      'CommandDispatch',
    ]);
    expect(analysis.criticalPath.totalDuration).toBeGreaterThan(350);

    const defaultBottlenecks = analyzer.getBottlenecks();
    expect(defaultBottlenecks[0]).toMatchObject({
      operation: 'ActionPipeline',
      criticalPath: 'yes',
    });

    const thresholdBottlenecks = analyzer.getBottlenecks(20);
    expect(thresholdBottlenecks.map((b) => b.operation)).toEqual(
      expect.arrayContaining([
        'ActionPipeline',
        'ExecutionPhase',
        'PrerequisiteEvaluation',
        'DiscoveryPhase',
        'CommandDispatch',
        'TargetResolution',
        'SummaryGeneration',
      ])
    );
    const commandEntry = thresholdBottlenecks.find(
      (entry) => entry.operation === 'CommandDispatch'
    );
    expect(commandEntry).toMatchObject({
      criticalPath: 'yes',
      depth: 2,
      duration: 40,
    });

    const stats = analysis.operationStats;
    const targetStats = stats.find(
      (entry) => entry.operation === 'TargetResolution'
    );
    expect(targetStats).toMatchObject({
      count: 1,
      errorCount: 1,
      totalDuration: 33,
    });
    expect(targetStats.errorRate).toBeCloseTo(100);

    const fallbackStats = stats.find(
      (entry) => entry.operation === 'FallbackOperation'
    );
    expect(fallbackStats).toMatchObject({
      errorCount: 1,
      totalDuration: 15,
    });
    expect(analyzer.getOperationStats()).toBe(stats);

    const errorAnalysis = analysis.errorAnalysis;
    expect(errorAnalysis.totalErrors).toBe(2);
    expect(errorAnalysis.errorsByOperation).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: 'TargetResolution',
          errorCount: 1,
        }),
        expect.objectContaining({
          operation: 'FallbackOperation',
          errorCount: 1,
        }),
      ])
    );
    expect(errorAnalysis.errorsByType).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          errorType: 'Error',
          operations: ['TargetResolution'],
        }),
        expect.objectContaining({
          errorType: 'TypeError',
          operations: ['FallbackOperation'],
        }),
      ])
    );
    expect(errorAnalysis.criticalPathErrors).toHaveLength(0);
    expect(analyzer.getErrorAnalysis()).toBe(errorAnalysis);

    const profile = analysis.concurrencyProfile;
    expect(profile.maxConcurrency).toBe(3);
    expect(profile.parallelOperationCount).toBeGreaterThan(0);
    expect(profile.serialOperationCount).toBeGreaterThan(0);
    expect(profile.parallelOperations).toEqual(
      expect.arrayContaining([
        expect.stringContaining('ActionPipeline'),
        expect.stringContaining('ExecutionPhase'),
      ])
    );
    expect(profile.concurrentPeriods).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operations: expect.arrayContaining([
            'ActionPipeline',
            'ExecutionPhase',
          ]),
        }),
      ])
    );
    expect(analyzer.getConcurrencyProfile()).toBe(profile);

    expect(() => analyzer.getBottlenecks(-5)).toThrow(
      'Threshold must be a non-negative number'
    );
    expect(() => analyzer.getBottlenecks('slow')).toThrow(
      'Threshold must be a non-negative number'
    );

    const cached = analyzer.getCriticalPath();
    analyzer.invalidateCache();
    const recalculated = analyzer.getCriticalPath();
    expect(recalculated).not.toBe(cached);
    expect(recalculated.operations).toEqual(cached.operations);
  });

  it('handles traces without a root and incomplete timing data', () => {
    class SyntheticTrace {
      constructor(spans) {
        this.spans = spans;
      }

      getSpans() {
        return this.spans;
      }

      getHierarchicalView() {
        return null;
      }

      getCriticalPath() {
        return { operations: [], steps: [] };
      }
    }

    // Scenario: spans exist but none are root spans
    clock.current = 0;
    const orphanOnly = new Span(99, 'OrphanOnly', 500);
    clock.current += 5;
    orphanOnly.end();

    const rootlessAnalyzer = new TraceAnalyzer(
      new SyntheticTrace([orphanOnly])
    );
    expect(rootlessAnalyzer.getCriticalPath()).toEqual({
      operations: [],
      totalDuration: 0,
      percentageOfTotal: 0,
      steps: [],
      bottleneckOperations: [],
    });

    // Scenario: real spans with zero durations, missing parents and incomplete spans
    clock.current = 0;
    const zeroRoot = new Span(1, 'ZeroRoot', null);
    zeroRoot.end();

    clock.current = 5;
    const incompleteChild = new Span(2, 'IncompleteChild', 1);

    clock.current = 10;
    const orphanChild = new Span(3, 'OrphanChild', 42);
    clock.current = 15;
    orphanChild.end();

    clock.current = 20;
    const erroredChild = new Span(4, 'ErroredChild', 77);
    erroredChild.setError(new Error('boom'));
    clock.current = 30;
    erroredChild.end();

    const syntheticSpans = [
      zeroRoot,
      incompleteChild,
      orphanChild,
      erroredChild,
    ];
    const syntheticAnalyzer = new TraceAnalyzer(
      new SyntheticTrace(syntheticSpans)
    );

    const zeroCritical = syntheticAnalyzer.getCriticalPath();
    expect(zeroCritical.operations).toEqual(['ZeroRoot']);
    expect(zeroCritical.totalDuration).toBe(0);
    expect(zeroCritical.percentageOfTotal).toBe(0);
    expect(zeroCritical.steps[0].percentageOfPath).toBe(0);

    const zeroBottlenecks = syntheticAnalyzer.getBottlenecks(0);
    expect(zeroBottlenecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operation: 'ZeroRoot', depth: 0 }),
        expect.objectContaining({ operation: 'OrphanChild', depth: 1 }),
        expect.objectContaining({ operation: 'ErroredChild', depth: 1 }),
      ])
    );
    expect(
      zeroBottlenecks.some((entry) => entry.operation === 'IncompleteChild')
    ).toBe(false);

    const zeroStats = syntheticAnalyzer.getOperationStats();
    expect(
      zeroStats.find((entry) => entry.operation === 'ZeroRoot').totalDuration
    ).toBe(0);

    const zeroErrors = syntheticAnalyzer.getErrorAnalysis();
    expect(zeroErrors.totalErrors).toBe(1);
    expect(zeroErrors.errorsByType).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          errorType: 'Error',
          operations: ['ErroredChild'],
        }),
      ])
    );
    expect(zeroErrors.errorsByOperation[0].errorMessages).toEqual(['boom']);

    const zeroConcurrency = syntheticAnalyzer.getConcurrencyProfile();
    expect(zeroConcurrency.concurrentPeriods).toEqual([]);

    expect(syntheticAnalyzer.getOperationStats()).toBe(zeroStats);
    expect(syntheticAnalyzer.getErrorAnalysis()).toBe(zeroErrors);
    expect(syntheticAnalyzer.getConcurrencyProfile()).toBe(zeroConcurrency);

    // Extend the trace to cover additional analytical branches
    clock.current = 25;
    const nestedGrandchild = new Span(5, 'NestedGrandchild', 2);
    clock.current = 35;
    nestedGrandchild.end();

    clock.current = 40;
    const errorWithoutMessage = new Span(6, 'ErroredChild', 77);
    errorWithoutMessage.setStatus('error');
    clock.current = 45;
    errorWithoutMessage.end();

    clock.current = 50;
    const repeatedError = new Span(7, 'ErroredChild', 77);
    repeatedError.setError(new Error('alternate failure'));
    clock.current = 60;
    repeatedError.end();

    syntheticSpans.push(nestedGrandchild, errorWithoutMessage, repeatedError);

    syntheticAnalyzer.invalidateCache();

    const updatedCritical = syntheticAnalyzer.getCriticalPath();
    expect(updatedCritical.operations).toEqual([
      'ZeroRoot',
      'IncompleteChild',
      'NestedGrandchild',
    ]);
    expect(updatedCritical.steps[1].percentageOfPath).toBe(0);

    const updatedBottlenecks = syntheticAnalyzer.getBottlenecks(0);
    expect(updatedBottlenecks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ operation: 'NestedGrandchild', depth: 2 }),
        expect.objectContaining({ operation: 'ErroredChild' }),
      ])
    );

    const updatedStats = syntheticAnalyzer.getOperationStats();
    expect(
      updatedStats.find((entry) => entry.operation === 'NestedGrandchild')
        .totalDuration
    ).toBeGreaterThan(0);

    const updatedErrors = syntheticAnalyzer.getErrorAnalysis();
    const erroredSummary = updatedErrors.errorsByOperation.find(
      (entry) => entry.operation === 'ErroredChild'
    );
    expect(erroredSummary.errorCount).toBe(3);
    expect(erroredSummary.errorMessages).toContain('boom');
    expect(
      updatedErrors.errorsByType.find((item) => item.errorType === 'Error')
        .count
    ).toBeGreaterThanOrEqual(2);

    const updatedConcurrency = syntheticAnalyzer.getConcurrencyProfile();
    expect(updatedConcurrency.parallelOperations).toEqual(
      expect.arrayContaining([expect.stringContaining('NestedGrandchild')])
    );

    expect(syntheticAnalyzer.getOperationStats()).toBe(updatedStats);
    expect(syntheticAnalyzer.getErrorAnalysis()).toBe(updatedErrors);
    expect(syntheticAnalyzer.getConcurrencyProfile()).toBe(updatedConcurrency);
  });

  it('handles empty traces and resets caches cleanly', () => {
    const analyzer = new TraceAnalyzer(new StructuredTrace());

    expect(analyzer.getCriticalPath()).toEqual({
      operations: [],
      totalDuration: 0,
      percentageOfTotal: 0,
      steps: [],
      bottleneckOperations: [],
    });
    expect(analyzer.getBottlenecks()).toEqual([]);
    expect(analyzer.getConcurrencyProfile()).toEqual({
      maxConcurrency: 0,
      averageConcurrency: 0,
      concurrentPeriods: [],
      parallelOperations: [],
      serialOperationCount: 0,
      parallelOperationCount: 0,
    });

    const firstStats = analyzer.getOperationStats();
    expect(firstStats).toEqual([]);

    const firstCriticalPath = analyzer.getCriticalPath();
    const firstProfile = analyzer.getConcurrencyProfile();

    analyzer.invalidateCache();

    expect(analyzer.getCriticalPath()).not.toBe(firstCriticalPath);
    expect(analyzer.getConcurrencyProfile()).not.toBe(firstProfile);
  });
});
