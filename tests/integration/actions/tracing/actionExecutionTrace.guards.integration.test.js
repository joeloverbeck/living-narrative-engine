import { ActionExecutionTrace } from '../../../../src/actions/tracing/actionExecutionTrace.js';
import { InvalidArgumentError } from '../../../../src/errors/invalidArgumentError.js';

/**
 * Integration coverage focused on guard rails and validation paths using production collaborators.
 */
describe('ActionExecutionTrace guard rail integration', () => {
  const baseOptions = {
    actionId: 'action.guard',
    actorId: 'actor.guard',
    turnAction: {
      actionDefinitionId: 'action.guard',
      commandString: '/guard',
      parameters: { integration: true },
    },
  };

  const createTrace = (overrides = {}) =>
    new ActionExecutionTrace({
      ...baseOptions,
      ...overrides,
    });

  it('enforces constructor validation for required fields and option types', () => {
    expect(
      () =>
        new ActionExecutionTrace({
          ...baseOptions,
          actionId: '',
        })
    ).toThrow('ActionExecutionTrace requires valid actionId string');

    expect(
      () =>
        new ActionExecutionTrace({
          ...baseOptions,
          actorId: '',
        })
    ).toThrow('ActionExecutionTrace requires valid actorId string');

    expect(
      () =>
        new ActionExecutionTrace({
          ...baseOptions,
          turnAction: null,
        })
    ).toThrow('ActionExecutionTrace requires valid turnAction object');

    expect(
      () =>
        new ActionExecutionTrace({
          ...baseOptions,
          enableTiming: 'yes',
        })
    ).toThrow(InvalidArgumentError);

    expect(
      () =>
        new ActionExecutionTrace({
          ...baseOptions,
          enableErrorAnalysis: 'nope',
        })
    ).toThrow(InvalidArgumentError);
  });

  it('guards dispatch lifecycle ordering for payloads and results', () => {
    const trace = createTrace();
    trace.captureDispatchStart();
    expect(() => trace.captureDispatchStart()).toThrow(
      'Dispatch already started for this trace'
    );

    const payloadBeforeStart = createTrace();
    expect(() => payloadBeforeStart.captureEventPayload({})).toThrow(
      'Must call captureDispatchStart() before capturing payload'
    );

    const payloadAfterEnd = createTrace();
    payloadAfterEnd.captureDispatchStart();
    payloadAfterEnd.captureDispatchResult({ success: true });
    expect(() =>
      payloadAfterEnd.captureEventPayload({ stage: 'late' })
    ).toThrow('Cannot capture payload after dispatch has ended');

    const resultOrdering = createTrace();
    expect(() =>
      resultOrdering.captureDispatchResult({ success: true })
    ).toThrow('Must call captureDispatchStart() before capturing result');

    resultOrdering.captureDispatchStart();
    resultOrdering.captureDispatchResult({ success: true });
    expect(() =>
      resultOrdering.captureDispatchResult({ success: false })
    ).toThrow('Dispatch result already captured');
  });

  it('requires dispatch start before capturing errors and seeds updateError flows', () => {
    const trace = createTrace();
    expect(() => trace.captureError(new Error('fail fast'))).toThrow(
      'Must call captureDispatchStart() before capturing error'
    );

    trace.captureDispatchStart();
    trace.updateError(new Error('initial failure'), { phase: 'initial' });
    expect(trace.hasError).toBe(true);
    expect(trace.getErrorHistory()).toHaveLength(0);

    const summary = trace.getErrorSummary();
    expect(summary).toMatchObject({
      message: 'initial failure',
      category: 'unknown',
      severity: 'medium',
    });

    const noTimingTrace = createTrace({ enableTiming: false });
    noTimingTrace.captureDispatchStart();
    noTimingTrace.captureError(new Error('without timing'), {
      phase: 'processing',
    });

    const errorDetails = noTimingTrace.getError();
    expect(errorDetails).toBeDefined();
    expect(noTimingTrace.toJSON().timing).toBeUndefined();
  });

  it('ignores orphaned operation results and exposes null summaries without errors', () => {
    const trace = createTrace();
    const phasesBefore = trace.getExecutionPhases().length;
    trace.captureOperationResult({ success: true });

    expect(trace.getOperations()).toHaveLength(0);
    expect(trace.getExecutionPhases().length).toBe(phasesBefore);
    expect(trace.getErrorSummary()).toBeNull();
  });

  it('respects the testing-only processing lock guard when misused', () => {
    expect(() =>
      ActionExecutionTrace.__setProcessingLockForTesting(
        { notATrace: true },
        true
      )
    ).not.toThrow();
  });
});
