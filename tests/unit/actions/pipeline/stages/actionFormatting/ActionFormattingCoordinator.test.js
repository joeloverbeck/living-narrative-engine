import { ActionFormattingCoordinator } from '../../../../../../src/actions/pipeline/stages/actionFormatting/ActionFormattingCoordinator.js';
import { FormattingAccumulator } from '../../../../../../src/actions/pipeline/stages/actionFormatting/FormattingAccumulator.js';
import { PerActionMetadataStrategy } from '../../../../../../src/actions/pipeline/stages/actionFormatting/strategies/PerActionMetadataStrategy.js';

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
        metadata: {
          selectedStrategy: 'legacy',
          evaluations: [],
          validationErrors: [],
        },
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
        metadata: {
          selectedStrategy: 'perAction',
          evaluations: [],
          validationErrors: [],
        },
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
            actionDef: {
              id: 'action-1',
              name: 'Action One',
              description: 'Test',
              visual: null,
            },
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

    expect(dependencies.validateVisualProperties).toHaveBeenCalledWith(
      null,
      'action-1'
    );
    expect(decider.decide).toHaveBeenCalledWith({
      task: expect.objectContaining({
        actionDef: {
          id: 'action-1',
          name: 'Action One',
          description: 'Test',
          visual: null,
        },
      }),
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

  it('routes per-action multi-target metadata to the strategy and records completions', async () => {
    const formatterInstrumentation = createInstrumentation();
    const normalizeResult = {
      targetIds: { primary: ['target-1'] },
      targetExtractionResult: null,
      primaryTargetContext: { entityId: 'target-1' },
      params: { targetIds: ['target-1'] },
      error: null,
    };

    const commandFormatter = {
      formatMultiTarget: jest.fn(() => ({ ok: true, value: 'mt-command' })),
      format: jest.fn(),
    };

    const fallbackFormatter = {
      prepareFallback: jest.fn(() => ({ prepared: true })),
      formatWithFallback: jest.fn(async () => ({
        ok: true,
        value: 'fallback-command',
      })),
    };

    const targetNormalizationService = {
      normalize: jest.fn(() => normalizeResult),
    };

    const strategy = new PerActionMetadataStrategy({
      commandFormatter,
      entityManager: { id: 'entity-manager' },
      safeEventDispatcher: { dispatch: jest.fn() },
      getEntityDisplayNameFn: jest.fn(() => 'Display Name'),
      logger: { warn: jest.fn(), debug: jest.fn() },
      fallbackFormatter,
      targetNormalizationService,
    });

    const decider = {
      decide: jest.fn(() => ({
        strategy,
        metadata: {
          selectedStrategy: 'perAction',
          evaluations: [],
          validationErrors: [],
        },
        validationFailures: [],
      })),
    };

    const dependencies = buildBaseDependencies({
      decider,
      instrumentation: formatterInstrumentation,
      commandFormatter,
      fallbackFormatter,
      targetNormalizationService,
      context: {
        actor: { id: 'actor-1', name: 'Hero' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'action-1',
              name: 'Action One',
              description: 'Test',
              visual: { backgroundColor: '#000' },
            },
            targetContexts: [{ entityId: 'target-1' }],
            resolvedTargets: { primary: [{ id: 'target-1' }] },
            targetDefinitions: { primary: { max: 1 } },
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

    expect(decider.decide).toHaveBeenCalledTimes(1);
    expect(targetNormalizationService.normalize).toHaveBeenCalledWith({
      resolvedTargets: { primary: [{ id: 'target-1' }] },
      targetContexts: [{ entityId: 'target-1' }],
      isMultiTarget: true,
      actionId: 'action-1',
    });
    expect(commandFormatter.formatMultiTarget).toHaveBeenCalledTimes(1);
    const formatMultiTargetArgs =
      commandFormatter.formatMultiTarget.mock.calls[0];
    expect(formatMultiTargetArgs[0]).toEqual(
      dependencies.context.actionsWithTargets[0].actionDef
    );
    expect(formatMultiTargetArgs[1]).toEqual({ primary: [{ id: 'target-1' }] });
    expect(formatMultiTargetArgs[2]).toEqual(dependencies.entityManager);
    expect(formatMultiTargetArgs[3]).toMatchObject({
      safeEventDispatcher: dependencies.safeEventDispatcher,
    });
    expect(typeof formatMultiTargetArgs[4].displayNameFn).toBe('function');
    expect(formatMultiTargetArgs[4].targetDefinitions).toEqual({
      primary: { max: 1 },
    });

    expect(formatterInstrumentation.actionStarted).toHaveBeenCalledWith({
      actionDef: dependencies.context.actionsWithTargets[0].actionDef,
      timestamp: expect.any(Number),
      payload: {
        metadataSource: 'per-action',
        targetContextCount: 1,
        hasResolvedTargets: true,
        hasTargetDefinitions: true,
        isMultiTarget: true,
      },
    });

    expect(formatterInstrumentation.actionCompleted).toHaveBeenCalledWith({
      actionDef: dependencies.context.actionsWithTargets[0].actionDef,
      timestamp: expect.any(Number),
      payload: {
        formatterMethod: 'formatMultiTarget',
        fallbackUsed: false,
        commandCount: 1,
        successCount: 1,
        failureCount: 0,
      },
    });

    expect(result.success).toBe(true);
    expect(result.actions).toEqual([
      expect.objectContaining({
        id: 'action-1',
        command: 'mt-command',
        params: { targetIds: ['target-1'] },
      }),
    ]);
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
            actionDef: {
              id: 'legacy-action',
              name: 'Legacy Action',
              description: 'Legacy',
              visual: { backgroundColor: '#fff' },
            },
            targetContexts: [
              { entityId: 'target-a' },
              { entityId: 'target-b' },
            ],
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

  it('records validation failures once per action and emits instrumentation', async () => {
    const failureError = { error: 'validation-structured' };
    const secondaryFailure = { error: { message: 'no-code' } };
    const decider = {
      decide: jest.fn(() => ({
        strategy: null,
        metadata: {
          selectedStrategy: 'legacy',
          evaluations: [],
          validationErrors: ['per_action_metadata_missing'],
        },
        validationFailures: [
          {
            code: 'per_action_metadata_missing',
            message: 'Metadata missing',
            error: failureError,
          },
          secondaryFailure,
        ],
      })),
    };

    const commandFormatter = {
      format: jest.fn(() => ({ ok: true, value: 'legacy-command' })),
    };

    const dependencies = buildBaseDependencies({
      decider,
      commandFormatter,
      context: {
        actor: { id: 'actor-5', name: 'Validator' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'action-validation',
              name: 'Validate Me',
              description: 'Validation path',
              visual: null,
            },
            targetContexts: [{ entityId: 'target-100' }],
          },
        ],
        resolvedTargets: null,
        targetDefinitions: null,
        trace: undefined,
      },
    });

    const coordinator = new ActionFormattingCoordinator(dependencies);
    const result = await coordinator.run();

    expect(decider.decide).toHaveBeenCalledTimes(1);
    expect(dependencies.instrumentation.actionFailed).toHaveBeenCalledWith({
      actionDef: dependencies.context.actionsWithTargets[0].actionDef,
      timestamp: expect.any(Number),
      payload: {
        reason: 'validation-failed',
        failureCodes: ['per_action_metadata_missing'],
        metadataSource: 'legacy',
      },
    });

    expect(commandFormatter.format).toHaveBeenCalledTimes(1);
    expect(result.errors).toEqual([failureError, secondaryFailure.error]);
    expect(dependencies.instrumentation.actionCompleted).toHaveBeenCalledWith({
      actionDef: dependencies.context.actionsWithTargets[0].actionDef,
      timestamp: expect.any(Number),
      payload: {
        formatterMethod: 'format',
        successCount: 1,
        failureCount: 0,
        metadataSource: 'legacy',
        targetContextCount: 1,
        status: 'completed',
      },
    });

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
      errorCount: 2,
    });
  });

  it('uses fallback accumulator and validation when not provided and skips tasks without definitions', async () => {
    const providedFormatterOptions = { provided: true };
    const commandFormatter = {
      format: jest.fn(() => ({ ok: true, value: 'legacy-command' })),
    };
    const createTask = jest.fn(
      ({ actionWithTargets, actor, formatterOptions }) => {
        expect(formatterOptions).toBe(providedFormatterOptions);

        if (!actionWithTargets.actionDef) {
          return {
            actor,
            actionDef: undefined,
            metadata: { source: 'legacy' },
            targetContexts: undefined,
          };
        }

        return {
          actor,
          actionDef: actionWithTargets.actionDef,
          metadata: { source: 'legacy', hasPerActionMetadata: false },
          targetContexts: [{ entityId: 'target-1' }],
          formatterOptions: { injected: true },
        };
      }
    );

    const dependencies = buildBaseDependencies({
      accumulatorFactory: null,
      validateVisualProperties: undefined,
      formatterOptions: providedFormatterOptions,
      createTask,
      commandFormatter,
      context: {
        actor: { id: 'actor-42', name: 'Rogue' },
        actionsWithTargets: [
          {},
          {
            actionDef: {
              id: 'legacy-1',
              name: 'Legacy Action',
              description: 'Legacy run',
              visual: { icon: 'dagger' },
            },
            metadata: { source: 'legacy' },
            targetContexts: [{ entityId: 'target-1' }],
          },
        ],
        resolvedTargets: { primary: [] },
        targetDefinitions: { primary: {} },
        trace: undefined,
      },
    });

    const coordinator = new ActionFormattingCoordinator(dependencies);
    const result = await coordinator.run();

    expect(createTask).toHaveBeenCalledTimes(2);
    expect(dependencies.decider.decide).toHaveBeenCalledTimes(1);
    expect(commandFormatter.format).toHaveBeenCalledTimes(1);
    expect(commandFormatter.format).toHaveBeenCalledWith(
      dependencies.context.actionsWithTargets[1].actionDef,
      { entityId: 'target-1' },
      dependencies.entityManager,
      expect.objectContaining({
        logger: dependencies.logger,
        debug: true,
        safeEventDispatcher: dependencies.safeEventDispatcher,
        injected: true,
      }),
      { displayNameFn: dependencies.getEntityDisplayNameFn }
    );
    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.errors).toHaveLength(0);
  });

  it('records missing target context errors during legacy fallback', async () => {
    const commandFormatter = {
      format: jest.fn(() => ({ ok: true, value: 'legacy-command' })),
    };
    const dependencies = buildBaseDependencies({
      commandFormatter,
      context: {
        actor: { id: 'actor-1', name: 'Hero' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'missing-ctx',
              name: 'Missing Targets',
              description: 'No targets available',
              visual: null,
            },
            metadata: { source: 'legacy' },
            targetContexts: [],
          },
        ],
      },
      createTask: jest.fn(({ actionWithTargets, actor }) => ({
        actor,
        actionDef: actionWithTargets.actionDef,
        metadata: actionWithTargets.metadata,
      })),
    });

    const coordinator = new ActionFormattingCoordinator(dependencies);
    const result = await coordinator.run();

    expect(commandFormatter.format).not.toHaveBeenCalled();
    expect(dependencies.errorFactory.create).toHaveBeenCalledTimes(1);
    expect(dependencies.errorFactory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        errorOrResult: expect.objectContaining({
          error: expect.any(Error),
          details: expect.objectContaining({
            code: 'legacy_missing_target_contexts',
          }),
        }),
        actionDef: dependencies.context.actionsWithTargets[0].actionDef,
        actorId: 'actor-1',
      })
    );
    expect(dependencies.instrumentation.actionFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ reason: 'missing-target-contexts' }),
      })
    );
    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  it('records partial legacy formatting outcomes when some targets fail', async () => {
    const commandFormatter = {
      format: jest
        .fn()
        .mockImplementationOnce(() => ({ ok: true, value: 'formatted-a' }))
        .mockImplementationOnce(() => ({ ok: false, error: 'bad-format' }))
        .mockImplementationOnce(() => undefined)
        .mockImplementationOnce(() => {
          throw new Error('boom');
        }),
    };

    const dependencies = buildBaseDependencies({
      commandFormatter,
      context: {
        actor: { id: 'actor-7', name: 'Veteran' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'legacy-2',
              name: 'Legacy Partial',
              description: undefined,
              visual: null,
            },
            metadata: { source: 'legacy' },
            targetContexts: [
              { entityId: 'target-a' },
              { entityId: 'target-b' },
              {},
              {},
            ],
          },
        ],
      },
      createTask: jest.fn(({ actionWithTargets, actor }) => ({
        actor,
        actionDef: actionWithTargets.actionDef,
        metadata: actionWithTargets.metadata,
        targetContexts: actionWithTargets.targetContexts,
      })),
    });

    const coordinator = new ActionFormattingCoordinator(dependencies);
    const result = await coordinator.run();

    expect(commandFormatter.format).toHaveBeenCalledTimes(4);
    expect(dependencies.errorFactory.create).toHaveBeenCalledTimes(3);
    expect(dependencies.instrumentation.actionCompleted).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          successCount: 1,
          failureCount: 3,
          status: 'partial',
        }),
      })
    );
    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.errors).toHaveLength(3);
  });

  it('emits failure instrumentation when legacy formatting fails for all targets', async () => {
    const commandFormatter = {
      format: jest.fn(() => ({ ok: false, error: 'bad-format' })),
    };

    const dependencies = buildBaseDependencies({
      commandFormatter,
      context: {
        actor: { id: 'actor-9', name: 'Warden' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'legacy-3',
              name: 'Legacy Failure',
              description: 'Complete failure',
              visual: null,
            },
            metadata: { source: 'legacy' },
            targetContexts: [{ entityId: 'target-z' }],
          },
        ],
      },
      createTask: jest.fn(({ actionWithTargets, actor }) => ({
        actor,
        actionDef: actionWithTargets.actionDef,
        metadata: actionWithTargets.metadata,
        targetContexts: actionWithTargets.targetContexts,
      })),
    });

    const coordinator = new ActionFormattingCoordinator(dependencies);
    const result = await coordinator.run();

    expect(commandFormatter.format).toHaveBeenCalledTimes(1);
    expect(dependencies.errorFactory.create).toHaveBeenCalledTimes(1);
    expect(dependencies.instrumentation.actionFailed).toHaveBeenCalledWith(
      expect.objectContaining({
        actionDef: dependencies.context.actionsWithTargets[0].actionDef,
        payload: expect.objectContaining({
          failureCount: 1,
          successCount: 0,
          status: 'failed',
        }),
      })
    );
    expect(
      dependencies.instrumentation.actionCompleted
    ).not.toHaveBeenCalledWith(
      expect.objectContaining({
        actionDef: dependencies.context.actionsWithTargets[0].actionDef,
      })
    );
    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
  });

  it('skips validation recording when decider does not provide failures array', async () => {
    const decider = {
      decide: jest.fn(() => ({
        strategy: null,
        metadata: {
          selectedStrategy: 'legacy',
          evaluations: [],
          validationErrors: [],
        },
        validationFailures: null,
      })),
    };

    const dependencies = buildBaseDependencies({
      decider,
      context: {
        actor: { id: 'actor-10', name: 'Observer' },
        actionsWithTargets: [
          {
            actionDef: {
              id: 'legacy-4',
              name: 'Legacy Idle',
              description: null,
              visual: null,
            },
            targetContexts: [{ entityId: 'target-0' }],
          },
        ],
      },
    });

    const coordinator = new ActionFormattingCoordinator(dependencies);
    const result = await coordinator.run();

    expect(decider.decide).toHaveBeenCalledTimes(1);
    expect(dependencies.instrumentation.actionFailed).not.toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ reason: 'validation-failed' }),
      })
    );
    expect(result.errors).toHaveLength(0);
  });

  it('handles undefined context with fallback accumulator without executing tasks', async () => {
    const dependencies = buildBaseDependencies({
      context: null,
      accumulatorFactory: 'not-a-function',
      validateVisualProperties: undefined,
      instrumentation: undefined,
      createTask: jest.fn(),
    });

    const coordinator = new ActionFormattingCoordinator(dependencies);
    const result = await coordinator.run();

    expect(dependencies.instrumentation).toBeUndefined();
    expect(dependencies.createTask).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(0);
    expect(result.errors).toHaveLength(0);
  });
});
