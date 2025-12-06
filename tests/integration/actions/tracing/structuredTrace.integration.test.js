import { describe, it, expect } from '@jest/globals';
import { StructuredTrace } from '../../../../src/actions/tracing/structuredTrace.js';
import Span from '../../../../src/actions/tracing/span.js';
import {
  TraceContext,
  TRACE_INFO,
  TRACE_SUCCESS,
  TRACE_FAILURE,
  TRACE_STEP,
  TRACE_ERROR,
  TRACE_DATA,
} from '../../../../src/actions/tracing/traceContext.js';

describe('StructuredTrace integration behavior', () => {
  it('delegates logging helpers to the wrapped TraceContext', () => {
    const baseContext = new TraceContext();
    const trace = new StructuredTrace(baseContext);

    trace.addLog(TRACE_INFO, 'base log', 'tester', { foo: 'bar' });
    trace.addLog(TRACE_FAILURE, 'fallback log', 'tester');
    trace.info('info message', 'tester');
    trace.success('success message', 'tester', { ok: true });
    trace.failure('failure message', 'tester');
    trace.step('step message', 'tester', { step: 1 });
    trace.error('error message', 'tester');
    trace.data('data message', 'tester', { payload: 123 });

    expect(trace.logs.map((entry) => entry.type)).toEqual([
      TRACE_INFO,
      TRACE_FAILURE,
      TRACE_INFO,
      TRACE_SUCCESS,
      TRACE_FAILURE,
      TRACE_STEP,
      TRACE_ERROR,
      TRACE_DATA,
    ]);
    expect(
      trace.logs.find((entry) => entry.message === 'base log')?.data
    ).toEqual({ foo: 'bar' });
    expect(
      trace.logs.find((entry) => entry.message === 'fallback log')?.data
    ).toBeUndefined();
    expect(
      trace.logs.find((entry) => entry.message === 'data message')?.data
    ).toEqual({ payload: 123 });
  });

  it('manages nested spans, hierarchical views, and performance summaries', () => {
    const trace = new StructuredTrace();
    const originalNow = performance.now;
    const timeline = [0, 10, 10, 20, 25, 30, 35, 40, 45, 0];
    let callIndex = 0;
    performance.now = () => {
      const value = timeline[callIndex] ?? timeline[timeline.length - 1];
      callIndex += 1;
      return value;
    };

    let result;
    try {
      result = trace.withSpan('root-operation', () => {
        const manualSpan = trace.startSpan('manual-child', {
          origin: 'manual',
        });
        expect(manualSpan).toBeInstanceOf(Span);
        expect(trace.getActiveSpan()).toBe(manualSpan);
        trace.endSpan(manualSpan);

        const childResult = trace.withSpan(
          'child-success',
          () => 'child-complete'
        );
        expect(childResult).toBe('child-complete');

        const duplicate = trace.startSpan('child-success');
        trace.endSpan(duplicate);

        let capturedError = null;
        try {
          trace.withSpan('child-error', () => {
            throw new Error('intentional failure');
          });
        } catch (error) {
          capturedError = error;
        }
        expect(capturedError).toBeInstanceOf(Error);

        return 'root-finished';
      });
    } finally {
      performance.now = originalNow;
    }

    expect(result).toBe('root-finished');
    expect(trace.getActiveSpan()).toBeNull();

    const spans = trace.getSpans();
    expect(spans.length).toBeGreaterThanOrEqual(3);

    const manualSpan = spans.find((span) => span.operation === 'manual-child');
    expect(manualSpan.attributes.origin).toBe('manual');

    const errorSpan = spans.find((span) => span.operation === 'child-error');
    expect(errorSpan.status).toBe('error');
    expect(errorSpan.error).toBeInstanceOf(Error);
    expect(errorSpan.error.message).toBe('intentional failure');

    const hierarchy = trace.getHierarchicalView();
    expect(hierarchy?.operation).toBe('root-operation');
    expect(hierarchy?.children.map((child) => child.operation)).toEqual(
      expect.arrayContaining(['child-success', 'child-error', 'manual-child'])
    );

    const summary = trace.getPerformanceSummary();
    expect(summary.operationCount).toBe(spans.length);
    expect(summary.errorCount).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(summary.slowestOperations)).toBe(true);
    expect(summary.criticalPath.length).toBeGreaterThan(0);
    expect(trace.getCriticalPath()).toEqual(summary.criticalPath);
  });

  it('supports asynchronous spans and records success and error status', async () => {
    const trace = new StructuredTrace();

    const asyncResult = await trace.withSpanAsync('async-success', async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
      return 'async-ok';
    });
    expect(asyncResult).toBe('async-ok');

    const manualStatusResult = await trace.withSpanAsync(
      'async-manual-status',
      async () => {
        const current = trace.getActiveSpan();
        current.setStatus('error');
        await Promise.resolve();
        return 'manual-status';
      }
    );
    expect(manualStatusResult).toBe('manual-status');

    await expect(
      trace.withSpanAsync('async-error', async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
        throw new Error('async boom');
      })
    ).rejects.toThrow('async boom');

    const spans = trace.getSpans();
    const successSpan = spans.find(
      (span) => span.operation === 'async-success'
    );
    expect(successSpan.status).toBe('success');

    const errorSpan = spans.find((span) => span.operation === 'async-error');
    expect(errorSpan.status).toBe('error');
    expect(errorSpan.error).toBeInstanceOf(Error);

    const manualStatusSpan = spans.find(
      (span) => span.operation === 'async-manual-status'
    );
    expect(manualStatusSpan.status).toBe('error');
  });

  it('validates span termination order and parameters', () => {
    const trace = new StructuredTrace();

    expect(() => trace.endSpan(null)).toThrow(
      'endSpan requires a valid Span instance'
    );

    const rootSpan = trace.startSpan('root');
    const childSpan = trace.startSpan('child');

    expect(() => trace.endSpan(rootSpan)).toThrow(
      'it is not the currently active span'
    );

    trace.endSpan(childSpan);
    trace.endSpan(rootSpan);
    expect(trace.getActiveSpan()).toBeNull();
  });

  it('returns empty analysis structures when no spans are recorded', () => {
    const trace = new StructuredTrace();

    expect(trace.getHierarchicalView()).toBeNull();

    const summary = trace.getPerformanceSummary();
    expect(summary).toEqual({
      totalDuration: 0,
      operationCount: 0,
      criticalPath: [],
      slowestOperations: [],
      errorCount: 0,
      operationStats: {},
    });
    expect(trace.getCriticalPath()).toEqual([]);
  });

  it('lazily loads analysis utilities based on trace configuration flags', async () => {
    const trace = new StructuredTrace(null, {
      traceAnalysisEnabled: true,
      analysis: { enabled: true },
      visualization: { enabled: true },
      performanceMonitoring: {
        enabled: true,
        thresholds: { slowOperationMs: 5 },
        sampling: { rate: 0.5, strategy: 'random' },
      },
    });

    const analyzer = await trace.getAnalyzer();
    expect(analyzer).toBeTruthy();
    expect(await trace.getAnalyzer()).toBe(analyzer);

    const visualizer = await trace.getVisualizer();
    expect(visualizer).toBeTruthy();
    expect(await trace.getVisualizer()).toBe(visualizer);

    const monitor = await trace.getPerformanceMonitor();
    expect(monitor).toBeTruthy();
    expect(await trace.getPerformanceMonitor()).toBe(monitor);

    expect(trace.isTraceAnalysisEnabled()).toBe(true);

    const analysisDisabled = new StructuredTrace(null, {
      traceAnalysisEnabled: true,
      analysis: { enabled: false },
    });
    await expect(analysisDisabled.getAnalyzer()).resolves.toBeNull();

    const visualizationDisabled = new StructuredTrace(null, {
      traceAnalysisEnabled: true,
      visualization: { enabled: false },
    });
    await expect(visualizationDisabled.getVisualizer()).resolves.toBeNull();

    const monitoringDisabled = new StructuredTrace(null, {
      traceAnalysisEnabled: true,
      performanceMonitoring: { enabled: false },
    });
    await expect(
      monitoringDisabled.getPerformanceMonitor()
    ).resolves.toBeNull();

    const monitoringNoSampling = new StructuredTrace(null, {
      traceAnalysisEnabled: true,
      performanceMonitoring: { enabled: true },
    });
    const monitorWithoutSampling =
      await monitoringNoSampling.getPerformanceMonitor();
    expect(monitorWithoutSampling).toBeTruthy();
    expect(await monitoringNoSampling.getPerformanceMonitor()).toBe(
      monitorWithoutSampling
    );

    trace.setTraceConfiguration({ traceAnalysisEnabled: false });
    expect(trace.isTraceAnalysisEnabled()).toBe(false);

    await expect(trace.getAnalyzer()).resolves.toBeNull();
    await expect(trace.getVisualizer()).resolves.toBeNull();
    await expect(trace.getPerformanceMonitor()).resolves.toBeNull();
  });
});
