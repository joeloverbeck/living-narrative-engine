import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ClothingTracer } from '../../../../src/clothing/logging/clothingTracer.js';

describe('ClothingTracer', () => {
  let dateSpy;
  let randomSpy;
  let performanceSpy;
  let dateCallCount;
  let performanceCallCount;

  beforeEach(() => {
    dateCallCount = 0;
    performanceCallCount = 0;

    dateSpy = jest.spyOn(Date, 'now').mockImplementation(() => {
      dateCallCount += 1;
      return 1_000 + dateCallCount * 100;
    });

    randomSpy = jest
      .spyOn(Math, 'random')
      .mockImplementation(() => 0.123456789);

    performanceSpy = jest
      .spyOn(performance, 'now')
      .mockImplementation(() => {
        performanceCallCount += 1;
        return performanceCallCount;
      });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('generates trace identifiers and enforces the retention limit', () => {
    const tracer = new ClothingTracer(2);

    const first = tracer.startTrace('equip', { slot: 'head' });
    const second = tracer.startTrace('equip', { slot: 'chest' });
    const third = tracer.startTrace('equip', { slot: 'legs' });

    expect(first).not.toEqual(second);
    expect(second).not.toEqual(third);

    // Only the two most recent traces should remain because maxTraces is 2
    expect(tracer.getTrace(first)).toBeNull();
    expect(tracer.getTrace(second)).not.toBeNull();
    expect(tracer.getTrace(third)).not.toBeNull();
    expect(tracer.getAllTraces()).toHaveLength(2);
  });

  it('records steps, metadata, errors and timing information for the active trace', () => {
    const tracer = new ClothingTracer();
    const traceId = tracer.startTrace('equip', { slot: 'head' });

    tracer.addStep('initialized', { ready: true });
    tracer.addMetadata('priority', 'high');

    const failure = new Error('failed to resolve slot');
    failure.stack = 'custom-stack-line';
    tracer.recordError(failure, { severity: 'critical' });

    const inProgress = tracer.getTrace(traceId);
    expect(inProgress.steps).toHaveLength(1);
    expect(inProgress.steps[0]).toMatchObject({
      step: 'initialized',
      data: { ready: true },
      timestamp: 1,
    });
    expect(inProgress.metadata).toEqual({ priority: 'high' });
    expect(inProgress.errors).toHaveLength(1);
    expect(inProgress.errors[0]).toMatchObject({
      error: {
        name: 'Error',
        message: 'failed to resolve slot',
      },
      context: { severity: 'critical' },
    });

    const endedId = tracer.endTrace({ status: 'completed' });
    expect(endedId).toBe(traceId);

    const completed = tracer.getTrace(traceId);
    expect(completed.duration).toBe(3);
    expect(completed.result).toEqual({ status: 'completed' });
    expect(completed.successful).toBe(false);

    // Subsequent operations with no current trace should be ignored
    tracer.addStep('ignored');
    tracer.addMetadata('ignored', true);
    tracer.recordError(new Error('ignored'));
    expect(tracer.endTrace()).toBeNull();

    const finalState = tracer.getTrace(traceId);
    expect(finalState.steps).toHaveLength(1);
    expect(finalState.metadata).toEqual({ priority: 'high' });
    expect(finalState.errors).toHaveLength(1);
  });

  it('summarises traces, filters subsets and exports data', () => {
    const tracer = new ClothingTracer();

    const quickId = tracer.startTrace('equip', { slot: 'head' });
    tracer.endTrace('ok');

    const failingId = tracer.startTrace('equip', { slot: 'chest' });
    tracer.recordError(new Error('missing item'), { slot: 'chest' });
    tracer.endTrace('error');

    const slowId = tracer.startTrace('craft', { slot: 'hand' });
    tracer.addStep('preparing');
    tracer.addStep('assembling');
    tracer.endTrace('complete');

    const pendingId = tracer.startTrace('monitor', { slot: 'belt' });
    tracer.addMetadata('phase', 'watch');
    // Deliberately leave this trace open to exercise statistics with incomplete entries

    const allTraces = tracer.getAllTraces();
    expect(allTraces).toHaveLength(4);
    expect(allTraces.map((trace) => trace.traceId)).toEqual([
      quickId,
      failingId,
      slowId,
      pendingId,
    ]);

    const equipTraces = tracer.getTracesByOperation('equip');
    expect(equipTraces.map((trace) => trace.traceId)).toEqual([
      quickId,
      failingId,
    ]);

    const failed = tracer.getFailedTraces();
    expect(failed).toHaveLength(1);
    expect(failed[0].traceId).toBe(failingId);

    const slow = tracer.getSlowTraces(2);
    expect(slow).toHaveLength(1);
    expect(slow[0].traceId).toBe(slowId);

    const stats = tracer.getStatistics();
    expect(stats).toEqual({
      totalTraces: 4,
      successfulTraces: 2,
      failedTraces: 2,
      averageDuration: '2.00',
      slowestTrace: {
        traceId: slowId,
        operationName: 'craft',
        duration: '3.00',
      },
      fastestTrace: {
        traceId: quickId,
        operationName: 'equip',
        duration: '1.00',
      },
    });

    const exported = tracer.exportTraces();
    const parsed = JSON.parse(exported);
    expect(parsed).toHaveLength(4);
    expect(parsed[1].traceId).toBe(failingId);

    tracer.clearAllTraces();
    expect(tracer.getAllTraces()).toHaveLength(0);
    expect(tracer.getTrace(quickId)).toBeNull();
    expect(tracer.getTrace(pendingId)).toBeNull();
  });

  it('ignores operations when no trace is active and reports empty statistics', () => {
    const tracer = new ClothingTracer();

    tracer.addStep('no-trace-step');
    tracer.addMetadata('unused', 'value');
    tracer.recordError(new Error('no trace'));

    expect(tracer.getAllTraces()).toHaveLength(0);
    expect(tracer.endTrace()).toBeNull();
    expect(tracer.getTrace('missing')).toBeNull();

    const stats = tracer.getStatistics();
    expect(stats).toEqual({
      totalTraces: 0,
      successfulTraces: 0,
      failedTraces: 0,
      averageDuration: 0,
      slowestTrace: null,
      fastestTrace: null,
    });

    expect(JSON.parse(tracer.exportTraces())).toEqual([]);
  });

  it('handles traces removed from storage and pending statistics scenarios', () => {
    const orphanTracer = new ClothingTracer(0);
    const orphanId = orphanTracer.startTrace('orphaned-operation');

    // The trace is immediately purged because maxTraces is zero
    expect(orphanTracer.getTrace(orphanId)).toBeNull();

    // Operations against a missing trace hit the defensive branches
    orphanTracer.addStep('should-not-throw');
    orphanTracer.addMetadata('ignored', 'value');
    orphanTracer.recordError(new Error('missing trace'));
    expect(orphanTracer.endTrace('cleanup')).toBe(orphanId);
    expect(orphanTracer.getAllTraces()).toHaveLength(0);

    const pendingTracer = new ClothingTracer();
    pendingTracer.startTrace('pending-only');
    const pendingStats = pendingTracer.getStatistics();
    expect(pendingStats).toEqual({
      totalTraces: 1,
      successfulTraces: 0,
      failedTraces: 1,
      averageDuration: '0.00',
      slowestTrace: null,
      fastestTrace: null,
    });

    const reduceTracer = new ClothingTracer();
    const firstId = reduceTracer.startTrace('first');
    reduceTracer.endTrace('done');

    const secondId = reduceTracer.startTrace('second');
    reduceTracer.addStep('extra-work');
    reduceTracer.endTrace('done');

    reduceTracer.startTrace('third');
    reduceTracer.endTrace('done');

    const reduceStats = reduceTracer.getStatistics();
    expect(reduceStats).toMatchObject({
      averageDuration: '1.33',
      slowestTrace: {
        traceId: secondId,
        operationName: 'second',
        duration: '2.00',
      },
      fastestTrace: {
        traceId: firstId,
        operationName: 'first',
        duration: '1.00',
      },
    });
  });
});
