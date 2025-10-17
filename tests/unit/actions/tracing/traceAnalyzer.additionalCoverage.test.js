import { describe, it, expect, jest } from '@jest/globals';
import TraceAnalyzer from '../../../../src/actions/tracing/traceAnalyzer.js';

/**
 * Helper to create a minimal structured trace stub that satisfies dependency validation.
 *
 * @param {Array<object>} spans - Spans returned by getSpans.
 * @returns {{getSpans: Function, getHierarchicalView: Function, getCriticalPath: Function}}
 */
function createTraceStub(spans) {
  return {
    getSpans: jest.fn(() => spans),
    getHierarchicalView: jest.fn(() => ({ spans })),
    getCriticalPath: jest.fn(() => ({ operations: [] })),
  };
}

describe('TraceAnalyzer additional branch coverage', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns an empty critical path when spans exist without a root span', () => {
    const spans = [
      {
        id: 'child',
        parentId: 'ghost-parent',
        duration: 15,
        operation: 'OrphanOperation',
        attributes: {},
      },
    ];
    const analyzer = new TraceAnalyzer(createTraceStub(spans));

    const criticalPath = analyzer.getCriticalPath();

    expect(criticalPath).toEqual({
      operations: [],
      totalDuration: 0,
      percentageOfTotal: 0,
      steps: [],
      bottleneckOperations: [],
    });
  });

  it('calculates zero percentages when every span duration is falsy', () => {
    const spans = [
      {
        id: 'root',
        parentId: null,
        duration: 0,
        operation: 'RootZero',
        attributes: {},
      },
      {
        id: 'child-null',
        parentId: 'root',
        duration: null,
        operation: 'ChildNull',
        attributes: {},
      },
      {
        id: 'child-zero',
        parentId: 'root',
        duration: 0,
        operation: 'ChildZero',
        attributes: {},
      },
    ];

    const analyzer = new TraceAnalyzer(createTraceStub(spans));
    const criticalPath = analyzer.getCriticalPath();

    expect(criticalPath.percentageOfTotal).toBe(0);
    expect(criticalPath.totalDuration).toBe(0);
    expect(criticalPath.operations).toEqual(['RootZero']);
    expect(
      criticalPath.steps.every((step) => step.percentageOfPath === 0)
    ).toBe(true);
  });

  it('computes bottleneck depth even when parent spans are missing', () => {
    const spans = [
      {
        id: 'root',
        parentId: null,
        duration: 40,
        operation: 'RootOperation',
        attributes: {},
      },
      {
        id: 'orphan',
        parentId: 'missing-parent',
        duration: 200,
        operation: 'OrphanOperation',
        attributes: {},
      },
    ];

    const analyzer = new TraceAnalyzer(createTraceStub(spans));
    const bottlenecks = analyzer.getBottlenecks(150);

    expect(bottlenecks).toHaveLength(1);
    expect(bottlenecks[0]).toMatchObject({
      operation: 'OrphanOperation',
      depth: 1,
    });
  });

  it('skips operations that never completed when calculating statistics', () => {
    const spans = [
      {
        id: 'pending',
        parentId: null,
        duration: null,
        status: 'success',
        operation: 'PendingOperation',
        attributes: {},
      },
      {
        id: 'completed',
        parentId: null,
        duration: 25,
        status: 'success',
        operation: 'CompletedOperation',
        attributes: {},
      },
    ];

    const analyzer = new TraceAnalyzer(createTraceStub(spans));
    const stats = analyzer.getOperationStats();

    expect(stats).toHaveLength(1);
    expect(stats[0]).toMatchObject({
      operation: 'CompletedOperation',
      totalDuration: 25,
      count: 1,
    });
  });

  it('handles inconsistent operation names when building error summaries', () => {
    let operationCallCount = 0;
    const mutatingOperationSpan = {
      id: 'mutating',
      parentId: null,
      duration: 10,
      status: 'error',
      attributes: {},
      error: { message: 'First failure', constructor: { name: 'TypeError' } },
      get operation() {
        operationCallCount += 1;
        return operationCallCount === 1 ? 'OriginalOp' : 'MutatedOp';
      },
    };

    const errorWithoutDetails = {
      id: 'no-error-object',
      parentId: null,
      duration: 5,
      status: 'error',
      attributes: {},
      error: undefined,
      operation: 'NoErrorDetails',
    };

    const successSpan = {
      id: 'success',
      parentId: null,
      duration: 5,
      status: 'success',
      attributes: {},
      operation: 'SuccessOp',
    };

    const spans = [mutatingOperationSpan, errorWithoutDetails, successSpan];
    const analyzer = new TraceAnalyzer(createTraceStub(spans));

    const criticalPathSpy = jest
      .spyOn(analyzer, 'getCriticalPath')
      .mockReturnValue({ operations: [] });

    const analysis = analyzer.getErrorAnalysis();
    criticalPathSpy.mockRestore();

    const mutatedOpSummary = analysis.errorsByOperation.find(
      (entry) => entry.operation === 'MutatedOp'
    );

    expect(mutatedOpSummary.totalCount).toBe(0);
    expect(mutatedOpSummary.errorRate).toBe(100);

    const noDetailsSummary = analysis.errorsByOperation.find(
      (entry) => entry.operation === 'NoErrorDetails'
    );
    expect(noDetailsSummary.errorMessages).toHaveLength(0);
  });

  it('returns zero error rate when there are no spans to analyze', () => {
    const analyzer = new TraceAnalyzer(createTraceStub([]));

    const analysis = analyzer.getErrorAnalysis();

    expect(analysis.totalErrors).toBe(0);
    expect(analysis.totalOperations).toBe(0);
    expect(analysis.overallErrorRate).toBe(0);
  });

  it('treats derived totals as zero even when the critical path includes children', () => {
    let grandchildDurationAccesses = 0;
    const spans = [
      {
        id: 'root',
        parentId: null,
        get duration() {
          return undefined;
        },
        operation: 'Root',
        attributes: {},
      },
      {
        id: 'child',
        parentId: 'root',
        get duration() {
          return undefined;
        },
        operation: 'Child',
        attributes: {},
      },
      {
        id: 'grandchild',
        parentId: 'child',
        get duration() {
          grandchildDurationAccesses += 1;
          return grandchildDurationAccesses <= 2 ? 8 : 0;
        },
        operation: 'Grandchild',
        attributes: {},
      },
    ];

    const analyzer = new TraceAnalyzer(createTraceStub(spans));

    try {
      const criticalPath = analyzer.getCriticalPath();
      expect(criticalPath.operations).toEqual(['Root', 'Child', 'Grandchild']);
      expect(criticalPath.steps).toHaveLength(3);
      expect(criticalPath.totalDuration).toBe(0);
      expect(
        criticalPath.steps.every((step) => step.percentageOfPath === 0)
      ).toBe(true);
    } finally {
      grandchildDurationAccesses = 0;
    }
  });

  it('falls back to zero when the root span cannot be rediscovered', () => {
    let parentAccessCount = 0;
    const rootSpan = {
      id: 'root',
      duration: 12,
      operation: 'Root',
      attributes: {},
      get parentId() {
        parentAccessCount += 1;
        return parentAccessCount === 1 ? null : 'mutated-parent';
      },
    };

    const childSpan = {
      id: 'child',
      parentId: 'root',
      duration: 4,
      operation: 'Child',
      attributes: {},
    };

    const analyzer = new TraceAnalyzer(createTraceStub([rootSpan, childSpan]));
    const criticalPath = analyzer.getCriticalPath();

    expect(criticalPath.totalDuration).toBe(16);
    expect(criticalPath.percentageOfTotal).toBe(0);
  });

  it('falls back to zero average concurrency when events cannot accumulate levels', () => {
    const spans = [
      {
        id: 'first',
        parentId: null,
        operation: 'Op1',
        attributes: {},
        startTime: 0,
        endTime: 10,
      },
      {
        id: 'second',
        parentId: null,
        operation: 'Op2',
        attributes: {},
        startTime: 5,
        endTime: 15,
      },
    ];

    const analyzer = new TraceAnalyzer(createTraceStub(spans));

    const originalPush = Array.prototype.push;
    Array.prototype.push = function (...args) {
      const stack = new Error().stack || '';
      const result = originalPush.apply(this, args);
      if (
        stack.includes('getConcurrencyProfile') &&
        args.length > 0 &&
        typeof args[0] === 'number'
      ) {
        this.length = 0;
      }
      return result;
    };

    try {
      const profile = analyzer.getConcurrencyProfile();
      expect(profile.averageConcurrency).toBe(0);
      expect(profile.maxConcurrency).toBeGreaterThanOrEqual(0);
    } finally {
      Array.prototype.push = originalPush;
    }
  });
});
