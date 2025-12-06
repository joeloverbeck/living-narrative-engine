import { TraceAwareInstrumentation } from '../../../../../../src/actions/pipeline/stages/actionFormatting/TraceAwareInstrumentation.js';

describe('TraceAwareInstrumentation', () => {
  let trace;
  let instrumentation;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));

    trace = {
      captureActionData: jest.fn(),
    };

    instrumentation = new TraceAwareInstrumentation(trace);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('emits started payloads for every action when the stage begins', () => {
    const actor = { id: 'actor-123' };
    const actions = [
      {
        actionDef: { id: 'action-a' },
        metadata: {
          formattingPath: 'legacy',
          targetContextCount: 2,
        },
      },
      {
        actionDef: { id: 'action-b' },
        metadata: {
          formattingPath: 'legacy',
          isMultiTargetInLegacy: true,
        },
      },
    ];

    instrumentation.stageStarted({
      formattingPath: 'legacy',
      actor,
      actions,
    });

    expect(trace.captureActionData.mock.calls).toEqual([
      [
        'formatting',
        'action-a',
        {
          actorId: 'actor-123',
          formattingPath: 'legacy',
          status: 'started',
          targetContextCount: 2,
          timestamp: expect.any(Number),
        },
      ],
      [
        'formatting',
        'action-b',
        {
          actorId: 'actor-123',
          formattingPath: 'legacy',
          isMultiTargetInLegacy: true,
          status: 'started',
          timestamp: expect.any(Number),
        },
      ],
    ]);
  });

  it('records lifecycle events using the provided timestamps', () => {
    const actor = { id: 'actor-456' };
    const [firstAction, secondAction] = [
      { actionDef: { id: 'primary-action' } },
      { actionDef: { id: 'secondary-action' } },
    ];

    instrumentation.stageStarted({
      formattingPath: 'per-action',
      actor,
      actions: [
        {
          actionDef: firstAction.actionDef,
          metadata: { hasPerActionMetadata: true },
        },
        {
          actionDef: secondAction.actionDef,
          metadata: { hasPerActionMetadata: false },
        },
      ],
    });

    instrumentation.actionStarted({
      actionDef: firstAction.actionDef,
      timestamp: 10,
      payload: { targetContextCount: 3 },
    });

    instrumentation.actionCompleted({
      actionDef: firstAction.actionDef,
      timestamp: 20,
      payload: {
        formatterMethod: 'format',
        performance: { duration: 10 },
      },
    });

    instrumentation.actionFailed({
      actionDef: secondAction.actionDef,
      timestamp: 30,
      payload: {
        error: 'failed to format',
      },
    });

    jest.setSystemTime(new Date('2024-01-01T00:00:05.000Z'));

    instrumentation.stageCompleted({
      formattingPath: 'per-action',
      statistics: {
        total: 2,
        successful: 1,
        failed: 1,
        perActionMetadata: 2,
        multiTarget: 1,
        legacy: 1,
      },
      errorCount: 1,
    });

    expect(trace.captureActionData.mock.calls).toEqual([
      [
        'formatting',
        'primary-action',
        {
          actorId: 'actor-456',
          formattingPath: 'per-action',
          hasPerActionMetadata: true,
          status: 'started',
          timestamp: expect.any(Number),
        },
      ],
      [
        'formatting',
        'secondary-action',
        {
          actorId: 'actor-456',
          formattingPath: 'per-action',
          hasPerActionMetadata: false,
          status: 'started',
          timestamp: expect.any(Number),
        },
      ],
      [
        'formatting',
        'primary-action',
        {
          status: 'formatting',
          targetContextCount: 3,
          timestamp: 10,
        },
      ],
      [
        'formatting',
        'primary-action',
        {
          formatterMethod: 'format',
          performance: { duration: 10 },
          status: 'completed',
          timestamp: 20,
        },
      ],
      [
        'formatting',
        'secondary-action',
        {
          error: 'failed to format',
          status: 'failed',
          timestamp: 30,
        },
      ],
      [
        'formatting',
        '__stage_summary',
        {
          errors: 1,
          formattingPath: 'per-action',
          performance: {
            totalDuration: 5000,
            averagePerAction: 2500,
          },
          statistics: {
            total: 2,
            successful: 1,
            failed: 1,
            perActionMetadata: 2,
            multiTarget: 1,
            legacy: 1,
          },
          status: 'completed',
          timestamp: expect.any(Number),
        },
      ],
    ]);
  });
});
