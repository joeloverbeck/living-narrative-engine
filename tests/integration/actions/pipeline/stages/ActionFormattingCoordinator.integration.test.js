/**
 * @file Integration tests for ActionFormattingCoordinator.
 * @see src/actions/pipeline/stages/actionFormatting/ActionFormattingCoordinator.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ActionFormattingCoordinator } from '../../../../../src/actions/pipeline/stages/actionFormatting/ActionFormattingCoordinator.js';
import { ActionFormattingDecider } from '../../../../../src/actions/pipeline/stages/actionFormatting/ActionFormattingDecider.js';
import { FormattingAccumulator } from '../../../../../src/actions/pipeline/stages/actionFormatting/FormattingAccumulator.js';
import { ActionFormattingErrorFactory } from '../../../../../src/actions/pipeline/stages/actionFormatting/ActionFormattingErrorFactory.js';
import { PerActionMetadataStrategy } from '../../../../../src/actions/pipeline/stages/actionFormatting/strategies/PerActionMetadataStrategy.js';
import { GlobalMultiTargetStrategy } from '../../../../../src/actions/pipeline/stages/actionFormatting/strategies/GlobalMultiTargetStrategy.js';
import { TargetNormalizationService } from '../../../../../src/actions/pipeline/stages/actionFormatting/TargetNormalizationService.js';
import { LegacyFallbackFormatter } from '../../../../../src/actions/pipeline/stages/actionFormatting/legacy/LegacyFallbackFormatter.js';
import { createActionFormattingTask } from '../../../../../src/actions/pipeline/stages/actionFormatting/ActionFormattingTaskFactory.js';
import { MultiTargetActionFormatter } from '../../../../../src/actions/formatters/MultiTargetActionFormatter.js';
import ActionCommandFormatter from '../../../../../src/actions/actionFormatter.js';
import { ActionErrorContextBuilder } from '../../../../../src/actions/errors/actionErrorContextBuilder.js';
import { FixSuggestionEngine } from '../../../../../src/actions/errors/fixSuggestionEngine.js';
import { getEntityDisplayName } from '../../../../../src/utils/entityUtils.js';
import { ActionFormattingInstrumentation } from '../../../../../src/actions/pipeline/stages/actionFormatting/ActionFormattingInstrumentation.js';
import SimpleEntityManager from '../../../../common/entities/simpleEntityManager.js';
import {
  createMockLogger,
  createMockValidatedEventDispatcherForIntegration,
} from '../../../../common/mockFactories/index.js';

class RecordingInstrumentation extends ActionFormattingInstrumentation {
  constructor() {
    super();
    this.stageStartedEvents = [];
    this.actionStartedEvents = [];
    this.actionCompletedEvents = [];
    this.actionFailedEvents = [];
    this.stageCompletedEvents = [];
  }

  stageStarted(context) {
    this.stageStartedEvents.push(context);
  }

  actionStarted(context) {
    this.actionStartedEvents.push(context);
  }

  actionCompleted(context) {
    this.actionCompletedEvents.push(context);
  }

  actionFailed(context) {
    this.actionFailedEvents.push(context);
  }

  stageCompleted(context) {
    this.stageCompletedEvents.push(context);
  }
}

const buildValidateVisualProperties = (logger) => (visual, actionId) => {
  if (!visual) {
    return true;
  }

  if (typeof visual !== 'object' || Array.isArray(visual)) {
    logger.warn(
      `Invalid visual property structure for action '${actionId}': expected object, got ${typeof visual}. Visual properties will be passed through.`
    );
    return true;
  }

  for (const [key, value] of Object.entries(visual)) {
    if (typeof value !== 'string') {
      logger.warn(
        `Visual property '${key}' for action '${actionId}' should be a string, got ${typeof value}. Property will be passed through.`
      );
    }
  }

  return true;
};

const buildGameDataRepository = () => ({
  getComponentDefinition: () => ({
    id: 'component',
  }),
  getConditionDefinition: () => ({
    id: 'condition',
  }),
});

const buildActionIndex = () => ({
  getCandidateActions: () => [],
});

const buildDispatcher = () =>
  createMockValidatedEventDispatcherForIntegration();

const buildEnvironment = () => {
  const logger = createMockLogger();
  const dispatcher = buildDispatcher();

  const entityManager = new SimpleEntityManager([
    {
      id: 'actor-1',
      components: {
        'core:name': { value: 'Primary Actor' },
        'core:location': { value: 'square' },
      },
    },
    {
      id: 'target-1',
      components: {
        'core:name': { value: 'Target One' },
      },
    },
    {
      id: 'target-2',
      components: {
        'core:name': { value: 'Target Two' },
      },
    },
  ]);

  const fixSuggestionEngine = new FixSuggestionEngine({
    logger,
    gameDataRepository: buildGameDataRepository(),
    actionIndex: buildActionIndex(),
  });

  const errorContextBuilder = new ActionErrorContextBuilder({
    entityManager,
    logger,
    fixSuggestionEngine,
  });

  const errorFactory = new ActionFormattingErrorFactory({
    errorContextBuilder,
  });

  const targetNormalizationService = new TargetNormalizationService({ logger });
  const baseFormatter = new ActionCommandFormatter();
  const multiTargetFormatter = new MultiTargetActionFormatter(
    baseFormatter,
    logger
  );
  const fallbackFormatter = new LegacyFallbackFormatter({
    commandFormatter: baseFormatter,
    entityManager,
    getEntityDisplayNameFn: (entity, fallback) =>
      getEntityDisplayName(entity, fallback, logger),
  });

  const instrumentation = new RecordingInstrumentation();
  const validateVisualProperties = buildValidateVisualProperties(logger);

  return {
    logger,
    dispatcher,
    entityManager,
    fixSuggestionEngine,
    errorContextBuilder,
    errorFactory,
    targetNormalizationService,
    baseFormatter,
    multiTargetFormatter,
    fallbackFormatter,
    instrumentation,
    validateVisualProperties,
  };
};

const createActionDefinition = (overrides = {}) => ({
  id: 'test:multi-format',
  name: 'Wave Enthusiastically',
  template: 'Wave at {primary}',
  description: 'A friendly wave.',
  visual: { backgroundColor: '#fff' },
  ...overrides,
});

const createTargetContext = (overrides = {}) => ({
  entityId: 'target-1',
  type: 'entity',
  displayName: 'Target One',
  ...overrides,
});

describe('ActionFormattingCoordinator integration', () => {
  let env;

  beforeEach(() => {
    env = buildEnvironment();
  });

  it('formats multi-target actions using real strategy collaborators', async () => {
    const actionDefinition = createActionDefinition();
    const resolvedTargets = {
      primary: [
        {
          id: 'target-1',
          displayName: 'Target One',
        },
      ],
    };
    const targetDefinitions = {
      primary: {
        placeholder: 'primary',
        optional: false,
      },
    };

    const actor = env.entityManager.getEntityInstance('actor-1');
    const decider = new ActionFormattingDecider({
      strategies: [
        new PerActionMetadataStrategy({
          commandFormatter: env.multiTargetFormatter,
          entityManager: env.entityManager,
          safeEventDispatcher: env.dispatcher,
          getEntityDisplayNameFn: (entity, fallback) =>
            getEntityDisplayName(entity, fallback, env.logger),
          logger: env.logger,
          fallbackFormatter: env.fallbackFormatter,
          targetNormalizationService: env.targetNormalizationService,
        }),
      ],
      errorFactory: env.errorFactory,
    });

    const coordinator = new ActionFormattingCoordinator({
      context: {
        actor,
        actionsWithTargets: [
          {
            actionDef: actionDefinition,
            targetContexts: [createTargetContext()],
            resolvedTargets,
            targetDefinitions,
            isMultiTarget: true,
          },
        ],
        resolvedTargets,
        targetDefinitions,
      },
      instrumentation: env.instrumentation,
      decider,
      accumulatorFactory: () => new FormattingAccumulator(),
      errorFactory: env.errorFactory,
      fallbackFormatter: env.fallbackFormatter,
      targetNormalizationService: env.targetNormalizationService,
      commandFormatter: env.multiTargetFormatter,
      entityManager: env.entityManager,
      safeEventDispatcher: env.dispatcher,
      getEntityDisplayNameFn: (entity, fallback) =>
        getEntityDisplayName(entity, fallback, env.logger),
      logger: env.logger,
      validateVisualProperties: env.validateVisualProperties,
      formatterOptions: {
        logger: env.logger,
        debug: false,
        safeEventDispatcher: env.dispatcher,
      },
    });

    const result = await coordinator.run();

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].command).toContain('Wave at');
    expect(result.errors).toHaveLength(0);

    expect(env.instrumentation.stageStartedEvents).toHaveLength(1);
    expect(env.instrumentation.actionStartedEvents).toHaveLength(1);
    expect(env.instrumentation.actionCompletedEvents).toHaveLength(1);
    expect(env.instrumentation.stageCompletedEvents).toHaveLength(1);
    expect(
      env.instrumentation.stageCompletedEvents[0].statistics.perActionMetadata
    ).toBeGreaterThanOrEqual(1);
    expect(env.instrumentation.stageCompletedEvents[0].errorCount).toBe(0);
    expect(
      env.instrumentation.actionCompletedEvents[0].payload.formatterMethod
    ).toBe('formatMultiTarget');
  });

  it('records validation failures and falls back to legacy formatting', async () => {
    const actionDefinition = createActionDefinition({
      template: 'Greet {target}',
    });
    const actor = env.entityManager.getEntityInstance('actor-1');

    const baseFactory = (options) =>
      createActionFormattingTask({
        actor: options.actor,
        actionWithTargets: options.actionWithTargets,
        formatterOptions: options.formatterOptions,
        batchResolvedTargets: options.batchResolvedTargets,
        batchTargetDefinitions: options.batchTargetDefinitions,
      });

    const coordinator = new ActionFormattingCoordinator({
      context: {
        actor,
        actionsWithTargets: [
          {
            actionDef: actionDefinition,
            targetContexts: [createTargetContext({ placeholder: 'target' })],
            targetDefinitions: {
              primary: { placeholder: 'primary' },
            },
            isMultiTarget: true,
          },
        ],
        targetDefinitions: {
          primary: { placeholder: 'primary' },
        },
      },
      instrumentation: env.instrumentation,
      decider: new ActionFormattingDecider({
        strategies: [],
        errorFactory: env.errorFactory,
      }),
      accumulatorFactory: () => new FormattingAccumulator(),
      errorFactory: env.errorFactory,
      fallbackFormatter: env.fallbackFormatter,
      targetNormalizationService: env.targetNormalizationService,
      commandFormatter: env.baseFormatter,
      entityManager: env.entityManager,
      safeEventDispatcher: env.dispatcher,
      getEntityDisplayNameFn: (entity, fallback) =>
        getEntityDisplayName(entity, fallback, env.logger),
      logger: env.logger,
      validateVisualProperties: env.validateVisualProperties,
      createTask: (options) => {
        const task = baseFactory(options);
        return {
          ...task,
          resolvedTargets: null,
          metadata: {
            source: 'batch',
            hasPerActionMetadata: false,
          },
        };
      },
    });

    const result = await coordinator.run();

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(env.instrumentation.actionFailedEvents.length).toBeGreaterThan(0);
    expect(env.instrumentation.actionFailedEvents[0].payload.reason).toBe(
      'validation-failed'
    );
  });

  it('handles legacy fallback errors while still emitting partial results', async () => {
    const actor = env.entityManager.getEntityInstance('actor-1');
    const failingFormatter = new (class extends ActionCommandFormatter {
      format(actionDef, targetContext, entityManager, options, deps) {
        if (targetContext.entityId === 'target-2') {
          const error = new Error('Formatter crash');
          error.target = { entityId: 'target-2' };
          throw error;
        }
        return super.format(
          actionDef,
          targetContext,
          entityManager,
          options,
          deps
        );
      }
    })();

    const fallbackFormatter = new LegacyFallbackFormatter({
      commandFormatter: failingFormatter,
      entityManager: env.entityManager,
      getEntityDisplayNameFn: (entity, fallback) =>
        getEntityDisplayName(entity, fallback, env.logger),
    });

    const coordinator = new ActionFormattingCoordinator({
      context: {
        actor,
        actionsWithTargets: [
          {
            actionDef: createActionDefinition({
              id: 'test:legacy',
              template: 'Interact with {target}',
            }),
            targetContexts: [
              createTargetContext({
                entityId: 'target-1',
                placeholder: 'target',
              }),
              createTargetContext({
                entityId: 'target-2',
                placeholder: 'target',
              }),
            ],
          },
        ],
      },
      instrumentation: env.instrumentation,
      decider: new ActionFormattingDecider({
        strategies: [],
        errorFactory: env.errorFactory,
      }),
      accumulatorFactory: () => new FormattingAccumulator(),
      errorFactory: env.errorFactory,
      fallbackFormatter,
      targetNormalizationService: env.targetNormalizationService,
      commandFormatter: failingFormatter,
      entityManager: env.entityManager,
      safeEventDispatcher: env.dispatcher,
      getEntityDisplayNameFn: (entity, fallback) =>
        getEntityDisplayName(entity, fallback, env.logger),
      logger: env.logger,
      validateVisualProperties: env.validateVisualProperties,
    });

    const result = await coordinator.run();

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(env.instrumentation.stageCompletedEvents[0].errorCount).toBe(1);
    expect(
      env.instrumentation.stageCompletedEvents[0].statistics.failed
    ).toBeGreaterThanOrEqual(1);
  });

  it('routes mixed batches through coordinator instrumentation and statistics', async () => {
    const actor = env.entityManager.getEntityInstance('actor-1');

    const perActionStrategy = new PerActionMetadataStrategy({
      commandFormatter: env.multiTargetFormatter,
      entityManager: env.entityManager,
      safeEventDispatcher: env.dispatcher,
      getEntityDisplayNameFn: (entity, fallback) =>
        getEntityDisplayName(entity, fallback, env.logger),
      logger: env.logger,
      fallbackFormatter: env.fallbackFormatter,
      targetNormalizationService: env.targetNormalizationService,
    });

    const globalFormatter = {
      formatMultiTarget: (...args) =>
        env.multiTargetFormatter.formatMultiTarget(...args),
      format: (...args) => env.multiTargetFormatter.format(...args),
    };

    const globalStrategy = new GlobalMultiTargetStrategy({
      commandFormatter: globalFormatter,
      entityManager: env.entityManager,
      safeEventDispatcher: env.dispatcher,
      getEntityDisplayNameFn: (entity, fallback) =>
        getEntityDisplayName(entity, fallback, env.logger),
      logger: env.logger,
      fallbackFormatter: env.fallbackFormatter,
      targetNormalizationService: env.targetNormalizationService,
    });

    const decider = new ActionFormattingDecider({
      strategies: [perActionStrategy, globalStrategy],
      errorFactory: env.errorFactory,
    });

    const actionsWithTargets = [
      {
        actionDef: createActionDefinition({
          id: 'per-action-success',
          name: 'Per Action Success',
          template: 'Signal {primary}',
        }),
        targetContexts: [
          createTargetContext({
            entityId: 'target-1',
            placeholder: 'primary',
            displayName: 'Target One',
          }),
        ],
        resolvedTargets: {
          primary: [{ id: 'target-1', displayName: 'Target One' }],
        },
        targetDefinitions: {
          primary: { placeholder: 'primary' },
        },
        isMultiTarget: true,
      },
      {
        actionDef: createActionDefinition({
          id: 'batch-shared',
          name: 'Batch Shared',
          template: 'Coordinate with {primary}',
        }),
        targetContexts: [],
        isMultiTarget: true,
      },
      {
        actionDef: createActionDefinition({
          id: 'per-action-fallback',
          name: 'Per Action Fallback',
          template: 'Fallback {target}',
        }),
        targetContexts: [
          createTargetContext({
            entityId: 'target-2',
            placeholder: 'target',
            displayName: 'Target Two',
          }),
        ],
        resolvedTargets: null,
        targetDefinitions: null,
        isMultiTarget: true,
      },
    ];

    const coordinator = new ActionFormattingCoordinator({
      context: {
        actor,
        actionsWithTargets,
        resolvedTargets: {
          primary: [
            { id: 'target-1', displayName: 'Target One' },
            { id: 'target-2', displayName: 'Target Two' },
          ],
        },
        targetDefinitions: {
          primary: { placeholder: 'primary' },
        },
      },
      instrumentation: env.instrumentation,
      decider,
      accumulatorFactory: () => new FormattingAccumulator(),
      errorFactory: env.errorFactory,
      fallbackFormatter: env.fallbackFormatter,
      targetNormalizationService: env.targetNormalizationService,
      commandFormatter: env.multiTargetFormatter,
      entityManager: env.entityManager,
      safeEventDispatcher: env.dispatcher,
      getEntityDisplayNameFn: (entity, fallback) =>
        getEntityDisplayName(entity, fallback, env.logger),
      logger: env.logger,
      validateVisualProperties: env.validateVisualProperties,
      createTask: (options) => {
        const task = createActionFormattingTask(options);

        if (task.actionDef.id === 'per-action-fallback') {
          return {
            ...task,
            metadata: { source: 'per-action', hasPerActionMetadata: true },
            resolvedTargets: null,
            targetDefinitions: null,
          };
        }

        return task;
      },
    });

    const result = await coordinator.run();

    expect(result.success).toBe(true);
    expect(result.actions.length).toBeGreaterThanOrEqual(3);
    expect(result.errors).toHaveLength(1);

    expect(env.instrumentation.stageStartedEvents).toHaveLength(1);
    expect(env.instrumentation.stageStartedEvents[0].actions).toHaveLength(3);
    expect(env.instrumentation.stageCompletedEvents[0].statistics).toEqual(
      expect.objectContaining({
        total: 3,
        perActionMetadata: expect.any(Number),
        multiTarget: expect.any(Number),
        legacy: expect.any(Number),
      })
    );

    const validationFailure = env.instrumentation.actionFailedEvents.find(
      (event) => event.payload.reason === 'validation-failed'
    );
    expect(validationFailure).toBeDefined();

    const fallbackCompletion = env.instrumentation.actionCompletedEvents.find(
      (event) => event.actionDef.id === 'per-action-fallback'
    );
    expect(fallbackCompletion?.payload?.status).toBe('completed');
  });

  it('gracefully reports when no target contexts are available', async () => {
    const actor = env.entityManager.getEntityInstance('actor-1');

    const coordinator = new ActionFormattingCoordinator({
      context: {
        actor,
        actionsWithTargets: [
          {
            actionDef: createActionDefinition({
              id: 'test:no-targets',
            }),
            targetContexts: [],
          },
        ],
      },
      instrumentation: env.instrumentation,
      decider: new ActionFormattingDecider({
        strategies: [],
        errorFactory: env.errorFactory,
      }),
      accumulatorFactory: () => new FormattingAccumulator(),
      errorFactory: env.errorFactory,
      fallbackFormatter: env.fallbackFormatter,
      targetNormalizationService: env.targetNormalizationService,
      commandFormatter: env.baseFormatter,
      entityManager: env.entityManager,
      safeEventDispatcher: env.dispatcher,
      getEntityDisplayNameFn: (entity, fallback) =>
        getEntityDisplayName(entity, fallback, env.logger),
      logger: env.logger,
      validateVisualProperties: env.validateVisualProperties,
    });

    const result = await coordinator.run();

    expect(result.success).toBe(true);
    expect(result.actions).toHaveLength(0);
    expect(result.errors).toHaveLength(1);
    expect(env.instrumentation.actionFailedEvents).toHaveLength(1);
    expect(env.instrumentation.actionFailedEvents[0].payload.reason).toBe(
      'missing-target-contexts'
    );
  });
});
