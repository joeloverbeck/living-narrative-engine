import { ActionFormattingCoordinator } from '../../../../../../src/actions/pipeline/stages/actionFormatting/ActionFormattingCoordinator.js';
import { FormattingAccumulator } from '../../../../../../src/actions/pipeline/stages/actionFormatting/FormattingAccumulator.js';

const createInstrumentation = () => ({
  stageStarted: jest.fn(),
  stageCompleted: jest.fn(),
  actionStarted: jest.fn(),
  actionCompleted: jest.fn(),
  actionFailed: jest.fn(),
});

const createErrorFactory = () => ({
  create: jest.fn((payload) => ({ structured: true, ...payload })),
});

describe('ActionFormattingCoordinator legacy fallback coverage', () => {
  it('falls back to safe defaults when accumulator factory or validators are missing', () => {
    const dependencies = {
      context: { actor: { id: 'actor-1', name: 'Hero' }, actionsWithTargets: [] },
      instrumentation: null,
      decider: { decide: jest.fn(() => ({ strategy: null, validationFailures: [] })) },
      accumulatorFactory: null,
      errorFactory: createErrorFactory(),
      fallbackFormatter: { formatWithFallback: jest.fn() },
      targetNormalizationService: { normalize: jest.fn() },
      commandFormatter: { format: jest.fn() },
      entityManager: {},
      safeEventDispatcher: {},
      getEntityDisplayNameFn: jest.fn(),
      logger: {},
      validateVisualProperties: null,
      createTask: jest.fn(() => ({
        actionDef: { id: 'legacy-action', name: 'Legacy Action' },
        actor: { id: 'actor-1' },
        targetContexts: [],
      })),
    };

    expect(() => new ActionFormattingCoordinator(dependencies)).not.toThrow();
  });

  it('skips tasks that do not expose an action definition before consulting the decider', async () => {
    const instrumentation = createInstrumentation();
    const decider = { decide: jest.fn() };
    const validateVisualProperties = jest.fn();
    const context = {
      actor: { id: 'actor-1', name: 'Hero' },
      actionsWithTargets: [{ id: 'raw-task-1' }],
    };

    const createTask = jest.fn(() => ({
      actor: context.actor,
      metadata: { source: 'missing-action' },
    }));

    const coordinator = new ActionFormattingCoordinator({
      context,
      instrumentation,
      decider,
      accumulatorFactory: () => new FormattingAccumulator(),
      errorFactory: createErrorFactory(),
      fallbackFormatter: { formatWithFallback: jest.fn() },
      targetNormalizationService: { normalize: jest.fn() },
      commandFormatter: { format: jest.fn(() => ({ ok: true, value: 'noop' })) },
      entityManager: {},
      safeEventDispatcher: {},
      getEntityDisplayNameFn: jest.fn(),
      logger: { warn: jest.fn(), debug: jest.fn() },
      validateVisualProperties,
      createTask,
    });

    const result = await coordinator.run();

    expect(decider.decide).not.toHaveBeenCalled();
    expect(instrumentation.actionStarted).not.toHaveBeenCalled();
    expect(instrumentation.actionCompleted).not.toHaveBeenCalled();
    expect(instrumentation.actionFailed).not.toHaveBeenCalled();
    expect(validateVisualProperties).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.actions).toEqual([]);
    expect(result.errors).toEqual([]);

    expect(createTask).toHaveBeenCalledWith({
      actor: context.actor,
      actionWithTargets: context.actionsWithTargets[0],
      formatterOptions: expect.any(Object),
      batchResolvedTargets: null,
      batchTargetDefinitions: null,
    });
  });

  it('reuses provided formatter options and records failures when target contexts are missing', async () => {
    const instrumentation = createInstrumentation();
    const errorFactory = createErrorFactory();
    const providedFormatterOptions = { provided: true };

    const context = {
      actor: { id: 'actor-1', name: 'Hero' },
      actionsWithTargets: [
        { actionDef: { id: 'action-1', name: 'Action One' }, metadata: { source: 'legacy' } },
      ],
      resolvedTargets: undefined,
      targetDefinitions: undefined,
    };

    const decider = {
      decide: jest.fn(() => ({ strategy: null, validationFailures: [] })),
    };

    const createTask = jest.fn(() => ({
      actor: context.actor,
      actionDef: { id: 'action-1', name: 'Action One', description: 'Desc' },
      targetContexts: [],
      metadata: { source: 'legacy' },
    }));

    const coordinator = new ActionFormattingCoordinator({
      context,
      instrumentation,
      decider,
      accumulatorFactory: () => new FormattingAccumulator(),
      errorFactory,
      fallbackFormatter: { formatWithFallback: jest.fn() },
      targetNormalizationService: { normalize: jest.fn() },
      commandFormatter: { format: jest.fn(() => ({ ok: true, value: 'noop' })) },
      entityManager: {},
      safeEventDispatcher: {},
      getEntityDisplayNameFn: jest.fn(),
      logger: { warn: jest.fn(), debug: jest.fn() },
      formatterOptions: providedFormatterOptions,
      createTask,
    });

    const result = await coordinator.run();

    expect(createTask).toHaveBeenCalledWith({
      actor: context.actor,
      actionWithTargets: context.actionsWithTargets[0],
      formatterOptions: providedFormatterOptions,
      batchResolvedTargets: null,
      batchTargetDefinitions: null,
    });

    expect(errorFactory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actionDef: expect.objectContaining({ id: 'action-1' }),
        errorOrResult: expect.objectContaining({
          error: expect.objectContaining({
            message: 'No target contexts available for action formatting',
          }),
          details: { code: 'legacy_missing_target_contexts', metadataSource: 'legacy' },
        }),
        actorId: 'actor-1',
        trace: undefined,
      })
    );

    expect(instrumentation.actionFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        actionDef: expect.objectContaining({ id: 'action-1' }),
        payload: expect.objectContaining({ reason: 'missing-target-contexts', metadataSource: 'legacy' }),
      })
    );

    expect(result.success).toBe(true);
    expect(result.actions).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });

  it('records partial completions when legacy formatting returns mixed results', async () => {
    const instrumentation = createInstrumentation();
    const errorFactory = createErrorFactory();

    const context = {
      actor: { id: 'actor-1', name: 'Hero' },
      actionsWithTargets: [
        { actionDef: { id: 'action-1', name: 'Action One', description: 'Desc' }, metadata: { source: 'legacy' } },
      ],
    };

    const commandFormatter = {
      format: jest
        .fn()
        .mockImplementationOnce(() => ({ ok: true, value: 'legacy-command-1' }))
        .mockImplementationOnce(() => ({ ok: false, error: 'legacy-error' })),
    };

    const createTask = jest.fn(() => ({
      actor: context.actor,
      actionDef: context.actionsWithTargets[0].actionDef,
      targetContexts: [{ entityId: 'target-1' }, { entityId: 'target-2' }],
      metadata: { source: 'legacy' },
      formatterOptions: { fromTask: true },
    }));

    const coordinator = new ActionFormattingCoordinator({
      context,
      instrumentation,
      decider: { decide: jest.fn(() => ({ strategy: null, validationFailures: [] })) },
      accumulatorFactory: () => new FormattingAccumulator(),
      errorFactory,
      fallbackFormatter: { formatWithFallback: jest.fn() },
      targetNormalizationService: { normalize: jest.fn() },
      commandFormatter,
      entityManager: {},
      safeEventDispatcher: {},
      getEntityDisplayNameFn: jest.fn(),
      logger: { warn: jest.fn(), debug: jest.fn() },
      createTask,
    });

    const result = await coordinator.run();

    expect(commandFormatter.format).toHaveBeenNthCalledWith(
      1,
      context.actionsWithTargets[0].actionDef,
      { entityId: 'target-1' },
      {},
      expect.objectContaining({
        logger: expect.any(Object),
        debug: true,
        safeEventDispatcher: expect.any(Object),
        fromTask: true,
      }),
      expect.objectContaining({ displayNameFn: expect.any(Function) })
    );

    expect(commandFormatter.format).toHaveBeenNthCalledWith(
      2,
      context.actionsWithTargets[0].actionDef,
      { entityId: 'target-2' },
      {},
      expect.objectContaining({
        logger: expect.any(Object),
        debug: true,
        safeEventDispatcher: expect.any(Object),
        fromTask: true,
      }),
      expect.objectContaining({ displayNameFn: expect.any(Function) })
    );

    expect(instrumentation.actionCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        actionDef: context.actionsWithTargets[0].actionDef,
        payload: expect.objectContaining({
          formatterMethod: 'format',
          successCount: 1,
          failureCount: 1,
          status: 'partial',
          metadataSource: 'legacy',
        }),
      })
    );

    expect(errorFactory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        targetId: 'target-2',
        errorOrResult: expect.objectContaining({ error: 'legacy-error' }),
      })
    );

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
  });

  it('records full failures when legacy formatting throws for each target context', async () => {
    const instrumentation = createInstrumentation();
    const errorFactory = createErrorFactory();
    const thrown = new Error('legacy boom');

    const context = {
      actor: { id: 'actor-1', name: 'Hero' },
      actionsWithTargets: [
        { actionDef: { id: 'action-1', name: 'Action One', description: 'Desc' }, metadata: { source: 'legacy' } },
      ],
    };

    const commandFormatter = {
      format: jest.fn(() => {
        throw thrown;
      }),
    };

    const createTask = jest.fn(() => ({
      actor: context.actor,
      actionDef: context.actionsWithTargets[0].actionDef,
      targetContexts: [{ entityId: 'target-1' }],
      metadata: { source: 'legacy' },
    }));

    const coordinator = new ActionFormattingCoordinator({
      context,
      instrumentation,
      decider: { decide: jest.fn(() => ({ strategy: null, validationFailures: [] })) },
      accumulatorFactory: () => new FormattingAccumulator(),
      errorFactory,
      fallbackFormatter: { formatWithFallback: jest.fn() },
      targetNormalizationService: { normalize: jest.fn() },
      commandFormatter,
      entityManager: {},
      safeEventDispatcher: {},
      getEntityDisplayNameFn: jest.fn(),
      logger: { warn: jest.fn(), debug: jest.fn() },
      createTask,
    });

    const result = await coordinator.run();

    expect(errorFactory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        targetId: 'target-1',
        errorOrResult: thrown,
      })
    );

    expect(instrumentation.actionFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        actionDef: context.actionsWithTargets[0].actionDef,
        payload: expect.objectContaining({
          formatterMethod: 'format',
          successCount: 0,
          failureCount: 1,
          status: 'failed',
          metadataSource: 'legacy',
        }),
      })
    );

    expect(instrumentation.actionCompleted).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.actions).toEqual([]);
    expect(result.errors).toHaveLength(1);
  });
});
