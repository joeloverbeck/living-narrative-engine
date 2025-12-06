import { describe, it, expect } from '@jest/globals';
import { ActionCandidateProcessor } from '../../../src/actions/actionCandidateProcessor.js';
import { PrerequisiteEvaluationService } from '../../../src/actions/validation/prerequisiteEvaluationService.js';
import { ActionValidationContextBuilder } from '../../../src/actions/validation/actionValidationContextBuilder.js';
import { ActionErrorContextBuilder } from '../../../src/actions/errors/actionErrorContextBuilder.js';
import ActionCommandFormatter from '../../../src/actions/actionFormatter.js';
import { TargetResolutionService } from '../../../src/actions/targetResolutionService.js';
import { ActionIndex } from '../../../src/actions/actionIndex.js';
import { FixSuggestionEngine } from '../../../src/actions/errors/fixSuggestionEngine.js';
import JsonLogicEvaluationService from '../../../src/logic/jsonLogicEvaluationService.js';
import { ActionResult } from '../../../src/actions/core/actionResult.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import { ERROR_PHASES } from '../../../src/actions/errors/actionErrorTypes.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';

class RecordingLogger {
  constructor() {
    this.debugLogs = [];
    this.infoLogs = [];
    this.warnLogs = [];
    this.errorLogs = [];
  }

  debug(...args) {
    this.debugLogs.push(args);
  }

  info(...args) {
    this.infoLogs.push(args);
  }

  warn(...args) {
    this.warnLogs.push(args);
  }

  error(...args) {
    this.errorLogs.push(args);
  }
}

class RecordingDispatcher {
  constructor() {
    this.events = [];
  }

  dispatch(eventId, payload) {
    this.events.push({ eventId, payload });
  }
}

class ConfigurableScopeResolver {
  constructor() {
    this.behaviors = new Map();
  }

  setBehavior(scopeName, behavior) {
    this.behaviors.set(scopeName, behavior);
  }

  resolve(scopeName, context) {
    const behavior = this.behaviors.get(scopeName);
    if (!behavior) {
      return ActionResult.success(new Set());
    }
    return behavior(context);
  }
}

const displayNameFromEntity = (entity, fallback) => {
  const component = entity?.components?.['identity:name'];
  return component?.text ?? fallback;
};

const createBaseEnvironment = ({
  createErrorContextBuilder,
  prerequisiteEvaluationService: prereqOverride,
  targetResolutionService: targetOverride,
  actionCommandFormatter: formatterOverride,
  safeEventDispatcher: dispatcherOverride,
  getEntityDisplayNameFn = displayNameFromEntity,
} = {}) => {
  const logger = new RecordingLogger();
  const dispatcher = dispatcherOverride ?? new RecordingDispatcher();

  const entities = [
    {
      id: 'hero',
      components: {
        'identity:name': { text: 'Astra' },
        'core:traits': { friendly: true },
        'core:location': { value: 'plaza' },
      },
    },
    {
      id: 'companion',
      components: {
        'identity:name': { text: 'Talia' },
      },
    },
  ];

  const entityManager = new SimpleEntityManager(entities);

  const actionDefinition = {
    id: 'social:greet_companion',
    name: 'Greet Companion',
    description: 'Offer a friendly greeting',
    scope: 'core:other_actors',
    template: 'Greet {target}',
    prerequisites: [
      {
        id: 'friendly-check',
        description: 'Actor must be friendly',
        logic: {
          '==': [{ var: 'actor.components.core:traits.friendly' }, true],
        },
      },
    ],
    required_components: { actor: ['core:traits'] },
  };

  const actionContext = { currentLocation: 'plaza', weather: 'clear' };

  const actionIndex = new ActionIndex({ logger, entityManager });
  actionIndex.buildIndex([actionDefinition]);

  const gameDataRepository = {
    getConditionDefinition: () => null,
    getComponentDefinition: (componentId) => ({ id: componentId }),
  };

  const fixSuggestionEngine = new FixSuggestionEngine({
    logger,
    gameDataRepository,
    actionIndex,
  });

  const baseErrorContextBuilder = new ActionErrorContextBuilder({
    entityManager,
    logger,
    fixSuggestionEngine,
  });

  const actionErrorContextBuilder = createErrorContextBuilder
    ? createErrorContextBuilder({
        baseBuilder: baseErrorContextBuilder,
        entityManager,
        logger,
      })
    : baseErrorContextBuilder;

  const validationContextBuilder = new ActionValidationContextBuilder({
    entityManager,
    logger,
  });

  const jsonLogicService = new JsonLogicEvaluationService({
    logger,
    gameDataRepository,
  });

  const prerequisiteEvaluationService =
    prereqOverride ??
    new PrerequisiteEvaluationService({
      logger,
      jsonLogicEvaluationService: jsonLogicService,
      actionValidationContextBuilder: validationContextBuilder,
      gameDataRepository,
    });

  const scopeResolver = new ConfigurableScopeResolver();

  const targetResolutionService =
    targetOverride ??
    new TargetResolutionService({
      unifiedScopeResolver: scopeResolver,
      logger,
    });

  const formatter = formatterOverride ?? new ActionCommandFormatter();

  const processor = new ActionCandidateProcessor({
    prerequisiteEvaluationService,
    targetResolutionService,
    entityManager,
    actionCommandFormatter: formatter,
    safeEventDispatcher: dispatcher,
    getEntityDisplayNameFn,
    logger,
    actionErrorContextBuilder,
  });

  const actor = entityManager.getEntityInstance('hero');

  return {
    processor,
    actor,
    logger,
    dispatcher,
    actionDefinition,
    actionContext,
    scopeResolver,
    targetResolutionService,
    prerequisiteEvaluationService,
    baseErrorContextBuilder,
    actionErrorContextBuilder,
    entityManager,
  };
};

