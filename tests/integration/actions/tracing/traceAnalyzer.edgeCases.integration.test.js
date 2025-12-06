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
 * @typedef {{ current: number }} Clock
 */

/**
 * @description Advances the mocked performance clock by the specified amount.
 * @param {Clock} clock
 * @param {number} ms
 * @returns {void}
 */
function advanceTime(clock, ms) {
  clock.current += ms;
}

/**
 * @class SyntheticTrace
 * @description Minimal structured trace implementation for exercising TraceAnalyzer edge cases.
 */
class SyntheticTrace {
  /**
   * @description Creates a synthetic structured trace implementation for testing.
   * @param {Span[]} spans
   * @param {string[]} criticalPath
   * @returns {void}
   */
  constructor(spans, criticalPath = []) {
    this.spans = spans;
    this.criticalPath = criticalPath;
  }

  /**
   * @description Returns the spans available in this synthetic trace.
   * @returns {Span[]}
   */
  getSpans() {
    return this.spans;
  }

  /**
   * @description Provides a minimal hierarchical view for dependency validation.
   * @returns {{ spans: Span[] }}
   */
  getHierarchicalView() {
    return { spans: this.spans };
  }

  /**
   * @description Supplies the precomputed critical path operations for this trace.
   * @returns {string[]}
   */
  getCriticalPath() {
    return this.criticalPath;
  }
}

