import { ActionFormattingCoordinator } from '../../../../../../src/actions/pipeline/stages/actionFormatting/ActionFormattingCoordinator.js';
import { FormattingAccumulator } from '../../../../../../src/actions/pipeline/stages/actionFormatting/FormattingAccumulator.js';

describe('ActionFormattingCoordinator', () => {
  const createInstrumentation = () => ({
    stageStarted: jest.fn(),
    stageCompleted: jest.fn(),
    actionStarted: jest.fn(),
    actionCompleted: jest.fn(),
    actionFailed: jest.fn(),
  });

  const buildBaseDependencies = (overrides = {}) => {
    const instrumentation = createInstrumentation();
    const commandFormatter = {
      format: jest.fn(() => ({ ok: true, value: 'formatted-command' })),
    };

    const decider = {
      decide: jest.fn(() => ({
        strategy: null,
        metadata: { selectedStrategy: 'legacy', evaluations: [], validationErrors: [] },
        validationFailures: [],
      })),
    };

    const errorFactory = {
      create: jest.fn((payload) => ({ structured: true, ...payload })),
    };

    const context = {
      actor: { id: 'actor-1', name: 'Hero' },
      actionsWithTargets: [],
      resolvedTargets: null,
      targetDefinitions: null,
      trace: undefined,
    };

    return {
      context,
      instrumentation,
      decider,
      accumulatorFactory: () => new FormattingAccumulator(),
      errorFactory,
      fallbackFormatter: { formatWithFallback: jest.fn() },
      targetNormalizationService: { normalize: jest.fn() },
      commandFormatter,
      entityManager: { id: 'entity-manager' },
      safeEventDispatcher: { dispatch: jest.fn() },
      getEntityDisplayNameFn: jest.fn(() => 'Display Name'),
      logger: { warn: jest.fn(), debug: jest.fn() },
      validateVisualProperties: jest.fn(() => true),
      ...overrides,
    };
  };

  it('emits stage instrumentation and delegates to strategies for per-action tasks', async () => {
    const formatterInstrumentation = createInstrumentation();
    const strategy = {
      format: jest.fn(async ({ task, instrumentation, accumulator }) => {
        const { actionDef } = task;
        accumulator.registerAction(actionDef.id, 'per-action');
        instrumentation?.actionStarted?.({
          actionDef,
          timestamp: expect.any(Number),
          payload: {
            metadataSource: task.metadata?.source,
            targetContextCount: task.targetContexts?.length || 0,
            hasResolvedTargets: Boolean(task.resolvedTargets),
            hasTargetDefinitions: Boolean(task.targetDefinitions),
            isMultiTarget: Boolean(task.isMultiTarget),
          },
        });

        accumulator.addFormattedAction({
          id: actionDef.id,
          name: actionDef.name,
          command: 'formatted',
          description: actionDef.description || '',
          params: { targetIds: ['target-1'] },
          visual: actionDef.visual || null,
        });
        accumulator.recordSuccess(actionDef.id);

        instrumentation?.actionCompleted?.({
          actionDef,
          timestamp: expect.any(Number),
          payload: {
            formatterMethod: 'formatMultiTarget',
            fallbackUsed: false,
            commandCount: 1,
            successCount: 1,
            failureCount: 0,
          },
        });
      }),
    };

    const decider = {
      decide: jest.fn(() => ({
        strategy,
        metadata: { selectedStrategy: 'perAction', evaluations: [], validationErrors: [] },
        validationFailures: [],
      })),
    };

    const dependencies = buildBaseDependencies({
      decider,
      instrumentation: formatterInstrumentation,
      context: {
        actor: { id: 'actor-1', name: 'Hero' },
        actionsWithTargets: [
          {
            actionDef: { id: 'action-1', name: 'Action One', description: 'Test', visual: null },
            targetContexts: [{ entityId: 'target-1' }],
            resolvedTargets: { primary: [{ entityId: 'target-1' }] },
            targetDefinitions: { primary: {} },
            isMultiTarget: true,
          },
        ],
        resolvedTargets: null,
        targetDefinitions: null,
        trace: undefined,
      },
    });

    const coordinator = new ActionFormattingCoordinator(dependencies);
    const result = await coordinator.run();

    expect(dependencies.validateVisualProperties).toHaveBeenCalledWith(null, 'action-1');
    expect(decider.decide).toHaveBeenCalledWith({
      task: expect.objectContaining({ actionDef: { id: 'action-1', name: 'Action One', description: 'Test', visual: null } }),
      actorId: 'actor-1',
      trace: undefined,
    });

    expect(formatterInstrumentation.stageStarted).toHaveBeenCalledTimes(1);
    expect(formatterInstrumentation.stageStarted).toHaveBeenCalledWith({
      actor: dependencies.context.actor,
      formattingPath: 'per-action',
      actions: [
        expect.objectContaining({
          actionDef: dependencies.context.actionsWithTargets[0].actionDef,
          metadata: {
            source: 'per-action',
            hasPerActionMetadata: true,
            targetContextCount: 1,
            hasResolvedTargets: true,
            hasTargetDefinitions: true,
          },
        }),
      ],
    });

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.errors).toHaveLength(0);

    expect(formatterInstrumentation.stageCompleted).toHaveBeenCalledWith({
      formattingPath: 'per-action',
      statistics: {
        total: 1,
        successful: 1,
        failed: 0,
        perActionMetadata: 1,
        multiTarget: 0,
        legacy: 0,
      },
      errorCount: 0,
    });
  });

  it('falls back to legacy formatting when no strategy matches and records instrumentation', async () => {
    const commandFormatter = {
      format: jest.fn((actionDef, targetContext) => ({
        ok: true,
        value: `${actionDef.id}:${targetContext.entityId}`,
      })),
    };

    const dependencies = buildBaseDependencies({
      commandFormatter,
      context: {
        actor: { id: 'actor-42', name: 'Legacy Hero' },
        actionsWithTargets: [
          {
            actionDef: { id: 'legacy-action', name: 'Legacy Action', description: 'Legacy', visual: { backgroundColor: '#fff' } },
            targetContexts: [{ entityId: 'target-a' }, { entityId: 'target-b' }],
          },
        ],
        resolvedTargets: null,
        targetDefinitions: null,
        trace: undefined,
      },
    });

    const coordinator = new ActionFormattingCoordinator(dependencies);
    const result = await coordinator.run();

    expect(commandFormatter.format).toHaveBeenCalledTimes(2);
    expect(dependencies.instrumentation.actionStarted).toHaveBeenCalledWith({
      actionDef: dependencies.context.actionsWithTargets[0].actionDef,
      timestamp: expect.any(Number),
      payload: {
        metadataSource: 'legacy',
        targetContextCount: 2,
      },
    });

    expect(dependencies.instrumentation.actionCompleted).toHaveBeenCalledWith({
      actionDef: dependencies.context.actionsWithTargets[0].actionDef,
      timestamp: expect.any(Number),
      payload: {
        formatterMethod: 'format',
        successCount: 2,
        failureCount: 0,
        metadataSource: 'legacy',
        targetContextCount: 2,
        status: 'completed',
      },
    });

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(2);
    expect(result.errors).toHaveLength(0);

    expect(dependencies.instrumentation.stageCompleted).toHaveBeenCalledWith({
      formattingPath: 'per-action',
      statistics: {
        total: 1,
        successful: 1,
        failed: 0,
        perActionMetadata: 1,
        multiTarget: 0,
        legacy: 1,
      },
      errorCount: 0,
    });
  });
});