describe('ActionCandidateProcessor integration edge cases', () => {
  it('falls back to internal processing when trace lacks withSpan support', () => {
    const env = createBaseEnvironment();
    const { processor, actionDefinition, actor, actionContext, scopeResolver } =
      env;

    scopeResolver.setBehavior('core:other_actors', () =>
      ActionResult.success(new Set(['companion']))
    );

    const quickWaveAction = {
      ...actionDefinition,
      id: 'social:quick_wave',
      name: 'Quick Wave',
      prerequisites: [],
      template: 'Wave at {target}',
    };

    const result = processor.process(
      quickWaveAction,
      actor,
      actionContext,
      null
    );

    expect(result.success).toBe(true);
    expect(result.value.cause).toBeUndefined();
    expect(result.value.actions).toEqual([
      {
        id: 'social:quick_wave',
        name: 'Quick Wave',
        command: 'Wave at Talia',
        description: 'Offer a friendly greeting',
        params: { targetId: 'companion' },
        visual: null,
      },
    ]);
  });

  it('rebuilds error context when prerequisite evaluation throws legacy shaped errors', () => {
    let targetServiceCalled = false;
    const env = createBaseEnvironment({
      createErrorContextBuilder: ({ baseBuilder }) => {
        let firstCall = true;
        return {
          buildErrorContext(params) {
            const context = baseBuilder.buildErrorContext(params);
            if (firstCall) {
              firstCall = false;
              const { timestamp, ...rest } = context;
              return rest;
            }
            return context;
          },
        };
      },
      prerequisiteEvaluationService: {
        evaluate() {
          throw new Error('legacy prerequisite failure');
        },
      },
      targetResolutionService: {
        resolveTargets() {
          targetServiceCalled = true;
          return ActionResult.success([]);
        },
      },
    });

    const { processor, actionDefinition, actor, actionContext } = env;

    const result = processor.process(actionDefinition, actor, actionContext);

    expect(targetServiceCalled).toBe(false);
    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('prerequisite-error');
    expect(result.value.errors).toHaveLength(1);
    expect(result.value.errors[0].timestamp).toEqual(
      result.value.errors[0].environmentContext.timestamp
    );
  });

  it('preserves prebuilt action error contexts returned by the target resolver', () => {
    const baseEnv = createBaseEnvironment();
    const prebuiltContext = baseEnv.baseErrorContextBuilder.buildErrorContext({
      error: new Error('prebuilt failure'),
      actionDef: baseEnv.actionDefinition,
      actorId: baseEnv.actor.id,
      phase: ERROR_PHASES.VALIDATION,
    });

    const env = createBaseEnvironment({
      targetResolutionService: {
        resolveTargets() {
          return ActionResult.failure(prebuiltContext);
        },
      },
      createErrorContextBuilder: () => baseEnv.baseErrorContextBuilder,
    });

    env.scopeResolver.setBehavior('core:other_actors', () =>
      ActionResult.success(new Set(['companion']))
    );

    const result = env.processor.process(
      env.actionDefinition,
      env.actor,
      env.actionContext
    );

    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('resolution-error');
    expect(result.value.errors).toHaveLength(1);
    expect(result.value.errors[0].error.message).toBe('prebuilt failure');
    expect(result.value.errors[0].timestamp).toBe(prebuiltContext.timestamp);
  });

  it('handles thrown errors from the target resolution service', () => {
    const env = createBaseEnvironment({
      targetResolutionService: {
        resolveTargets() {
          throw new Error('scope exploded');
        },
      },
    });

    const { processor, actionDefinition, actor, actionContext, logger } = env;

    const result = processor.process(actionDefinition, actor, actionContext);

    expect(result.success).toBe(true);
    expect(result.value.cause).toBe('resolution-error');
    expect(result.value.errors).toHaveLength(1);
    expect(
      logger.errorLogs.some((entry) =>
        entry[0].includes('Error resolving scope')
      )
    ).toBe(true);
  });

  it('captures formatter exceptions as actionable error contexts', () => {
    const env = createBaseEnvironment({
      actionCommandFormatter: {
        format() {
          throw new Error('formatting went boom');
        },
      },
      targetResolutionService: {
        resolveTargets() {
          return ActionResult.success([
            ActionTargetContext.forEntity('companion'),
          ]);
        },
      },
    });

    const { processor, actionDefinition, actor, actionContext, logger } = env;

    const result = processor.process(actionDefinition, actor, actionContext);

    expect(result.success).toBe(true);
    expect(result.value.actions).toHaveLength(0);
    expect(result.value.errors).toHaveLength(1);
    expect(result.value.errors[0].targetId).toBe('companion');
    expect(
      logger.errorLogs.some((entry) =>
        entry[0].includes("Error formatting action 'social:greet_companion'")
      )
    ).toBe(true);
  });
});
