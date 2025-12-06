import { describe, it, expect } from '@jest/globals';
import { ActionFormattingInstrumentation } from '../../../../../src/actions/pipeline/stages/actionFormatting/ActionFormattingInstrumentation.js';
import { ActionFormattingCoordinator } from '../../../../../src/actions/pipeline/stages/actionFormatting/ActionFormattingCoordinator.js';
import { ActionFormattingDecider } from '../../../../../src/actions/pipeline/stages/actionFormatting/ActionFormattingDecider.js';
import { PerActionMetadataStrategy } from '../../../../../src/actions/pipeline/stages/actionFormatting/strategies/PerActionMetadataStrategy.js';
import { FormattingAccumulator } from '../../../../../src/actions/pipeline/stages/actionFormatting/FormattingAccumulator.js';
import { ActionFormattingErrorFactory } from '../../../../../src/actions/pipeline/stages/actionFormatting/ActionFormattingErrorFactory.js';
import { TargetNormalizationService } from '../../../../../src/actions/pipeline/stages/actionFormatting/TargetNormalizationService.js';
import { LegacyFallbackFormatter } from '../../../../../src/actions/pipeline/stages/actionFormatting/legacy/LegacyFallbackFormatter.js';
import { MultiTargetActionFormatter } from '../../../../../src/actions/formatters/MultiTargetActionFormatter.js';
import ActionCommandFormatter from '../../../../../src/actions/actionFormatter.js';
import { ActionErrorContextBuilder } from '../../../../../src/actions/errors/actionErrorContextBuilder.js';
import { FixSuggestionEngine } from '../../../../../src/actions/errors/fixSuggestionEngine.js';
import { getEntityDisplayName } from '../../../../../src/utils/entityUtils.js';
import SimpleEntityManager from '../../../../common/entities/simpleEntityManager.js';
import {
  createMockLogger,
  createMockValidatedEventDispatcherForIntegration,
} from '../../../../common/mockFactories/index.js';

const buildGameDataRepository = () => ({
  getComponentDefinition: () => ({ id: 'component:test' }),
  getConditionDefinition: () => ({ id: 'condition:test' }),
});

const buildActionIndex = () => ({
  getCandidateActions: () => [],
});

const createTargetContext = (overrides = {}) => ({
  entityId: 'target-1',
  type: 'entity',
  displayName: 'Target One',
  placeholder: 'primary',
  ...overrides,
});

const createActionDefinition = (overrides = {}) => ({
  id: 'test:action',
  name: 'Integration Wave',
  template: 'Wave at {primary}',
  description: 'Greets a nearby entity.',
  visual: { backgroundColor: '#123456' },
  ...overrides,
});

const buildEnvironment = () => {
  const logger = createMockLogger();
  const dispatcher = createMockValidatedEventDispatcherForIntegration();

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

  const validateVisualProperties = (visual) => {
    if (!visual) {
      return true;
    }
    if (typeof visual !== 'object' || Array.isArray(visual)) {
      logger.warn('Invalid visual payload provided to formatter.', { visual });
      return true;
    }
    return true;
  };

  return {
    logger,
    dispatcher,
    entityManager,
    errorFactory,
    targetNormalizationService,
    baseFormatter,
    multiTargetFormatter,
    fallbackFormatter,
    validateVisualProperties,
  };
};

