import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ActionPerformanceAnalyzer } from '../../../../src/actions/tracing/timing/actionPerformanceAnalyzer.js';
import { ActionExecutionTraceFactory } from '../../../../src/actions/tracing/actionExecutionTraceFactory.js';
import { highPrecisionTimer } from '../../../../src/actions/tracing/timing/highPrecisionTimer.js';

const waitFor = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const createFactory = () =>
  new ActionExecutionTraceFactory({
    // Use the real console logger to keep the integration focused on concrete modules.
    logger: console,
  });

const buildTurnAction = (actionId, seed) => ({
  actionDefinitionId: actionId,
  commandString: `/integration ${actionId}`,
  parameters: {
    seed,
    origin: 'integration-suite',
  },
});

const createSuccessfulTrace = async (
  factory,
  {
    actionId,
    actorId = 'integration-actor',
    initialDelay = 0,
    payloadDelay = 0,
    metadata = {},
  }
) => {
  const trace = factory.createTrace({
    actionId,
    actorId,
    turnAction: buildTurnAction(actionId, metadata.seed || actionId),
    enableTiming: true,
  });

  trace.captureDispatchStart();
  if (initialDelay > 0) {
    await waitFor(initialDelay);
  }

  trace.captureEventPayload({
    kind: 'payload',
    actionId,
    receivedAt: Date.now(),
  });

  if (payloadDelay > 0) {
    await waitFor(payloadDelay);
  }

  trace.captureDispatchResult({
    success: true,
    metadata: { ...metadata, completedAt: Date.now() },
  });

  return trace;
};

const createErroredTrace = async (
  factory,
  {
    actionId,
    actorId = 'integration-actor',
    initialDelay = 0,
    payloadDelay = 0,
    errorMessage = 'integration failure',
  }
) => {
  const trace = factory.createTrace({
    actionId,
    actorId,
    turnAction: buildTurnAction(actionId, errorMessage),
    enableTiming: true,
  });

  trace.captureDispatchStart();
  if (initialDelay > 0) {
    await waitFor(initialDelay);
  }

  trace.captureEventPayload({
    kind: 'payload',
    actionId,
    receivedAt: Date.now(),
  });

  if (payloadDelay > 0) {
    await waitFor(payloadDelay);
  }

  trace.captureError(new Error(errorMessage), {
    phase: 'payload_processing',
  });

  return trace;
};

const createZeroDurationTrace = (
  factory,
  { actionId, actorId = 'integration-actor' }
) => {
  const trace = factory.createTrace({
    actionId,
    actorId,
    turnAction: buildTurnAction(actionId, 'zero-duration'),
    enableTiming: true,
  });

  trace.captureDispatchStart();
  trace.captureEventPayload({
    kind: 'payload',
    actionId,
    receivedAt: Date.now(),
  });
  trace.captureDispatchResult({ success: true });

  return trace;
};

