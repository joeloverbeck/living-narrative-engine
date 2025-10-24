import { GlobalMultiTargetStrategy } from '../../../../../../../src/actions/pipeline/stages/actionFormatting/strategies/GlobalMultiTargetStrategy.js';
import { FormattingAccumulator } from '../../../../../../../src/actions/pipeline/stages/actionFormatting/FormattingAccumulator.js';
import { TargetNormalizationService } from '../../../../../../../src/actions/pipeline/stages/actionFormatting/TargetNormalizationService.js';

describe('GlobalMultiTargetStrategy', () => {
  let strategy;
  let commandFormatter;
  let fallbackFormatter;
  let accumulator;
  let instrumentation;
  let createError;
  let normalizationService;

  beforeEach(() => {
    commandFormatter = {
      formatMultiTarget: jest.fn(),
    };

    fallbackFormatter = {
      prepareFallback: jest.fn(({ actionDefinition, targetContext }) => ({
        actionDefinition,
        targetContext,
      })),
      formatWithFallback: jest.fn(),
    };

    normalizationService = new TargetNormalizationService({});
    accumulator = new FormattingAccumulator();
    instrumentation = {
      actionStarted: jest.fn(),
      actionCompleted: jest.fn(),
      actionFailed: jest.fn(),
    };
    createError = jest.fn((context) => ({ context }));

    strategy = new GlobalMultiTargetStrategy({
      commandFormatter,
      entityManager: {},
      safeEventDispatcher: {},
      getEntityDisplayNameFn: jest.fn(),
      logger: { warn: jest.fn() },
      fallbackFormatter,
      targetNormalizationService: normalizationService,
    });
  });

  const buildTask = (overrides = {}) => ({
    actor: { id: 'actor-1' },
    actionDef: {
      id: 'action-1',
      name: 'Action One',
      description: 'First action',
      visual: { icon: 'star' },
    },
    targetContexts: [
      { entityId: 'target-1', type: 'entity', displayName: 'Target One' },
    ],
    resolvedTargets: {
      primary: [{ id: 'target-1', displayName: 'Target One' }],
    },
    targetDefinitions: {
      primary: { placeholder: 'primary' },
    },
    formatterOptions: { debug: false },
    metadata: {
      source: 'batch',
      hasPerActionMetadata: false,
    },
    ...overrides,
  });

  it('only formats tasks that depend on batch metadata', () => {
    expect(strategy.canFormat(buildTask())).toBe(true);
    expect(
      strategy.canFormat(buildTask({ metadata: { source: 'legacy' } }))
    ).toBe(false);
    expect(strategy.canFormat(buildTask({ resolvedTargets: null }))).toBe(
      false
    );
    expect(strategy.canFormat(null)).toBe(false);
  });

  it('formats multi-target actions using the batch formatter', async () => {
    commandFormatter.formatMultiTarget.mockReturnValue({
      ok: true,
      value: [
        'first-command',
        {
          command: 'second-command',
          targets: { primary: [{ id: 'target-2' }] },
        },
      ],
    });

    const task = buildTask();

    await strategy.format({
      task,
      instrumentation,
      accumulator,
      createError,
    });

    expect(accumulator.getFormattedActions()).toEqual([
      {
        id: task.actionDef.id,
        name: task.actionDef.name,
        command: 'first-command',
        description: task.actionDef.description,
        params: {
          isMultiTarget: true,
          targetId: 'target-1',
          targetIds: { primary: ['target-1'] },
        },
        visual: task.actionDef.visual,
      },
      {
        id: task.actionDef.id,
        name: task.actionDef.name,
        command: 'second-command',
        description: task.actionDef.description,
        params: {
          isMultiTarget: true,
          targetId: 'target-2',
          targetIds: { primary: ['target-2'] },
        },
        visual: task.actionDef.visual,
      },
    ]);

    expect(accumulator.getErrors()).toHaveLength(0);
    expect(instrumentation.actionCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ commandCount: 2 }),
      })
    );
  });

  it('returns immediately when no task is provided', async () => {
    await strategy.format({
      task: null,
      instrumentation,
      accumulator,
      createError,
    });

    expect(commandFormatter.formatMultiTarget).not.toHaveBeenCalled();
    expect(instrumentation.actionStarted).not.toHaveBeenCalled();
    expect(accumulator.getFormattedActions()).toHaveLength(0);
  });

  it('falls back to legacy formatting when formatter is unavailable', async () => {
    commandFormatter.formatMultiTarget = undefined;
    fallbackFormatter.formatWithFallback.mockReturnValue({
      ok: true,
      value: 'legacy-command',
    });

    const task = buildTask();

    await strategy.format({ task, instrumentation, accumulator, createError });

    expect(fallbackFormatter.prepareFallback).toHaveBeenCalled();
    expect(accumulator.getFormattedActions()[0].command).toBe('legacy-command');
    expect(instrumentation.actionCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ fallbackUsed: true }),
      })
    );
  });

  it('records normalization failures before formatting', async () => {
    const task = buildTask({ resolvedTargets: { invalid: [] } });

    await strategy.format({ task, instrumentation, accumulator, createError });

    expect(accumulator.getFormattedActions()).toHaveLength(0);
    expect(accumulator.getErrors()).toHaveLength(1);
    expect(createError).toHaveBeenCalledWith(
      expect.objectContaining({ actionDef: task.actionDef })
    );
    expect(instrumentation.actionFailed).toHaveBeenCalled();
  });

  it('records failures when fallback also fails', async () => {
    commandFormatter.formatMultiTarget.mockReturnValue({
      ok: false,
      error: 'format failed',
    });
    fallbackFormatter.formatWithFallback.mockReturnValue({
      ok: false,
      error: 'fallback failed',
    });

    const task = buildTask();

    await strategy.format({ task, instrumentation, accumulator, createError });

    expect(accumulator.getFormattedActions()).toHaveLength(0);
    expect(accumulator.getErrors()).toHaveLength(1);
    expect(instrumentation.actionFailed).toHaveBeenCalled();
  });

  it('handles mixed command payloads with per-command normalization errors', async () => {
    const baseNormalization = {
      error: null,
      params: {
        isMultiTarget: true,
        targetId: 'target-1',
        targetIds: { primary: ['target-1'] },
      },
      primaryTargetContext: { entityId: 'target-1' },
    };

    const erroredNormalization = {
      error: { code: 'TARGETS_INVALID', message: 'bad targets' },
      params: undefined,
      primaryTargetContext: { entityId: 'target-3' },
    };

    const normalizeSpy = jest
      .spyOn(normalizationService, 'normalize')
      .mockReturnValueOnce(baseNormalization)
      .mockReturnValueOnce(erroredNormalization);

    commandFormatter.formatMultiTarget.mockReturnValue({
      ok: true,
      value: [
        'first-command',
        { command: 'second-command', targets: { primary: [{ id: 'target-3' }] } },
      ],
    });

    const task = buildTask({ formatterOptions: undefined });

    await strategy.format({
      task,
      instrumentation,
      accumulator,
      createError,
      trace: { id: 'trace-1' },
    });

    expect(commandFormatter.formatMultiTarget).toHaveBeenCalledWith(
      task.actionDef,
      task.resolvedTargets,
      expect.any(Object),
      expect.objectContaining({ debug: true, logger: expect.any(Object) }),
      expect.objectContaining({ targetDefinitions: task.targetDefinitions })
    );

    expect(accumulator.getFormattedActions()).toHaveLength(1);
    expect(accumulator.getErrors()).toHaveLength(1);

    const summary = accumulator.getActionSummary(task.actionDef.id);
    expect(summary.successes).toBe(1);
    expect(summary.failures).toBe(1);

    expect(instrumentation.actionFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          commandCount: 2,
          successCount: 1,
          failureCount: 1,
          fallbackUsed: false,
        }),
      })
    );

    const errorCall = createError.mock.calls.find(
      ([context]) => context.errorOrResult === erroredNormalization.error
    );
    expect(errorCall).toBeDefined();
    expect(errorCall[0].targetId).toBe('target-3');

    normalizeSpy.mockRestore();
  });
});
