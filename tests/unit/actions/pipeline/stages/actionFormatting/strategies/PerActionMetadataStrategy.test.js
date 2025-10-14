import { PerActionMetadataStrategy } from '../../../../../../../src/actions/pipeline/stages/actionFormatting/strategies/PerActionMetadataStrategy.js';
import { FormattingAccumulator } from '../../../../../../../src/actions/pipeline/stages/actionFormatting/FormattingAccumulator.js';
import { TargetNormalizationService } from '../../../../../../../src/actions/pipeline/stages/actionFormatting/TargetNormalizationService.js';

describe('PerActionMetadataStrategy', () => {
  let strategy;
  let commandFormatter;
  let fallbackFormatter;
  let accumulator;
  let instrumentation;
  let createError;
  let normalizationService;
  let trace;

  beforeEach(() => {
    commandFormatter = {
      format: jest.fn(),
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
    trace = { id: 'trace-1' };

    strategy = new PerActionMetadataStrategy({
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
    isMultiTarget: true,
    formatterOptions: { debug: false },
    metadata: {
      source: 'per-action',
      hasPerActionMetadata: true,
    },
    ...overrides,
  });

  it('identifies tasks with per-action metadata', () => {
    expect(strategy.canFormat(buildTask())).toBe(true);
    expect(
      strategy.canFormat(
        buildTask({ metadata: { hasPerActionMetadata: false } })
      )
    ).toBe(false);
    expect(strategy.canFormat(null)).toBe(false);
  });

  it('formats multi-target actions and records successes', async () => {
    commandFormatter.formatMultiTarget.mockReturnValue({
      ok: true,
      value: 'command-text',
    });

    const task = buildTask();

    await strategy.format({
      task,
      instrumentation,
      accumulator,
      createError,
      trace,
    });

    expect(commandFormatter.formatMultiTarget).toHaveBeenCalledWith(
      task.actionDef,
      task.resolvedTargets,
      {},
      expect.objectContaining({
        debug: false,
        logger: expect.any(Object),
        safeEventDispatcher: {},
      }),
      expect.objectContaining({ targetDefinitions: task.targetDefinitions })
    );

    expect(accumulator.getFormattedActions()).toEqual([
      {
        id: task.actionDef.id,
        name: task.actionDef.name,
        command: 'command-text',
        description: task.actionDef.description,
        params: {
          isMultiTarget: true,
          targetId: 'target-1',
          targetIds: { primary: ['target-1'] },
        },
        visual: task.actionDef.visual,
      },
    ]);

    expect(accumulator.getErrors()).toHaveLength(0);
    expect(instrumentation.actionCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        actionDef: task.actionDef,
        payload: expect.objectContaining({ commandCount: 1 }),
      })
    );
    expect(createError).not.toHaveBeenCalled();
  });

  it('falls back to legacy formatting when multi-target fails', async () => {
    commandFormatter.formatMultiTarget.mockReturnValue({
      ok: false,
      error: 'boom',
    });
    fallbackFormatter.formatWithFallback.mockReturnValue({
      ok: true,
      value: 'legacy-command',
    });

    const task = buildTask();

    await strategy.format({ task, instrumentation, accumulator, createError });

    expect(fallbackFormatter.prepareFallback).toHaveBeenCalled();
    expect(fallbackFormatter.formatWithFallback).toHaveBeenCalled();
    expect(accumulator.getFormattedActions()[0].command).toBe('legacy-command');
    expect(instrumentation.actionCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ fallbackUsed: true }),
      })
    );
  });

  it('records errors when all formatting attempts fail', async () => {
    commandFormatter.formatMultiTarget.mockReturnValue({
      ok: false,
      error: 'multi-target failed',
    });
    fallbackFormatter.formatWithFallback.mockReturnValue({
      ok: false,
      error: 'fallback failed',
    });

    const task = buildTask();

    await strategy.format({ task, instrumentation, accumulator, createError });

    expect(accumulator.getFormattedActions()).toHaveLength(0);
    expect(accumulator.getErrors()).toHaveLength(1);
    expect(createError).toHaveBeenCalledWith(
      expect.objectContaining({
        actionDef: task.actionDef,
        errorOrResult: expect.objectContaining({ error: 'fallback failed' }),
      })
    );
    expect(instrumentation.actionFailed).toHaveBeenCalled();
  });

  it('formats legacy fallbacks when metadata indicates non-multi-target action', async () => {
    const task = buildTask({
      isMultiTarget: false,
      resolvedTargets: null,
      targetDefinitions: null,
    });

    commandFormatter.format.mockReturnValue({
      ok: true,
      value: 'single-target-command',
    });

    await strategy.format({ task, instrumentation, accumulator, createError });

    expect(commandFormatter.format).toHaveBeenCalled();
    expect(accumulator.getFormattedActions()).toEqual([
      {
        id: task.actionDef.id,
        name: task.actionDef.name,
        command: 'single-target-command',
        description: task.actionDef.description,
        params: { targetId: 'target-1' },
        visual: task.actionDef.visual,
      },
    ]);
    expect(instrumentation.actionCompleted).toHaveBeenCalled();
  });
});