describe('ActionPerformanceAnalyzer – real trace integration', () => {
  let analyzer;
  let factory;

  beforeEach(() => {
    analyzer = new ActionPerformanceAnalyzer();
    factory = createFactory();
  });

  it('ignores incomplete traces and traces without timing data from the real factory', async () => {
    const incompleteTrace = factory.createTrace({
      actionId: 'integration:test:incomplete',
      actorId: 'actor-incomplete',
      turnAction: buildTurnAction('integration:test:incomplete', 'incomplete'),
      enableTiming: true,
    });
    incompleteTrace.captureDispatchStart();
    incompleteTrace.captureEventPayload({ payload: 'ignored' });
    // Intentionally do not call captureDispatchResult to leave the trace incomplete.

    const noTimingTrace = factory.createTrace({
      actionId: 'integration:test:no-timing',
      actorId: 'actor-no-timing',
      turnAction: buildTurnAction('integration:test:no-timing', 'no-timing'),
      enableTiming: false,
    });
    noTimingTrace.captureDispatchStart();
    noTimingTrace.captureEventPayload({ payload: 'no timing data' });
    noTimingTrace.captureDispatchResult({ success: true });

    analyzer.addTrace(incompleteTrace);
    analyzer.addTrace(noTimingTrace);

    const stats = analyzer.getStats();
    expect(stats.totalTraces).toBe(0);
    expect(stats.totalDuration).toBe(0);
    expect(stats.percentiles.p99).toBe(0);
    expect(analyzer.getSlowTraces(0)).toHaveLength(0);
    expect(analyzer.identifyBottlenecks()).toHaveLength(0);
  });

  it('aggregates performance metrics, highlights bottlenecks, and resets cleanly', async () => {
    const [quickTrace, mediumTrace, slowTrace, erroredTrace] =
      await Promise.all([
        createSuccessfulTrace(factory, {
          actionId: 'integration:test:quick',
          initialDelay: 5,
          payloadDelay: 10,
          metadata: { seed: 'quick' },
        }),
        createSuccessfulTrace(factory, {
          actionId: 'integration:test:medium',
          initialDelay: 12,
          payloadDelay: 28,
          metadata: { seed: 'medium' },
        }),
        createSuccessfulTrace(factory, {
          actionId: 'integration:test:slow',
          initialDelay: 40,
          payloadDelay: 120,
          metadata: { seed: 'slow' },
        }),
        createErroredTrace(factory, {
          actionId: 'integration:test:error',
          initialDelay: 10,
          payloadDelay: 35,
          errorMessage: 'intentional failure',
        }),
      ]);

    const zeroDurationTrace = (() => {
      const nowSpy = jest
        .spyOn(highPrecisionTimer, 'now')
        .mockReturnValue(2500);
      try {
        return createZeroDurationTrace(factory, {
          actionId: 'integration:test:zero-duration',
        });
      } finally {
        nowSpy.mockRestore();
      }
    })();

    analyzer.addTrace(quickTrace);
    analyzer.addTrace(mediumTrace);
    analyzer.addTrace(slowTrace);
    analyzer.addTrace(erroredTrace);
    analyzer.addTrace(zeroDurationTrace);

    const stats = analyzer.getStats();
    expect(stats.totalTraces).toBe(5);
    expect(stats.totalDuration).toBeGreaterThan(0);
    expect(stats.averageDuration).toBeGreaterThan(0);
    expect(stats.minDuration).toBeGreaterThanOrEqual(0);
    expect(stats.maxDuration).toBeGreaterThanOrEqual(stats.minDuration);

    const breakdown = stats.phaseBreakdown;
    expect(Object.keys(breakdown).length).toBeGreaterThanOrEqual(2);
    expect(breakdown.initialization).toBeDefined();
    expect(breakdown.payload_creation).toBeDefined();
    expect(Number(breakdown.payload_creation.percentage)).toBeGreaterThan(
      Number(breakdown.initialization.percentage)
    );

    const percentiles = stats.percentiles;
    expect(percentiles.p50).toBeGreaterThan(0);
    expect(percentiles.p90).toBeGreaterThanOrEqual(percentiles.p50);
    expect(percentiles.p95).toBeGreaterThanOrEqual(percentiles.p90);
    expect(percentiles.p99).toBeGreaterThanOrEqual(percentiles.p95);

    const slowTraces = analyzer.getSlowTraces(20);
    expect(slowTraces.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < slowTraces.length; i += 1) {
      expect(slowTraces[i - 1].duration).toBeGreaterThanOrEqual(
        slowTraces[i].duration
      );
    }

    const defaultSlowTraces = analyzer.getSlowTraces();
    expect(defaultSlowTraces.length).toBeGreaterThan(0);

    const bottlenecks = analyzer.identifyBottlenecks();
    expect(bottlenecks.length).toBeGreaterThan(0);
    expect(bottlenecks[0].phase).toBe('payload_creation');

    const report = analyzer.generateReport();
    expect(report).toContain('ACTION EXECUTION PERFORMANCE REPORT');
    expect(report).toContain('Total Traces: 5');
    expect(report).toContain('Top Bottlenecks:');

    analyzer.clear();
    const resetStats = analyzer.getStats();
    expect(resetStats.totalTraces).toBe(0);
    expect(resetStats.totalDuration).toBe(0);
    expect(resetStats.percentiles.p50).toBe(0);
    expect(resetStats.phaseBreakdown).toEqual({});
  });
});
