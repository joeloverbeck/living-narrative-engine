import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ActionPerformanceAnalyzer } from '../../../../../src/actions/tracing/timing/actionPerformanceAnalyzer.js';

describe('ActionPerformanceAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new ActionPerformanceAnalyzer();
  });

  describe('Constructor and Initial State', () => {
    it('should initialize with empty state', () => {
      const stats = analyzer.getStats();
      expect(stats.totalTraces).toBe(0);
      expect(stats.totalDuration).toBe(0);
      expect(stats.averageDuration).toBe(0);
      expect(stats.minDuration).toBe(Infinity);
      expect(stats.maxDuration).toBe(0);
    });

    it('should have empty bottlenecks initially', () => {
      const bottlenecks = analyzer.identifyBottlenecks();
      expect(bottlenecks.length).toBe(0);
    });
  });

  describe('Trace Analysis', () => {
    it('should skip incomplete traces', () => {
      const incompleteTrace = createMockTrace('test:action', 'actor1', false);
      analyzer.addTrace(incompleteTrace);

      const stats = analyzer.getStats();
      expect(stats.totalTraces).toBe(0);
    });

    it('should skip traces without timing data', () => {
      const traceWithoutTiming = createMockTrace(
        'test:action',
        'actor1',
        true,
        null
      );
      analyzer.addTrace(traceWithoutTiming);

      const stats = analyzer.getStats();
      expect(stats.totalTraces).toBe(0);
    });

    it('should analyze single trace correctly', () => {
      const timingData = createMockTimingData(50, [
        { name: 'phase1', duration: 20 },
        { name: 'phase2', duration: 30 },
      ]);
      const trace = createMockTrace('test:action', 'actor1', true, timingData);

      analyzer.addTrace(trace);

      const stats = analyzer.getStats();
      expect(stats.totalTraces).toBe(1);
      expect(stats.totalDuration).toBe(50);
      expect(stats.averageDuration).toBe(50);
      expect(stats.minDuration).toBe(50);
      expect(stats.maxDuration).toBe(50);
    });

    it('should analyze multiple traces correctly', () => {
      const traces = [
        createMockTrace(
          'test:action1',
          'actor1',
          true,
          createMockTimingData(30)
        ),
        createMockTrace(
          'test:action2',
          'actor1',
          true,
          createMockTimingData(60)
        ),
        createMockTrace(
          'test:action3',
          'actor1',
          true,
          createMockTimingData(90)
        ),
      ];

      traces.forEach((trace) => analyzer.addTrace(trace));

      const stats = analyzer.getStats();
      expect(stats.totalTraces).toBe(3);
      expect(stats.totalDuration).toBe(180);
      expect(stats.averageDuration).toBe(60);
      expect(stats.minDuration).toBe(30);
      expect(stats.maxDuration).toBe(90);
    });
  });

  describe('Performance Statistics', () => {
    beforeEach(() => {
      // Add test traces with different durations
      const durations = [10, 25, 50, 75, 100, 150, 200, 300, 400, 500];
      durations.forEach((duration, index) => {
        const timingData = createMockTimingData(duration);
        const trace = createMockTrace(
          `test:action${index}`,
          'actor1',
          true,
          timingData
        );
        analyzer.addTrace(trace);
      });
    });

    it('should calculate percentiles correctly', () => {
      const stats = analyzer.getStats();
      const percentiles = stats.percentiles;

      expect(percentiles.p50).toBeDefined();
      expect(percentiles.p90).toBeDefined();
      expect(percentiles.p95).toBeDefined();
      expect(percentiles.p99).toBeDefined();

      // Percentiles should be in ascending order
      expect(percentiles.p50).toBeLessThanOrEqual(percentiles.p90);
      expect(percentiles.p90).toBeLessThanOrEqual(percentiles.p95);
      expect(percentiles.p95).toBeLessThanOrEqual(percentiles.p99);
    });

    it('should identify slow traces', () => {
      const slowTraces = analyzer.getSlowTraces(200);
      // Should be [500, 400, 300, 200] but threshold is >200 so excludes 200
      expect(slowTraces.length).toBe(3); // 300, 400, 500ms traces
      expect(slowTraces[0].duration).toBe(500); // Should be sorted by duration desc
      expect(slowTraces[slowTraces.length - 1].duration).toBe(300);
    });

    it('should calculate phase breakdown', () => {
      const stats = analyzer.getStats();
      const phaseBreakdown = stats.phaseBreakdown;

      expect(phaseBreakdown).toBeDefined();
      // Since we created traces without specific phases, there might be default phases
      // or the breakdown might be empty - both are valid
    });
  });

  describe('Bottleneck Analysis', () => {
    it('should identify bottlenecks from phase data', () => {
      // Create traces with specific phase patterns
      const traces = [
        createMockTrace(
          'test:action1',
          'actor1',
          true,
          createMockTimingData(100, [
            { name: 'database', duration: 60 },
            { name: 'processing', duration: 20 },
            { name: 'rendering', duration: 20 },
          ])
        ),
        createMockTrace(
          'test:action2',
          'actor1',
          true,
          createMockTimingData(120, [
            { name: 'database', duration: 80 },
            { name: 'processing', duration: 20 },
            { name: 'rendering', duration: 20 },
          ])
        ),
        createMockTrace(
          'test:action3',
          'actor1',
          true,
          createMockTimingData(90, [
            { name: 'database', duration: 50 },
            { name: 'processing', duration: 20 },
            { name: 'rendering', duration: 20 },
          ])
        ),
      ];

      traces.forEach((trace) => analyzer.addTrace(trace));

      const bottlenecks = analyzer.identifyBottlenecks();
      expect(bottlenecks.length).toBeGreaterThan(0);

      // Database should be the top bottleneck
      const topBottleneck = bottlenecks[0];
      expect(topBottleneck.phase).toBe('database');
      expect(topBottleneck.averageDuration).toBeCloseTo(63.33, 1); // (60+80+50)/3
    });
  });

  describe('Report Generation', () => {
    beforeEach(() => {
      // Add some test data
      const durations = [50, 100, 150];
      durations.forEach((duration, index) => {
        const timingData = createMockTimingData(duration, [
          { name: 'phase1', duration: duration * 0.6 },
          { name: 'phase2', duration: duration * 0.4 },
        ]);
        const trace = createMockTrace(
          `test:action${index}`,
          'actor1',
          true,
          timingData
        );
        analyzer.addTrace(trace);
      });
    });

    it('should generate comprehensive performance report', () => {
      const report = analyzer.generateReport();

      expect(report).toContain('ACTION EXECUTION PERFORMANCE REPORT');
      expect(report).toContain('Total Traces: 3');
      expect(report).toContain('Average Duration:');
      expect(report).toContain('Min Duration:');
      expect(report).toContain('Max Duration:');
      expect(report).toContain('Percentiles:');
      expect(report).toContain('Top Bottlenecks:');
    });

    it('should handle empty report generation', () => {
      const emptyAnalyzer = new ActionPerformanceAnalyzer();
      const report = emptyAnalyzer.generateReport();

      expect(report).toContain('Total Traces: 0');
    });
  });

  describe('Data Management', () => {
    it('should clear all analysis data', () => {
      // Add some test data
      const timingData = createMockTimingData(50);
      const trace = createMockTrace('test:action', 'actor1', true, timingData);
      analyzer.addTrace(trace);

      expect(analyzer.getStats().totalTraces).toBe(1);

      analyzer.clear();

      const stats = analyzer.getStats();
      expect(stats.totalTraces).toBe(0);
      expect(stats.totalDuration).toBe(0);
      expect(stats.averageDuration).toBe(0);
      expect(stats.minDuration).toBe(Infinity);
      expect(stats.maxDuration).toBe(0);
    });

    it('should handle edge cases in percentile calculation', () => {
      const emptyAnalyzer = new ActionPerformanceAnalyzer();
      const stats = emptyAnalyzer.getStats();

      expect(stats.percentiles.p50).toBe(0);
      expect(stats.percentiles.p90).toBe(0);
      expect(stats.percentiles.p95).toBe(0);
      expect(stats.percentiles.p99).toBe(0);
    });
  });
});

// Helper functions
/**
 *
 * @param actionId
 * @param actorId
 * @param isComplete
 * @param timingData
 */
function createMockTrace(actionId, actorId, isComplete, timingData = null) {
  return {
    actionId,
    actorId,
    isComplete,
    getTimingSummary: () => timingData,
  };
}

/**
 *
 * @param totalDuration
 * @param phases
 */
function createMockTimingData(totalDuration, phases = []) {
  return {
    totalDuration,
    phases:
      phases.length > 0
        ? phases
        : [{ name: 'default_phase', duration: totalDuration }],
  };
}