describe('ActionFormattingInstrumentation integration coverage', () => {
  it('throws immediately when instrumentation lifecycle hooks are missing at stage start', async () => {
    const env = buildEnvironment();
    const coordinator = new ActionFormattingCoordinator({
      context: {
        actor: env.entityManager.getEntityInstance('actor-1'),
        actionsWithTargets: [
          {
            actionDef: createActionDefinition(),
            targetContexts: [createTargetContext()],
          },
        ],
      },
      instrumentation: new ActionFormattingInstrumentation(),
      decider: {
        decide: () => ({ strategy: null, validationFailures: [] }),
      },
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

    await expect(coordinator.run()).rejects.toThrow(
      'ActionFormattingInstrumentation.stageStarted must be implemented'
    );
  });

  it('surfaces failures when action lifecycle hooks are not implemented', async () => {
    const env = buildEnvironment();

    class StageOnlyInstrumentation extends ActionFormattingInstrumentation {
      stageStarted(context) {
        this.context = context;
      }
    }

    const coordinator = new ActionFormattingCoordinator({
      context: {
        actor: env.entityManager.getEntityInstance('actor-1'),
        actionsWithTargets: [
          {
            actionDef: createActionDefinition(),
            targetContexts: [createTargetContext()],
          },
        ],
      },
      instrumentation: new StageOnlyInstrumentation(),
      decider: {
        decide: () => ({ strategy: null, validationFailures: [] }),
      },
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

    await expect(coordinator.run()).rejects.toThrow(
      'ActionFormattingInstrumentation.actionStarted must be implemented'
    );
  });

  it('propagates errors when completion hooks delegate to the abstract base implementation', async () => {
    const env = buildEnvironment();

    class CompletionFailureInstrumentation extends ActionFormattingInstrumentation {
      stageStarted() {}
      actionStarted() {}
      actionCompleted(context) {
        super.actionCompleted(context);
      }
    }

    const resolvedTargets = {
      primary: [
        {
          id: 'target-1',
          displayName: 'Target One',
        },
      ],
    };
    const targetDefinitions = {
      primary: { placeholder: 'primary', optional: false },
    };

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
        actor: env.entityManager.getEntityInstance('actor-1'),
        actionsWithTargets: [
          {
            actionDef: createActionDefinition(),
            targetContexts: [createTargetContext()],
            resolvedTargets,
            targetDefinitions,
            isMultiTarget: true,
          },
        ],
        resolvedTargets,
        targetDefinitions,
      },
      instrumentation: new CompletionFailureInstrumentation(),
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
    });

    await expect(coordinator.run()).rejects.toThrow(
      'ActionFormattingInstrumentation.actionCompleted must be implemented'
    );
  });

  it('fails validation workflows when the failure hook relies on the abstract implementation', async () => {
    const env = buildEnvironment();

    class ValidationFailureInstrumentation extends ActionFormattingInstrumentation {
      stageStarted() {}
      actionStarted() {}
    }

    const coordinator = new ActionFormattingCoordinator({
      context: {
        actor: env.entityManager.getEntityInstance('actor-1'),
        actionsWithTargets: [
          {
            actionDef: createActionDefinition(),
            targetContexts: [createTargetContext()],
          },
        ],
      },
      instrumentation: new ValidationFailureInstrumentation(),
      decider: {
        decide: () => ({
          strategy: null,
          validationFailures: [
            {
              code: 'integration_failure',
              error: new Error('simulated failure'),
            },
          ],
        }),
      },
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

    await expect(coordinator.run()).rejects.toThrow(
      'ActionFormattingInstrumentation.actionFailed must be implemented'
    );
  });

  it('propagates stage completion failures raised by partially implemented instrumentation', async () => {
    const env = buildEnvironment();

    class StageCompletionFailureInstrumentation extends ActionFormattingInstrumentation {
      stageStarted() {}
      actionStarted() {}
      actionCompleted() {}
      actionFailed() {}
      stageCompleted(context) {
        super.stageCompleted(context);
      }
    }

    const resolvedTargets = {
      primary: [
        {
          id: 'target-1',
          displayName: 'Target One',
        },
      ],
    };
    const targetDefinitions = {
      primary: { placeholder: 'primary', optional: false },
    };

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
        actor: env.entityManager.getEntityInstance('actor-1'),
        actionsWithTargets: [
          {
            actionDef: createActionDefinition(),
            targetContexts: [createTargetContext()],
            resolvedTargets,
            targetDefinitions,
            isMultiTarget: true,
          },
        ],
        resolvedTargets,
        targetDefinitions,
      },
      instrumentation: new StageCompletionFailureInstrumentation(),
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
    });

    await expect(coordinator.run()).rejects.toThrow(
      'ActionFormattingInstrumentation.stageCompleted must be implemented'
    );
  });
});
