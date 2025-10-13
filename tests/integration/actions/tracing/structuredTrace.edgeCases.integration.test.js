/**
 * @file Additional integration tests for StructuredTrace edge cases.
 * Ensures near-total coverage by exercising error branches, caching, and
 * configuration-driven behavior that existing suites do not hit.
 */

import { describe, it, expect } from '@jest/globals';
import { StructuredTrace } from '../../../../src/actions/tracing/structuredTrace.js';

const createFullyEnabledConfig = () => ({
  traceAnalysisEnabled: true,
  analysis: { enabled: true },
  visualization: { enabled: true },
  performanceMonitoring: {
    enabled: true,
    thresholds: { slowOperation: 25 },
    sampling: { enabled: true, rate: 1 },
  },
});

describe('StructuredTrace edge case integration', () => {
  it('should return null hierarchy and zeroed summary when no spans exist', () => {
    const trace = new StructuredTrace();

    expect(trace.getHierarchicalView()).toBeNull();
    expect(trace.getPerformanceSummary()).toEqual({
      totalDuration: 0,
      operationCount: 0,
      criticalPath: [],
      slowestOperations: [],
      errorCount: 0,
      operationStats: {},
    });
    expect(trace.getCriticalPath()).toEqual([]);
  });

  it('should capture span errors in hierarchical view after nested failures', () => {
    const trace = new StructuredTrace();

    try {
      trace.withSpan('root-operation', () => {
        trace.withSpan('child-operation', () => {
          throw new Error('nested failure');
        });
      });
    } catch (error) {
      expect(error.message).toBe('nested failure');
    }

    const hierarchy = trace.getHierarchicalView();
    expect(hierarchy).not.toBeNull();
    expect(hierarchy?.operation).toBe('root-operation');
    expect(hierarchy?.error).toBe('nested failure');
    expect(hierarchy?.children[0].operation).toBe('child-operation');
  });

  it('should reflect active span transitions during nested execution', () => {
    const trace = new StructuredTrace();
    let outerSpanId;

    trace.withSpan('outer-span', () => {
      const activeOuter = trace.getActiveSpan();
      expect(activeOuter).not.toBeNull();
      outerSpanId = activeOuter?.id;
      expect(activeOuter?.operation).toBe('outer-span');

      trace.withSpan('inner-span', () => {
        const activeInner = trace.getActiveSpan();
        expect(activeInner?.operation).toBe('inner-span');
        expect(activeInner?.parentId).toBe(outerSpanId ?? null);
      });

      // After inner span closes, the outer span becomes active again
      const activeAfterInner = trace.getActiveSpan();
      expect(activeAfterInner?.id).toBe(outerSpanId);
    });

    expect(trace.getActiveSpan()).toBeNull();
  });

  it('should honour configuration toggles and cache analysis helpers', async () => {
    const disabledTrace = new StructuredTrace(null, {
      traceAnalysisEnabled: true,
      analysis: { enabled: false },
      visualization: { enabled: false },
      performanceMonitoring: { enabled: false },
    });

    await expect(disabledTrace.getAnalyzer()).resolves.toBeNull();
    await expect(disabledTrace.getVisualizer()).resolves.toBeNull();
    await expect(disabledTrace.getPerformanceMonitor()).resolves.toBeNull();

    const enabledTrace = new StructuredTrace(null, createFullyEnabledConfig());

    const analyzer = await enabledTrace.getAnalyzer();
    const analyzerAgain = await enabledTrace.getAnalyzer();
    expect(analyzerAgain).toBe(analyzer);

    const visualizer = await enabledTrace.getVisualizer();
    const visualizerAgain = await enabledTrace.getVisualizer();
    expect(visualizerAgain).toBe(visualizer);

    const performanceMonitor = await enabledTrace.getPerformanceMonitor();
    const performanceMonitorAgain = await enabledTrace.getPerformanceMonitor();
    expect(performanceMonitorAgain).toBe(performanceMonitor);
  });
});
