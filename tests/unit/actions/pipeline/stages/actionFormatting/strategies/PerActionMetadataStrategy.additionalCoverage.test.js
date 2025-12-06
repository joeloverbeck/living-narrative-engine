import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { PerActionMetadataStrategy } from '../../../../../../../src/actions/pipeline/stages/actionFormatting/strategies/PerActionMetadataStrategy.js';
import { FormattingAccumulator } from '../../../../../../../src/actions/pipeline/stages/actionFormatting/FormattingAccumulator.js';

const createNormalization = (overrides = {}) => ({
  params: {
    isMultiTarget: true,
    targetId: 'target-1',
    targetIds: { primary: ['target-1'] },
  },
  primaryTargetContext: { entityId: 'target-1', displayName: 'Target One' },
  error: null,
  ...overrides,
});

describe('PerActionMetadataStrategy - additional coverage', () => {
  let strategy;
  let commandFormatter;
  let fallbackFormatter;
  let targetNormalizationService;
  let accumulator;
  let instrumentation;
  let createError;
  let logger;

  const buildTask = (overrides = {}) => ({
    actor: { id: 'actor-42' },
    actionDef: {
      id: 'action-42',
      name: 'Action Forty Two',
      description: 'Action description',
      visual: { icon: 'star' },
    },
    targetContexts: [
      { entityId: 'target-1', type: 'entity', displayName: 'Target One' },
      { entityId: 'target-2', type: 'entity', displayName: 'Target Two' },
    ],
    resolvedTargets: {
      primary: [
        { id: 'target-1', displayName: 'Target One' },
        { id: 'target-2', displayName: 'Target Two' },
      ],
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

    targetNormalizationService = {
      normalize: jest.fn(),
    };

    accumulator = new FormattingAccumulator();
    instrumentation = {
      actionStarted: jest.fn(),
      actionCompleted: jest.fn(),
      actionFailed: jest.fn(),
    };

    createError = jest.fn((payload) => ({ structured: true, payload }));
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    strategy = new PerActionMetadataStrategy({
      commandFormatter,
      entityManager: {},
      safeEventDispatcher: {},
      getEntityDisplayNameFn: jest.fn(),
      logger,
      fallbackFormatter,
      targetNormalizationService,
    });
  });

  it('returns early when task is missing', async () => {
    await strategy.format({
      task: null,
      instrumentation,
      accumulator,
      createError,
    });

    expect(commandFormatter.formatMultiTarget).not.toHaveBeenCalled();
    expect(targetNormalizationService.normalize).not.toHaveBeenCalled();
    expect(accumulator.getFormattedActions()).toHaveLength(0);
    expect(createError).not.toHaveBeenCalled();
  });

  it('records normalization failures before formatting begins', async () => {
    const normalizationError = {
      code: 'NO_TARGETS',
      message: 'Unable to extract primary target',
    };
    targetNormalizationService.normalize.mockReturnValue(
      createNormalization({
        error: normalizationError,
        primaryTargetContext: { entityId: 'missing-target' },
      })
    );

    const task = buildTask();

    await strategy.format({
      task,
      instrumentation,
      accumulator,
      createError,
      trace: { id: 'trace-1' },
    });

    expect(createError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorOrResult: normalizationError,
        targetId: 'missing-target',
      })
    );
    expect(accumulator.getErrors()).toHaveLength(1);
    expect(instrumentation.actionFailed).toHaveBeenCalled();
  });

  it('merges default formatter options when overrides are missing', async () => {
    targetNormalizationService.normalize.mockReturnValue(createNormalization());
    commandFormatter.formatMultiTarget.mockReturnValue({
      ok: true,
      value: 'final-command',
    });

    const task = buildTask({ formatterOptions: undefined });

    await strategy.format({ task, instrumentation, accumulator, createError });

    expect(commandFormatter.formatMultiTarget).toHaveBeenCalledWith(
      task.actionDef,
      task.resolvedTargets,
      {},
      expect.objectContaining({ debug: true, safeEventDispatcher: {} }),
      expect.objectContaining({ targetDefinitions: task.targetDefinitions })
    );
    expect(accumulator.getFormattedActions()).toHaveLength(1);
  });

  it('records partial failures when command-level normalization fails', async () => {
    const normalization = createNormalization();
    const commandNormalizationError = {
      code: 'BAD_TARGET',
      message: 'Failed to normalise command targets',
    };

    targetNormalizationService.normalize
      .mockReturnValueOnce(normalization)
      .mockReturnValueOnce(
        createNormalization({
          error: commandNormalizationError,
          primaryTargetContext: undefined,
        })
      );

    commandFormatter.formatMultiTarget.mockReturnValue({
      ok: true,
      value: [
        {
          command: 'object-command',
          targets: { primary: [{ id: 'target-2' }] },
        },
        'simple-command',
      ],
    });

    const task = buildTask();

    await strategy.format({ task, instrumentation, accumulator, createError });

    expect(createError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorOrResult: commandNormalizationError,
        targetId: null,
      })
    );
    expect(accumulator.getErrors()).toHaveLength(1);
    expect(accumulator.getFormattedActions()).toHaveLength(1);
    expect(accumulator.getActionSummary(task.actionDef.id)).toMatchObject({
      successes: 1,
      failures: 1,
    });
    expect(instrumentation.actionFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          commandCount: 2,
          successCount: 1,
          failureCount: 1,
        }),
      })
    );
  });

  it('captures legacy formatting failures with target metadata', async () => {
    const task = buildTask({
      isMultiTarget: false,
      resolvedTargets: null,
      targetDefinitions: null,
    });
    const successResult = { ok: true, value: 'legacy-success' };
    const failureResult = { ok: false, error: 'legacy-failure' };

    commandFormatter.format
      .mockReturnValueOnce(successResult)
      .mockReturnValueOnce(failureResult);
    targetNormalizationService.normalize.mockReturnValueOnce({
      params: { targetId: 'target-1' },
      primaryTargetContext: { entityId: 'target-1' },
    });

    await strategy.format({
      task,
      instrumentation,
      accumulator,
      createError,
      trace: { id: 'trace-legacy' },
    });

    expect(createError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorOrResult: failureResult,
        targetId: 'target-2',
      })
    );
    expect(accumulator.getFormattedActions()).toHaveLength(1);
    expect(accumulator.getErrors()).toHaveLength(1);
    expect(instrumentation.actionFailed).toHaveBeenCalled();
  });

  it('records legacy successes with default metadata when missing', async () => {
    targetNormalizationService.normalize.mockReturnValue({
      params: {},
      primaryTargetContext: { entityId: 'target-1' },
    });
    commandFormatter.format.mockReturnValue({
      ok: true,
      value: 'legacy-basic',
    });

    const task = buildTask({
      isMultiTarget: false,
      resolvedTargets: null,
      targetDefinitions: null,
      actionDef: {
        id: 'legacy-2',
        name: 'Legacy Two',
        description: undefined,
        visual: undefined,
      },
      targetContexts: [{ entityId: 'target-1' }],
    });

    await strategy.format({ task, instrumentation, accumulator, createError });

    const formatted = accumulator.getFormattedActions();
    expect(formatted).toHaveLength(1);
    expect(formatted[0]).toMatchObject({ description: '', visual: null });
  });

  it('uses fallback when multi-target formatter is unavailable', async () => {
    targetNormalizationService.normalize.mockReturnValue(createNormalization());
    delete commandFormatter.formatMultiTarget;
    fallbackFormatter.formatWithFallback.mockResolvedValue({
      ok: true,
      value: 'fallback-command',
    });

    const task = buildTask();

    await strategy.format({ task, instrumentation, accumulator, createError });

    expect(fallbackFormatter.prepareFallback).toHaveBeenCalled();
    expect(accumulator.getFormattedActions()[0]).toMatchObject({
      command: 'fallback-command',
    });
    expect(instrumentation.actionCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ fallbackUsed: true }),
      })
    );
  });

  it('reports errors when fallback formatting also fails', async () => {
    targetNormalizationService.normalize.mockReturnValue(
      createNormalization({ primaryTargetContext: undefined })
    );
    delete commandFormatter.formatMultiTarget;
    fallbackFormatter.formatWithFallback.mockResolvedValue({
      ok: false,
      error: 'fallback-unavailable',
    });

    const task = buildTask();

    await strategy.format({ task, instrumentation, accumulator, createError });

    expect(createError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorOrResult: expect.objectContaining({
          error: 'fallback-unavailable',
        }),
      })
    );
    expect(accumulator.getErrors()).toHaveLength(1);
    expect(instrumentation.actionFailed).toHaveBeenCalled();
  });

  it('normalizes commands provided as objects without target overrides', async () => {
    targetNormalizationService.normalize.mockReturnValue(createNormalization());
    commandFormatter.formatMultiTarget.mockReturnValue({
      ok: true,
      value: [{ command: 'object-command' }],
    });

    const task = buildTask();

    await strategy.format({ task, instrumentation, accumulator, createError });

    expect(targetNormalizationService.normalize).toHaveBeenCalledTimes(1);
    expect(accumulator.getFormattedActions()[0]).toMatchObject({
      command: 'object-command',
      params: expect.objectContaining({ targetId: 'target-1' }),
    });
  });

  it('handles tasks without target contexts by emitting zero-count metrics', async () => {
    targetNormalizationService.normalize.mockReturnValue(createNormalization());
    commandFormatter.format.mockReturnValue({ ok: true, value: 'legacy' });

    const task = buildTask({
      isMultiTarget: false,
      targetContexts: undefined,
      resolvedTargets: null,
      targetDefinitions: null,
      formatterOptions: undefined,
    });

    await strategy.format({ task, instrumentation, accumulator, createError });

    expect(instrumentation.actionStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ targetContextCount: 0 }),
      })
    );
    expect(accumulator.getFormattedActions()).toHaveLength(0);
    expect(instrumentation.actionCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ successCount: 0, failureCount: 0 }),
      })
    );
  });

  it('emits failure statistics when every command normalization fails', async () => {
    const normalization = createNormalization();
    const commandNormalizationError = {
      code: 'ALL_BAD',
      message: 'No commands succeeded',
    };

    targetNormalizationService.normalize
      .mockReturnValueOnce(normalization)
      .mockReturnValueOnce(
        createNormalization({
          error: commandNormalizationError,
          primaryTargetContext: { entityId: 'target-2' },
        })
      );

    commandFormatter.formatMultiTarget.mockReturnValue({
      ok: true,
      value: [
        {
          command: 'failed-command',
          targets: { primary: [{ id: 'target-2' }] },
        },
      ],
    });

    const task = buildTask({ targetContexts: [{ entityId: 'target-1' }] });

    await strategy.format({ task, instrumentation, accumulator, createError });

    expect(accumulator.getFormattedActions()).toHaveLength(0);
    expect(accumulator.getErrors()).toHaveLength(1);
    expect(accumulator.getActionSummary(task.actionDef.id)).toMatchObject({
      successes: 0,
      failures: 1,
    });
    expect(instrumentation.actionFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          commandCount: 1,
          successCount: 0,
          failureCount: 1,
        }),
      })
    );
  });

  it('defaults targetId to null when normalization lacks primary context', async () => {
    const normalizationError = {
      code: 'MISSING',
      message: 'No primary target',
    };
    targetNormalizationService.normalize.mockReturnValue(
      createNormalization({
        error: normalizationError,
        primaryTargetContext: undefined,
      })
    );

    const task = buildTask();

    await strategy.format({ task, instrumentation, accumulator, createError });

    expect(createError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorOrResult: normalizationError,
        targetId: null,
      })
    );
  });

  it('treats missing fallback results as unknown formatting failures', async () => {
    targetNormalizationService.normalize.mockReturnValue(
      createNormalization({ primaryTargetContext: undefined })
    );
    delete commandFormatter.formatMultiTarget;
    fallbackFormatter.formatWithFallback.mockResolvedValue(null);

    const task = buildTask();

    await strategy.format({ task, instrumentation, accumulator, createError });

    expect(createError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorOrResult: expect.objectContaining({
          error: 'Multi-target formatter returned no result',
        }),
      })
    );
  });

  it('falls back to empty params, description, and visual metadata when unavailable', async () => {
    const normalization = createNormalization({ params: undefined });
    targetNormalizationService.normalize.mockReturnValue(normalization);
    commandFormatter.formatMultiTarget.mockReturnValue({
      ok: true,
      value: 'bare-command',
    });

    const task = buildTask({
      actionDef: {
        id: 'action-99',
        name: 'Action Ninety Nine',
        description: undefined,
        visual: undefined,
      },
    });

    await strategy.format({ task, instrumentation, accumulator, createError });

    const formatted = accumulator.getFormattedActions();
    expect(formatted).toHaveLength(1);
    expect(formatted[0]).toMatchObject({
      command: 'bare-command',
      description: '',
      visual: null,
      params: {},
    });
  });

  it('propagates null target identifiers when legacy formatting lacks context', async () => {
    targetNormalizationService.normalize.mockReturnValue(createNormalization());
    commandFormatter.format.mockReturnValue({
      ok: false,
      error: 'legacy-error',
    });

    const task = buildTask({
      isMultiTarget: false,
      resolvedTargets: null,
      targetDefinitions: null,
      targetContexts: [undefined],
    });

    await strategy.format({ task, instrumentation, accumulator, createError });

    expect(createError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorOrResult: expect.objectContaining({ error: 'legacy-error' }),
        targetId: null,
      })
    );
  });

  it('logs formatter exceptions and combines distinct fallback errors', async () => {
    const normalization = createNormalization();
    const thrownError = new Error('formatter exploded');
    const fallbackError = new Error('fallback unavailable');

    targetNormalizationService.normalize.mockReturnValue(normalization);
    commandFormatter.formatMultiTarget.mockImplementation(() => {
      throw thrownError;
    });
    fallbackFormatter.formatWithFallback.mockResolvedValue({
      ok: false,
      error: fallbackError,
    });

    const task = buildTask();

    await strategy.format({
      task,
      instrumentation,
      accumulator,
      createError,
      trace: { id: 'trace-multi' },
    });

    expect(logger.error).toHaveBeenCalledWith(
      "PerActionMetadataStrategy: formatMultiTarget threw for action 'action-42'",
      thrownError
    );
    expect(fallbackFormatter.prepareFallback).toHaveBeenCalled();
    expect(createError).toHaveBeenCalledWith(
      expect.objectContaining({
        errorOrResult: expect.objectContaining({
          message: 'formatter exploded (fallback: fallback unavailable)',
          cause: thrownError,
        }),
      })
    );
    expect(instrumentation.actionFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          fallbackUsed: true,
          error: fallbackError,
        }),
      })
    );
  });

  it('reuses original formatter exception when fallback error matches', async () => {
    const normalization = createNormalization();
    const thrownError = new Error('formatter failed');

    targetNormalizationService.normalize.mockReturnValue(normalization);
    commandFormatter.formatMultiTarget.mockImplementation(() => {
      throw thrownError;
    });
    fallbackFormatter.formatWithFallback.mockResolvedValue({
      ok: false,
      error: thrownError,
    });

    const task = buildTask();

    await strategy.format({ task, instrumentation, accumulator, createError });

    expect(createError).toHaveBeenCalledWith(
      expect.objectContaining({ errorOrResult: thrownError })
    );
    expect(instrumentation.actionFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          fallbackUsed: true,
          error: thrownError,
        }),
      })
    );
  });
});
