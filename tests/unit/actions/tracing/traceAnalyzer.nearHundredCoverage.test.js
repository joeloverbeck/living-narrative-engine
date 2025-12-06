import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import TraceAnalyzer from '../../../../src/actions/tracing/traceAnalyzer.js';

/**
 * Helper stub implementing the StructuredTrace interface expected by TraceAnalyzer.
 */
class TraceStub {
  constructor(spans) {
    this._spans = spans;
    this.getSpans = jest.fn(() => this._spans);
    this.getHierarchicalView = jest.fn(() => ({ spans: this._spans }));
    this.getCriticalPath = jest.fn(() => ({ operations: [] }));
  }

  setSpans(spans) {
    this._spans = spans;
  }
}

const buildSpan = ({
  id,
  parentId,
  operation,
  duration,
  status = 'success',
  startTime,
  endTime,
  error,
  attributes = {},
}) => ({
  id,
  parentId,
  operation,
  duration,
  status,
  startTime,
  endTime,
  error,
  attributes,
});

describe('TraceAnalyzer near total coverage scenarios', () => {
  let traceStub;
  let analyzer;

  describe('comprehensive analytics on overlapping spans', () => {
    beforeEach(() => {
      const spans = [
        buildSpan({
          id: 'root',
          parentId: null,
          operation: 'rootOp',
          duration: 600,
          startTime: 0,
          endTime: 600,
        }),
        buildSpan({
          id: 'alpha',
          parentId: 'root',
          operation: 'alphaOp',
          duration: 100,
          status: 'error',
          startTime: 0,
          endTime: 100,
          error: new TypeError('Alpha fail'),
        }),
        buildSpan({
          id: 'beta',
          parentId: 'root',
          operation: 'betaOp',
          duration: 200,
          startTime: 150,
          endTime: 300,
        }),
        buildSpan({
          id: 'gamma',
          parentId: 'beta',
          operation: 'gammaOp',
          duration: 120,
          status: 'error',
          startTime: 200,
          endTime: 350,
          error: new ReferenceError('Gamma fail'),
        }),
        buildSpan({
          id: 'delta',
          parentId: 'gamma',
          operation: 'deltaOp',
          duration: 90,
          startTime: 220,
          endTime: 310,
        }),
        buildSpan({
          id: 'epsilon',
          parentId: 'root',
          operation: 'epsilonOp',
          duration: null,
          startTime: 400,
          endTime: null,
        }),
        buildSpan({
          id: 'zeta',
          parentId: 'root',
          operation: 'zetaOp',
          duration: 50,
          startTime: 360,
          endTime: 410,
        }),
      ];

      traceStub = new TraceStub(spans);
      analyzer = new TraceAnalyzer(traceStub);
    });

    it('calculates detailed critical path metrics', () => {
      const criticalPath = analyzer.getCriticalPath();

      expect(criticalPath.operations).toEqual([
        'rootOp',
        'betaOp',
        'gammaOp',
        'deltaOp',
      ]);
      expect(criticalPath.totalDuration).toBe(1010);
      expect(criticalPath.steps).toHaveLength(4);
      expect(criticalPath.steps[0]).toMatchObject({
        operation: 'rootOp',
        cumulativeDuration: 600,
      });
      expect(criticalPath.bottleneckOperations).toEqual([
        'rootOp',
        'betaOp',
        'gammaOp',
      ]);
      // Percentage can be over 100 when nested spans exceed root duration.
      expect(criticalPath.percentageOfTotal).toBeCloseTo(168.33, 2);
    });

    it('identifies bottlenecks with depth and critical path awareness', () => {
      const bottlenecks = analyzer.getBottlenecks();

      expect(bottlenecks.map((entry) => entry.operation)).toEqual([
        'rootOp',
        'betaOp',
        'gammaOp',
        'alphaOp',
      ]);
      expect(bottlenecks.map((entry) => entry.depth)).toEqual([0, 1, 2, 1]);
      expect(
        bottlenecks.filter((entry) => entry.criticalPath === 'yes')
      ).toHaveLength(3);
    });

    it('summarizes operation statistics including error rates', () => {
      const stats = analyzer.getOperationStats();

      expect(stats.map((entry) => entry.operation)).toEqual([
        'rootOp',
        'betaOp',
        'gammaOp',
        'alphaOp',
        'deltaOp',
        'zetaOp',
      ]);
      const gammaStats = stats.find((entry) => entry.operation === 'gammaOp');
      expect(gammaStats).toMatchObject({
        totalDuration: 120,
        errorCount: 1,
        errorRate: 100,
      });
      const alphaStats = stats.find((entry) => entry.operation === 'alphaOp');
      expect(alphaStats.minDuration).toBe(100);
      expect(alphaStats.maxDuration).toBe(100);
      expect(analyzer.getOperationStats()).toBe(stats);
    });

    it('groups errors by operation and type and highlights critical path issues', () => {
      const analysis = analyzer.getErrorAnalysis();

      expect(analysis.totalErrors).toBe(2);
      expect(analysis.totalOperations).toBe(7);
      expect(analysis.overallErrorRate).toBeCloseTo(28.57, 2);
      const typeSummary = analysis.errorsByType.find(
        (entry) => entry.errorType === 'ReferenceError'
      );
      expect(typeSummary.operations).toContain('gammaOp');
      expect(analysis.criticalPathErrors).toEqual(['gammaOp']);
      expect(analyzer.getErrorAnalysis()).toBe(analysis);
    });

    it('builds concurrency profile with overlapping spans', () => {
      const profile = analyzer.getConcurrencyProfile();

      expect(profile.maxConcurrency).toBe(4);
      expect(profile.averageConcurrency).toBeCloseTo(1.83, 2);
      expect(profile.concurrentPeriods).toHaveLength(3);
      expect(profile.parallelOperations.sort()).toEqual([
        'alphaOp|rootOp',
        'gammaOp|rootOp',
        'rootOp|zetaOp',
      ]);
      expect(profile.serialOperationCount).toBe(3);
      expect(profile.parallelOperationCount).toBe(3);
      expect(analyzer.getConcurrencyProfile()).toBe(profile);
    });

    it('provides a combined analysis snapshot', () => {
      const snapshot = analyzer.getComprehensiveAnalysis();

      expect(snapshot.criticalPath.operations).toContain('betaOp');
      expect(snapshot.bottlenecks).toHaveLength(4);
      expect(snapshot.operationStats[0].operation).toBe('rootOp');
      expect(snapshot.errorAnalysis.totalErrors).toBe(2);
      expect(snapshot.concurrencyProfile.parallelOperationCount).toBe(3);
    });
  });

  describe('input validation and graceful fallbacks', () => {
    beforeEach(() => {
      const spans = [
        buildSpan({
          id: 'orphan',
          parentId: 'ghost',
          operation: 'OrphanOp',
          duration: null,
          startTime: undefined,
          endTime: undefined,
        }),
      ];
      traceStub = new TraceStub(spans);
      analyzer = new TraceAnalyzer(traceStub);
    });

    it('validates bottleneck thresholds', () => {
      expect(() => analyzer.getBottlenecks(null)).toThrow(
        'Threshold is required'
      );
      expect(() => analyzer.getBottlenecks(-10)).toThrow(
        'Threshold must be a non-negative number'
      );
      expect(() => analyzer.getBottlenecks('slow')).toThrow(
        'Threshold must be a non-negative number'
      );
    });

    it('returns empty structures when trace data is incomplete', () => {
      const criticalPath = analyzer.getCriticalPath();
      expect(criticalPath).toEqual({
        operations: [],
        totalDuration: 0,
        percentageOfTotal: 0,
        steps: [],
        bottleneckOperations: [],
      });

      const profile = analyzer.getConcurrencyProfile();
      expect(profile).toEqual({
        maxConcurrency: 0,
        averageConcurrency: 0,
        concurrentPeriods: [],
        parallelOperations: [],
        serialOperationCount: 0,
        parallelOperationCount: 0,
      });

      traceStub.setSpans([]);
      analyzer.invalidateCache();
      const emptyPath = analyzer.getCriticalPath();
      expect(emptyPath.operations).toHaveLength(0);
      const emptyProfile = analyzer.getConcurrencyProfile();
      expect(emptyProfile.parallelOperations).toHaveLength(0);
    });
  });

  describe('cache invalidation behavior', () => {
    beforeEach(() => {
      traceStub = new TraceStub([
        buildSpan({
          id: 'root',
          parentId: null,
          operation: 'Root',
          duration: 100,
        }),
        buildSpan({
          id: 'child',
          parentId: 'root',
          operation: 'Child',
          duration: 50,
        }),
      ]);
      analyzer = new TraceAnalyzer(traceStub);
    });

    it('refreshes cached computations after invalidateCache is called', () => {
      const originalPath = analyzer.getCriticalPath();
      expect(analyzer.getCriticalPath()).toBe(originalPath);

      traceStub.setSpans([
        buildSpan({
          id: 'root',
          parentId: null,
          operation: 'Root',
          duration: 20,
        }),
        buildSpan({
          id: 'long',
          parentId: 'root',
          operation: 'LongerChild',
          duration: 200,
        }),
      ]);

      analyzer.invalidateCache();
      const updatedPath = analyzer.getCriticalPath();

      expect(updatedPath).not.toBe(originalPath);
      expect(updatedPath.operations).toEqual(['Root', 'LongerChild']);
      expect(updatedPath.totalDuration).toBe(220);
    });
  });
});