describe('TraceAnalyzer edge case integration coverage', () => {
  /** @type {Clock} */
  let clock;
  /** @type {jest.SpiedFunction<typeof performance.now>} */
  let performanceSpy;

  beforeEach(() => {
    clock = { current: 0 };
    performanceSpy = jest
      .spyOn(performance, 'now')
      .mockImplementation(() => clock.current);
  });

  afterEach(() => {
    performanceSpy.mockRestore();
  });

  it('returns an empty critical path when spans lack a root node', () => {
    const orphanA = new Span(1, 'stage:orphanA', 2);
    const orphanB = new Span(2, 'stage:orphanB', 3);

    const analyzer = new TraceAnalyzer(new SyntheticTrace([orphanA, orphanB]));

    const criticalPath = analyzer.getCriticalPath();

    expect(criticalPath.operations).toEqual([]);
    expect(criticalPath.totalDuration).toBe(0);
    expect(criticalPath.steps).toHaveLength(0);
  });

  it('throws when bottleneck threshold is negative', () => {
    const trace = new StructuredTrace();
    const root = trace.startSpan('ActionPipeline');

    advanceTime(clock, 5);
    trace.endSpan(root);

    const analyzer = new TraceAnalyzer(trace);

    expect(() => analyzer.getBottlenecks(-5)).toThrow(
      'Threshold must be a non-negative number'
    );
  });

  it('skips operations without completed spans when compiling operation stats', () => {
    const completed = new Span(10, 'completed-operation', null);
    advanceTime(clock, 7);
    completed.end();

    const pending = new Span(11, 'pending-operation', null);
    // Intentionally do not end pending to keep duration null.

    const analyzer = new TraceAnalyzer(
      new SyntheticTrace([completed, pending], ['completed-operation'])
    );

    const stats = analyzer.getOperationStats();

    expect(stats.map((entry) => entry.operation)).toContain(
      'completed-operation'
    );
    expect(stats.map((entry) => entry.operation)).not.toContain(
      'pending-operation'
    );
  });

  it('aggregates repeated spans for the same operation when compiling statistics', () => {
    const first = new Span(20, 'repeat-operation', null);
    advanceTime(clock, 3);
    first.end();

    const second = new Span(21, 'repeat-operation', null);
    advanceTime(clock, 4);
    second.end();

    const analyzer = new TraceAnalyzer(
      new SyntheticTrace([first, second], ['repeat-operation'])
    );

    const stats = analyzer.getOperationStats();

    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({
      operation: 'repeat-operation',
      count: 2,
      errorCount: 0,
    });
  });

  it('tracks critical path errors and caches concurrency profiles', () => {
    const trace = new StructuredTrace();

    const root = trace.startSpan('ActionPipeline');
    advanceTime(clock, 5);

    const discovery = trace.startSpan('DiscoveryPhase');
    advanceTime(clock, 4);

    const evaluation = trace.startSpan('EvaluationStage');
    advanceTime(clock, 6);
    trace.endSpan(evaluation);

    advanceTime(clock, 2);
    const resolution = trace.startSpan('ResolutionStage');
    resolution.setError(new Error('resolution failure'));
    advanceTime(clock, 9);
    trace.endSpan(resolution);

    advanceTime(clock, 3);
    trace.endSpan(discovery);

    advanceTime(clock, 1);
    trace.endSpan(root);

    const analyzer = new TraceAnalyzer(trace);

    const criticalPath = analyzer.getCriticalPath();
    expect(criticalPath.operations).toEqual([
      'ActionPipeline',
      'DiscoveryPhase',
      'ResolutionStage',
    ]);

    const errorAnalysis = analyzer.getErrorAnalysis();
    expect(errorAnalysis.criticalPathErrors).toEqual(['ResolutionStage']);

    const concurrencyProfile = analyzer.getConcurrencyProfile();
    expect(concurrencyProfile.maxConcurrency).toBeGreaterThan(1);

    const cachedProfile = analyzer.getConcurrencyProfile();
    expect(cachedProfile).toBe(concurrencyProfile);
  });

  it('calculates span depth defensively when parents are missing', () => {
    const orphanChild = new Span(50, 'orphan-child', 999);
    advanceTime(clock, 4);
    orphanChild.end();

    const analyzer = new TraceAnalyzer(
      new SyntheticTrace([orphanChild], ['orphan-child'])
    );

    const bottlenecks = analyzer.getBottlenecks(0);

    expect(bottlenecks).toHaveLength(1);
    expect(bottlenecks[0]).toMatchObject({
      operation: 'orphan-child',
      depth: 1,
    });
  });

  it('handles zero-duration critical paths gracefully', () => {
    const root = new Span(60, 'root-zero', null);
    root.end();

    const child = new Span(61, 'child-zero', 60);
    child.end();

    const analyzer = new TraceAnalyzer(
      new SyntheticTrace([root, child], ['root-zero', 'child-zero'])
    );

    const criticalPath = analyzer.getCriticalPath();

    expect(criticalPath.totalDuration).toBe(0);
    expect(criticalPath.steps).not.toHaveLength(0);
    expect(
      criticalPath.steps.every((step) => step.percentageOfPath === 0)
    ).toBe(true);
    expect(
      criticalPath.bottleneckOperations.every((operation) =>
        ['root-zero', 'child-zero'].includes(operation)
      )
    ).toBe(true);
  });

  it('summarizes error patterns even when spans omit error objects', () => {
    const root = new Span(70, 'analysis-root', null);
    advanceTime(clock, 2);
    root.end();

    const errorOne = new Span(71, 'error-op', null);
    advanceTime(clock, 3);
    errorOne.setError(new Error('failure one'));
    errorOne.end();

    const errorTwo = new Span(72, 'error-op', null);
    advanceTime(clock, 4);
    errorTwo.setError(new Error('failure two'));
    errorTwo.end();

    const errorStatusOnly = new Span(73, 'error-op', null);
    advanceTime(clock, 1);
    errorStatusOnly.setStatus('error');
    errorStatusOnly.end();

    const analyzer = new TraceAnalyzer(
      new SyntheticTrace(
        [root, errorOne, errorTwo, errorStatusOnly],
        ['analysis-root', 'error-op']
      )
    );

    const errorAnalysis = analyzer.getErrorAnalysis();

    const operationSummary = errorAnalysis.errorsByOperation.find(
      (entry) => entry.operation === 'error-op'
    );
    expect(operationSummary).toMatchObject({ errorCount: 3 });
    expect(operationSummary.errorMessages).toEqual([
      'failure one',
      'failure two',
    ]);

    const typeSummary = errorAnalysis.errorsByType.find(
      (entry) => entry.errorType === 'Error'
    );
    expect(typeSummary).toMatchObject({ count: 2 });
  });

  it('treats root spans without duration as zero-length traces', () => {
    const trace = new StructuredTrace();
    const pipeline = trace.startSpan('ZeroDurationPipeline');

    const stage = trace.startSpan('StageWithDuration');
    advanceTime(clock, 5);
    trace.endSpan(stage);

    const analyzer = new TraceAnalyzer(trace);

    const criticalPath = analyzer.getCriticalPath();
    expect(criticalPath.operations).toEqual([
      'ZeroDurationPipeline',
      'StageWithDuration',
    ]);
    expect(criticalPath.totalDuration).toBeGreaterThan(0);

    const bottlenecks = analyzer.getBottlenecks(0);
    expect(bottlenecks[0]).toMatchObject({
      operation: 'StageWithDuration',
      criticalPath: 'yes',
    });

    trace.endSpan(pipeline);
  });
});
